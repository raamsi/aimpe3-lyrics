/**
 * main.js — Orchestrateur principal
 * Initialise Firebase, App Check, les modules auth/upload, et le lecteur synchronisé
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";
import {
    getAuth,
    onAuthStateChanged,
    reload
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { LyricsPlayer } from './player.js';
import { initAuth } from './auth.js';
import { initUpload } from './upload.js';

// ========== CONFIG FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyBRGa-C4CBQHOfoU_dVdbqf3HMGMmP7olQ",
    authDomain: "aimpe3-web.firebaseapp.com",
    projectId: "aimpe3-web",
    storageBucket: "aimpe3-web.firebasestorage.app",
    messagingSenderId: "141430245510",
    appId: "1:141430245510:web:c26a4d06a89dd4ede46907"
};

const app = initializeApp(firebaseConfig);

// ✅ App Check — AVANT getAuth / getFirestore
initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('VOTRE_CLE_DE_SITE_RECAPTCHA_V3'),
    isTokenAutoRefreshEnabled: true
});

export const auth = getAuth(app);
export const db = getFirestore(app);

// ========== ÉTAT GLOBAL ==========
let lyricsPlayer = null;

// ========== HELPERS ==========
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function setStatus(msg, color = '#ffffff') {
    const status = document.getElementById('status');
    if (status) {
        status.innerText = msg;
        status.style.color = color;
    }
}

// ========== INITIALISATION DU LECTEUR ==========
function initPlayer() {
    const audio = document.getElementById('audio-player');
    const viewport = document.getElementById('lyrics-viewport');
    const container = document.getElementById('lyrics-container');

    if (!audio || !viewport || !container) {
        console.warn("Éléments du lecteur introuvables dans le DOM");
        return null;
    }

    lyricsPlayer = new LyricsPlayer(audio, viewport, container);

    // Bouton Play/Pause
    const btnPlay = document.getElementById('btn-play-pause');
    if (btnPlay) {
        btnPlay.addEventListener('click', () => lyricsPlayer.toggle());
    }

    // Mise à jour de l'icône play/pause
    lyricsPlayer.onPlayStateChange = (isPlaying) => {
        if (btnPlay) {
            btnPlay.textContent = isPlaying ? '⏸' : '▶';
            btnPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Lecture');
        }
    };

    // Barre de progression
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');

    lyricsPlayer.onTimeUpdate = (current, total) => {
        if (progressBar && total > 0) {
            progressBar.value = (current / total) * 100;
        }
        if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
        if (durationEl) durationEl.textContent = formatTime(total);
    };

    if (progressBar) {
        progressBar.addEventListener('input', (e) => {
            const percent = parseFloat(e.target.value) / 100;
            const time = percent * (audio.duration || 0);
            lyricsPlayer.seek(time);
        });
    }

    audio.addEventListener('loadedmetadata', () => {
        if (durationEl) durationEl.textContent = formatTime(audio.duration);
    });

    // Offset manuel
    const offsetInput = document.getElementById('offset-input');
    if (offsetInput) {
        offsetInput.addEventListener('change', (e) => {
            lyricsPlayer.setOffset(parseInt(e.target.value, 10) || 0);
        });
    }

    // Déconnexion depuis le lecteur
    const btnLogoutPlayer = document.getElementById('btn-logout-player');
    if (btnLogoutPlayer) {
        btnLogoutPlayer.addEventListener('click', () => {
            import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js")
                .then(({ signOut }) => signOut(auth));
        });
    }

    return lyricsPlayer;
}

// ========== CHARGEMENT D'UNE CHANSON DEPUIS FIRESTORE ==========
export async function loadSong(artist, title) {
    const queryKey = (artist + "_" + title)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 200);

    try {
        const docRef = doc(db, "lyrics", queryKey);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error("Paroles introuvables");
        }

        const data = docSnap.data();

        // Mettre à jour l'interface
        const titleEl = document.getElementById('track-title');
        const artistEl = document.getElementById('track-artist');
        if (titleEl) titleEl.textContent = data.titleOriginal || title;
        if (artistEl) artistEl.textContent = data.artistOriginal || artist;

        // Afficher la section lecteur
        document.getElementById('player-section')?.classList.remove('hidden');
        document.getElementById('upload-section')?.classList.add('hidden');

        // Charger les paroles dans le lecteur
        if (lyricsPlayer) {
            lyricsPlayer.loadLyrics(data.lyricsContent);
        }

        // Charger l'audio si une URL existe
        if (data.audioUrl && lyricsPlayer) {
            lyricsPlayer.loadAudio(data.audioUrl);
        } else {
            setStatus(
                "Paroles chargées. Sélectionnez un fichier audio local pour synchroniser.",
                "#f39c12"
            );
        }

        return data;
    } catch (error) {
        console.error("Erreur chargement:", error);
        setStatus("Erreur : " + error.message, "#e74c3c");
        throw error;
    }
}

// ========== AFFICHAGE SELON L'ÉTAT UTILISATEUR ==========
function updateUI(user) {
    const authSection = document.getElementById('auth-section');
    const verifySection = document.getElementById('verify-section');
    const uploadSection = document.getElementById('upload-section');
    const playerSection = document.getElementById('player-section');

    if (!user) {
        authSection?.classList.remove('hidden');
        verifySection?.classList.add('hidden');
        uploadSection?.classList.add('hidden');
        playerSection?.classList.add('hidden');
        return;
    }

    if (!user.emailVerified) {
        authSection?.classList.add('hidden');
        verifySection?.classList.remove('hidden');
        uploadSection?.classList.add('hidden');
        playerSection?.classList.add('hidden');

        const verifyEmail = document.getElementById('verify-user-email');
        const verifyHighlight = document.getElementById('verify-email-highlight');
        if (verifyEmail) verifyEmail.textContent = user.email;
        if (verifyHighlight) verifyHighlight.textContent = user.email;
        return;
    }

    // Email vérifié → upload + lecteur visibles
    authSection?.classList.add('hidden');
    verifySection?.classList.add('hidden');
    uploadSection?.classList.remove('hidden');
    playerSection?.classList.remove('hidden');

    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
        userEmailEl.title = user.email;
    }
}

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiser le lecteur (DOM prêt)
    initPlayer();

    // 2. Initialiser les modules auth et upload
    initAuth(auth);
    initUpload(auth, db);

    // 3. Écouter l'état de connexion
    onAuthStateChanged(auth, (user) => {
        setStatus("");
        updateUI(user);
    });
});

// ========== ÉVÉNEMENTS CUSTOM ==========

// Après vérification d'email → rafraîchir l'UI
window.addEventListener('user-updated', async () => {
    const user = auth.currentUser;
    if (user) {
        try {
            await reload(user);
            updateUI(user);
        } catch (e) {
            console.error(e);
        }
    }
});

// Après upload réussi → charger automatiquement la chanson
window.addEventListener('lyrics-uploaded', (e) => {
    const { artist, title } = e.detail;
    loadSong(artist, title).catch(err => console.error(err));
});

// ========== EXPOSITION GLOBALE (pour debug) ==========
window.app = {
    loadSong,
    getPlayer: () => lyricsPlayer,
    auth,
    db
};
