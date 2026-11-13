/**
 * auth.js : connexion / inscription (fenêtre), vérification e-mail, déconnexion
 */

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    reload
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { $, on, toast, openDialog, setupDialog } from './utils.js';

const PASSWORD_MIN_LENGTH = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const ATTEMPTS_KEY = 'aimpe3_login_attempts';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_COOLDOWN_MS = 60 * 1000;

const validateEmail = (email) => EMAIL_REGEX.test(email) && email.length <= 254;

function getPasswordChecks(pwd) {
    return {
        length: pwd.length >= PASSWORD_MIN_LENGTH,
        upper: /[A-Z]/.test(pwd),
        lower: /[a-z]/.test(pwd),
        digit: /\d/.test(pwd),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd)
    };
}
const isPasswordStrong = (pwd) => Object.values(getPasswordChecks(pwd)).every(Boolean);

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
    const count = (getLoginAttempts().count || 0) + 1;
    const data = { count };
    if (count >= MAX_LOGIN_ATTEMPTS) data.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
    return data;
}

const resetLoginAttempts = () => localStorage.removeItem(ATTEMPTS_KEY);
const isLockedOut = () => {
    const data = getLoginAttempts();
    return Boolean(data.lockedUntil && Date.now() < data.lockedUntil);
};

function updateStrength(pwd) {
    const checks = getPasswordChecks(pwd);
    const score = Object.values(checks).filter(Boolean).length;
    const bar = $('strength-bar');
    if (bar) {
        bar.classList.remove('weak', 'medium', 'strong');
        if (pwd.length > 0) bar.classList.add(score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong');
    }
    document.querySelectorAll('#pwd-reqs li').forEach((li) => {
        li.classList.toggle('ok', Boolean(checks[li.dataset.req]));
    });
}

export function initAuth(auth) {
    const dialog = $('auth-dialog');
    setupDialog(dialog);

    let isSignUp = false;
    let lastResendTime = 0;
    let pollTimer = null;

    const msg = (text = '', type = 'error') => {
        const el = $('auth-msg');
        if (!el) return;
        el.textContent = text;
        el.className = `form-msg ${text ? type : ''}`.trim();
    };

    function setMode(signUp) {
        isSignUp = signUp;
        $('auth-title').textContent = signUp ? 'Créer un compte' : 'Connexion';
        $('btn-auth').textContent = signUp ? "S'inscrire" : 'Se connecter';
        $('tab-login').setAttribute('aria-selected', String(!signUp));
        $('tab-signup').setAttribute('aria-selected', String(signUp));
        $('signup-extra').classList.toggle('hidden', !signUp);
        $('password').setAttribute('autocomplete', signUp ? 'new-password' : 'current-password');
        $('password').value = '';
        $('password-confirm').value = '';
        msg('');
        updateStrength('');
    }

    function open(mode = 'login') {
        setMode(mode === 'signup');
        openDialog(dialog);
        setTimeout(() => $('email')?.focus(), 60);
    }

    on('tab-login', 'click', () => setMode(false));
    on('tab-signup', 'click', () => setMode(true));
    on('btn-open-login', 'click', () => open('login'));
    on('password', 'input', (e) => { if (isSignUp) updateStrength(e.target.value); });

    on('pw-toggle', 'click', () => {
        const input = $('password');
        input.type = input.type === 'password' ? 'text' : 'password';
    });

    // ---------- Soumission ----------
    on('auth-form', 'submit', async (event) => {
        event.preventDefault();

        const emailEl = $('email');
        const passwordEl = $('password');
        const btn = $('btn-auth');
        const email = emailEl.value.trim();
        const password = passwordEl.value;

        if (!validateEmail(email)) {
            emailEl.classList.add('invalid');
            msg('Adresse e-mail invalide.');
            return;
        }
        emailEl.classList.remove('invalid');

        if (isSignUp) {
            if (!isPasswordStrong(password)) {
                msg(`Mot de passe trop faible (min. ${PASSWORD_MIN_LENGTH} caractères, majuscule, minuscule, chiffre, spécial).`);
                return;
            }
            if (password !== $('password-confirm').value) {
                msg('Les mots de passe ne correspondent pas.');
                return;
            }
        } else {
            if (isLockedOut()) {
                const remaining = Math.ceil((getLoginAttempts().lockedUntil - Date.now()) / 60000);
                msg(`Trop de tentatives. Réessayez dans ${remaining} min.`);
                return;
            }
            if (!password) {
                msg('Veuillez saisir votre mot de passe.');
                return;
            }
        }

        btn.disabled = true;
        btn.textContent = isSignUp ? 'Inscription…' : 'Connexion…';
        msg('');

        try {
            if (isSignUp) {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await sendEmailVerification(cred.user);
                toast('Compte créé ! Vérifiez votre e-mail.', 'success');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                resetLoginAttempts();
                toast('Connexion réussie.', 'success');
            }
            passwordEl.value = '';
            $('password-confirm').value = '';
            dialog.close();
        } catch (error) {
            console.error('[auth] Erreur :', error.code, error.message);
            let text = 'Identifiants invalides ou problème de connexion.';
            switch (error.code) {
                case 'auth/email-already-in-use': text = 'Un compte existe déjà avec cet e-mail.'; break;
                case 'auth/weak-password': text = 'Mot de passe trop faible.'; break;
                case 'auth/too-many-requests': text = 'Trop de tentatives. Réessayez plus tard.'; break;
                case 'auth/network-request-failed': text = 'Problème de connexion réseau.'; break;
                case 'auth/invalid-credential':
                case 'auth/wrong-password':
                case 'auth/user-not-found': text = 'E-mail ou mot de passe incorrect.'; break;
            }
            if (!isSignUp) {
                const data = recordFailedAttempt();
                if (data.lockedUntil) text = 'Trop de tentatives. Compte bloqué 15 min.';
            }
            msg(text);
        } finally {
            btn.disabled = false;
            btn.textContent = isSignUp ? "S'inscrire" : 'Se connecter';
        }
    });

    on('btn-logout', 'click', async () => {
        await signOut(auth);
        toast('Vous êtes déconnecté.', 'info');
    });

    // ---------- Vérification de l'e-mail ----------
    on('btn-resend', 'click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        const now = Date.now();
        if (now - lastResendTime < RESEND_COOLDOWN_MS) {
            const remaining = Math.ceil((RESEND_COOLDOWN_MS - (now - lastResendTime)) / 1000);
            toast(`Patientez ${remaining} s avant de renvoyer.`, 'warn');
            return;
        }

        const btn = $('btn-resend');
        btn.disabled = true;
        try {
            await sendEmailVerification(user);
            lastResendTime = now;
            toast('E-mail de vérification renvoyé.', 'success');
        } catch (error) {
            toast(error.code === 'auth/too-many-requests'
                ? 'Trop de demandes. Réessayez plus tard.'
                : 'Erreur lors du renvoi. Réessayez.', 'error');
        } finally {
            btn.disabled = false;
        }
    });

    on('btn-check-verified', 'click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        const btn = $('btn-check-verified');
        btn.disabled = true;
        try {
            await reload(user);
            if (user.emailVerified) {
                toast('E-mail vérifié ! Bienvenue.', 'success');
                window.dispatchEvent(new CustomEvent('user-updated'));
            } else {
                toast("E-mail pas encore vérifié. Cliquez sur le lien reçu.", 'warn');
            }
        } catch {
            toast('Erreur de vérification. Réessayez.', 'error');
        } finally {
            btn.disabled = false;
        }
    });

    /** Vérifie automatiquement toutes les 5 s tant que l'e-mail n'est pas confirmé. */
    function watchVerification(user) {
        clearInterval(pollTimer);
        pollTimer = null;
        if (!user || user.emailVerified) return;

        pollTimer = setInterval(async () => {
            const current = auth.currentUser;
            if (!current) return;
            try {
                await reload(current);
                if (current.emailVerified) {
                    clearInterval(pollTimer);
                    pollTimer = null;
                    toast('E-mail vérifié ! Bienvenue.', 'success');
                    window.dispatchEvent(new CustomEvent('user-updated'));
                }
            } catch { /* silencieux */ }
        }, 5000);
    }

    return { open, watchVerification };
}
