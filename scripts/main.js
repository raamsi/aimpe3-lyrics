/**
 * main.js — Orchestrateur principal
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, reload, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { LyricsPlayer } from './player.js';
import { initAuth } from './auth.js';
import { initUpload } from './upload.js';

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
        console.warn("Éléments du lecteur introuvables");
        return null;
    }

    lyricsPlayer = new LyricsPlayer(audio, viewport, container);

    const btnPlay = document.getElementById('btn-play-pause');
    if (btnPlay) {
        btnPlay.addEventListener('click', () => lyricsPlayer.toggle());
    }

    lyricsPlayer.onPlayStateChange = (isPlaying) => {
        if (btnPlay) {
            btnPlay.textContent = isPlaying ? '⏸' : '▶';
            btnPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Lecture');
        }
    };

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

    const offsetInput = document.getElementById('offset-input');
    if (offsetInput) {
        offsetInput.addEventListener('change', (e) => {
            lyricsPlayer.setOffset(parseInt(e.target.value, 10) || 0);
        });
    }

    const btnLogoutPlayer = document.getElementById('btn-logout-player');
    if (btnLogoutPlayer) {
        btnLogoutPlayer.addEventListener('click', () => signOut(auth));
    }

    return lyricsPlayer;
}

// ========== CHARGEMENT D'UNE CHANSON ==========
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

        const titleEl = document.getElementById('track-title');
        const artistEl = document.getElementById('track-artist');
        if (titleEl) titleEl.textContent = data.titleOriginal || title;
        if (artistEl) artistEl.textContent = data.artistOriginal || artist;

        document.getElementById('player-section')?.classList.remove('hidden');
        document.getElementById('upload-section')?.classList.add('hidden');

        if (lyricsPlayer) {
            lyricsPlayer.loadLyrics(data.lyricsContent);
        }

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

// ========== UI SELON ÉTAT UTILISATEUR ==========
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

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    initPlayer();
    initAuth(auth);
    initUpload(auth, db);

    onAuthStateChanged(auth, (user) => {
        setStatus("");
        updateUI(user);
    });
});

// ========== ÉVÉNEMENTS CUSTOM ==========
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

window.addEventListener('lyrics-uploaded', (e) => {
    const { artist, title } = e.detail;
    loadSong(artist, title).catch(err => console.error(err));
});

// ========== DEBUG ==========
window.app = {
    loadSong,
    getPlayer: () => lyricsPlayer,
    auth,
    db
};
