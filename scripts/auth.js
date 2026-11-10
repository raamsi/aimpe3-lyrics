/**
 * Module d'authentification
 * Gère : connexion, inscription, vérification email, anti-bruteforce
 */

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    reload
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ========== CONSTANTES ==========
const PASSWORD_MIN_LENGTH = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const ATTEMPTS_KEY = 'aimpe3_login_attempts';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_COOLDOWN_MS = 60 * 1000;

let isSignUp = false;
let lastResendTime = 0;

// ========== HELPERS ==========
const $ = (id) => document.getElementById(id);

function setStatus(msg, color = '#ffffff') {
    const status = $('status');
    if (status) {
        status.innerText = msg;
        status.style.color = color;
    }
}

function validateEmail(email) {
    return EMAIL_REGEX.test(email) && email.length <= 254;
}

function getPasswordChecks(pwd) {
    return {
        length: pwd.length >= PASSWORD_MIN_LENGTH,
        upper: /[A-Z]/.test(pwd),
        lower: /[a-z]/.test(pwd),
        digit: /\d/.test(pwd),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd)
    };
}

function isPasswordStrong(pwd) {
    return Object.values(getPasswordChecks(pwd)).every(Boolean);
}

// ========== ANTI-BRUTEFORCE ==========
function getLoginAttempts() {
    try {
        const data = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}');
        if (data.lockedUntil && Date.now() > data.lockedUntil) {
            localStorage.removeItem(ATTEMPTS_KEY);
            return { count: 0 };
        }
        return data;
    } catch {
        return { count: 0 };
    }
}

function recordFailedAttempt() {
    const data = getLoginAttempts();
    const count = (data.count || 0) + 1;
    const newData = { count };
    if (count >= MAX_LOGIN_ATTEMPTS) {
        newData.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
    }
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(newData));
    return newData;
}

function resetLoginAttempts() {
    localStorage.removeItem(ATTEMPTS_KEY);
}

function isLockedOut() {
    const data = getLoginAttempts();
    return data.lockedUntil && Date.now() < data.lockedUntil;
}

// ========== INDICATEUR DE FORCE ==========
function updateStrength(pwd) {
    const checks = getPasswordChecks(pwd);
    const score = Object.values(checks).filter(Boolean).length;

    const bar = $('strength-bar');
    if (!bar) return;

    bar.classList.remove('weak', 'medium', 'strong');
    if (pwd.length === 0) {
        bar.style.width = '0';
    } else if (score <= 2) {
        bar.classList.add('weak');
    } else if (score <= 4) {
        bar.classList.add('medium');
    } else {
        bar.classList.add('strong');
    }

    document.querySelectorAll('#pwd-reqs li').forEach(li => {
        li.classList.toggle('ok', !!checks[li.dataset.req]);
    });
}

// ========== INITIALISATION ==========
export function initAuth(auth) {

    // ---- Basculement connexion / inscription ----
    $('btn-switch').addEventListener('click', () => {
        isSignUp = !isSignUp;
        $('form-title').innerText = isSignUp ? "Créer un compte" : "Connexion";
        $('btn-auth').innerText = isSignUp ? "S'inscrire" : "Se connecter";
        $('btn-switch').innerText = isSignUp
            ? "Déjà un compte ? Se connecter"
            : "Pas encore de compte ? S'inscrire";
        $('strength-wrapper').classList.toggle('hidden', !isSignUp);
        $('password').setAttribute('autocomplete', isSignUp ? 'new-password' : 'current-password');
        $('password-confirm').value = '';
        $('password').value = '';
        setStatus("");
        updateStrength('');
    });

    // ---- Force du mot de passe en temps réel ----
    $('password').addEventListener('input', (e) => {
        if (isSignUp) updateStrength(e.target.value);
    });

    // ---- Soumission du formulaire ----
    $('btn-auth').addEventListener('click', async () => {
        const email = $('email').value.trim();
        const password = $('password').value;
        const btn = $('btn-auth');

        if (!validateEmail(email)) {
            setStatus("Adresse email invalide.", "#e74c3c");
            $('email').classList.add('invalid');
            return;
        }
        $('email').classList.remove('invalid');

        if (isSignUp) {
            if (!isPasswordStrong(password)) {
                setStatus(`Mot de passe trop faible (min. ${PASSWORD_MIN_LENGTH} car., maj., min., chiffre, spécial).`, "#e74c3c");
                return;
            }
            if (password !== $('password-confirm').value) {
                setStatus("Les mots de passe ne correspondent pas.", "#e74c3c");
                return;
            }
        } else {
            if (isLockedOut()) {
                const data = getLoginAttempts();
                const remaining = Math.ceil((data.lockedUntil - Date.now()) / 60000);
                setStatus(`Trop de tentatives. Réessayez dans ${remaining} min.`, "#e74c3c");
                return;
            }
            if (!password) {
                setStatus("Veuillez saisir votre mot de passe.", "#e74c3c");
                return;
            }
        }

        btn.disabled = true;
        btn.innerText = isSignUp ? "Inscription…" : "Connexion…";
        setStatus("");

        try {
            if (isSignUp) {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await sendEmailVerification(cred.user);
                setStatus("Compte créé ! Vérifiez votre email.", "#1DB954");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                resetLoginAttempts();
                setStatus("Connexion réussie !", "#1DB954");
            }
            $('password').value = '';
            $('password-confirm').value = '';
        } catch (error) {
            let msg = "Identifiants invalides ou problème de connexion.";
            if (error.code === 'auth/email-already-in-use') {
                msg = "Un compte existe déjà avec cet email.";
            } else if (error.code === 'auth/weak-password') {
                msg = "Mot de passe trop faible.";
            } else if (error.code === 'auth/too-many-requests') {
                msg = "Trop de tentatives. Réessayez plus tard.";
            } else if (error.code === 'auth/network-request-failed') {
                msg = "Problème de connexion réseau.";
            }
            if (!isSignUp) {
                const data = recordFailedAttempt();
                if (data.lockedUntil) {
                    msg = "Trop de tentatives. Compte bloqué 15 min.";
                }
            }
            setStatus(msg, "#e74c3c");
        } finally {
            btn.disabled = false;
            btn.innerText = isSignUp ? "S'inscrire" : "Se connecter";
        }
    });

    // ---- Touche Entrée ----
    ['email', 'password', 'password-confirm'].forEach(id => {
        $(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') $('btn-auth').click();
        });
    });

    // ---- Déconnexions ----
    $('btn-logout').addEventListener('click', () => signOut(auth));
    $('btn-logout-verify').addEventListener('click', () => signOut(auth));

    // ---- Renvoi email de vérification ----
    $('btn-resend').addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        const now = Date.now();
        if (now - lastResendTime < RESEND_COOLDOWN_MS) {
            const remaining = Math.ceil((RESEND_COOLDOWN_MS - (now - lastResendTime)) / 1000);
            setStatus(`Patientez ${remaining}s avant de renvoyer.`, "#f39c12");
            return;
        }

        const btn = $('btn-resend');
        btn.disabled = true;
        try {
            await sendEmailVerification(user);
            lastResendTime = now;
            setStatus("Email de vérification renvoyé !", "#1DB954");
        } catch (error) {
            if (error.code === 'auth/too-many-requests') {
                setStatus("Trop de demandes. Réessayez plus tard.", "#e74c3c");
            } else {
                setStatus("Erreur lors du renvoi. Réessayez.", "#e74c3c");
            }
        } finally {
            btn.disabled = false;
        }
    });

    // ---- Vérifier si l'email a été validé ----
    $('btn-check-verified').addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        const btn = $('btn-check-verified');
        btn.disabled = true;
        setStatus("Vérification en cours…", "#ffffff");

        try {
            await reload(user);
            if (user.emailVerified) {
                setStatus("Email vérifié !", "#1DB954");
                window.dispatchEvent(new CustomEvent('user-updated'));
            } else {
                setStatus("Email pas encore vérifié. Cliquez sur le lien reçu.", "#f39c12");
            }
        } catch (error) {
            setStatus("Erreur de vérification. Réessayez.", "#e74c3c");
        } finally {
            btn.disabled = false;
        }
    });

    // ---- Polling automatique de vérification ----
    setInterval(async () => {
        const user = auth.currentUser;
        if (user && !user.emailVerified) {
            try {
                await reload(user);
                if (user.emailVerified) {
                    setStatus("Email vérifié ! Bienvenue.", "#1DB954");
                    window.dispatchEvent(new CustomEvent('user-updated'));
                }
            } catch (e) { /* silencieux */ }
        }
    }, 5000);
}
