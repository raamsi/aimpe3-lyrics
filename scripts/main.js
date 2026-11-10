/**
 * main.js — Orchestrateur principal
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, reload, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { LyricsPlayer } from './player.js';
import { initAuth } from './auth.js';
import { initUpload } from './upload.js';

let lyricsPlayer = null;

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

    // ✅ Sélecteur de fichier audio local
    const audioFileInput = document.getElementById('audio-file');
    if (audioFileInput) {
        audioFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                lyricsPlayer.loadAudio(url);
                setStatus("Fichier audio chargé. Cliquez sur ▶ pour démarrer.", "#1DB954");
            }
        });
    }

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

export async function loadSong(artist, title) {
    const queryKey = (artist + "_" + title)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 200);

    try {
        const docRef = doc(db, "lyrics",
