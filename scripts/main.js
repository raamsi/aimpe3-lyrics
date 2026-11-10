import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";
import { getAuth, onAuthStateChanged, signOut, reload } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { LyricsPlayer } from './player.js';
import { initAuth } from './auth.js';
import { initUpload } from './upload.js';

// Config Firebase (identique)
const firebaseConfig = {
    apiKey: "AIzaSyBRGa-C4CBQHOfoU_dVdbqf3HMGMmP7olQ",
    authDomain: "aimpe3-web.firebaseapp.com",
    projectId: "aimpe3-web",
    storageBucket: "aimpe3-web.firebasestorage.app",
    messagingSenderId: "141430245510",
    appId: "1:141430245510:web:c26a4d06a89dd4ede46907"
};

const app = initializeApp(firebaseConfig);
initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('VOTRE_CLE_RECAPTCHA'),
    isTokenAutoRefreshEnabled: true
});

export const auth = getAuth(app);
export const db = getFirestore(app);

// ========== INITIALISATION DU LECTEUR ==========
let lyricsPlayer = null;

function initPlayer() {
    const audio = document.getElementById('audio-player');
    const viewport = document.getElementById('lyrics-viewport');
    const container = document.getElementById('lyrics-container');

    lyricsPlayer = new LyricsPlayer(audio, viewport, container);

    // Bouton Play/Pause
    const btnPlay = document.getElementById('btn-play-pause');
    btnPlay.addEventListener('click', () => lyricsPlayer.toggle());

    // Mise à jour de l'icône play/pause
    lyricsPlayer.onPlayStateChange = (isPlaying) => {
        btnPlay.textContent = isPlaying ? '⏸' : '▶';
        btnPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Lecture');
    };

    // Barre de progression
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');

    lyricsPlayer.onTimeUpdate = (current, total) => {
        if (total > 0) {
            progressBar.value = (current / total) * 100;
        }
        currentTimeEl.textContent = formatTime(current);
        durationEl.textContent = formatTime(total);
    };

    progressBar.addEventListener('input', (e) => {
        const percent = parseFloat(e.target.value) / 100;
        const time = percent * (audio.duration || 0);
        lyricsPlayer.seek(time);
    });

    audio.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(audio.duration);
    });

    // Offset manuel
    const offsetInput = document.getElementById('offset-input');
    offsetInput.addEventListener('change', (e) => {
        lyricsPlayer.setOffset(parseInt(e.target.value, 10) || 0);
    });

    return lyricsPlayer;
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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
        document.getElementById('track-title').textContent = data.titleOriginal || title;
        document.getElementById('track-artist').textContent = data.artistOriginal || artist;
        
        // Afficher la section lecteur
        document.getElementById('player-section').classList.remove('hidden');
        document.getElementById('upload-section').classList.add('hidden');

        // Charger les paroles
        if (lyricsPlayer) {
            lyricsPlayer.loadLyrics(data.lyricsContent);
        }

        // Note : Pour l'audio, il faut une URL. 
        // On suppose que l'utilisateur fournit un fichier audio local
        // ou qu'un champ audioUrl existe dans le document Firestore.
        if (data.audioUrl) {
            lyricsPlayer.loadAudio(data.audioUrl);
        } else {
            document.getElementById('status').textContent = 
                "Paroles chargées. Sélectionnez un fichier audio local pour synchroniser.";
        }

        return data;
    } catch (error) {
        console.error("Erreur chargement:", error);
        throw error;
    }
}

// ========== NAVIGATION ==========
// Exposer les fonctions globalement pour les modules auth/upload
window.app = { loadSong, lyricsPlayer: () => lyricsPlayer };

// ========== AUTH STATE ==========
onAuthStateChanged(auth, (user) => {
    const authSection = document.getElementById('auth-section');
    const verifySection = document.getElementById('verify-section');
    const uploadSection = document.getElementById('upload-section');
    const playerSection = document.getElementById('player-section');

    if (!user) {
        authSection.classList.remove('hidden');
        verifySection.classList.add('hidden');
        uploadSection.classList.add('hidden');
        playerSection.classList.add('hidden');
        return;
    }

    if (!user.emailVerified) {
        authSection.classList.add('hidden');
        verifySection.classList.remove('hidden');
        uploadSection.classList.add('hidden');
        playerSection.classList.add('hidden');
        document.getElementById('verify-user-email').textContent = user.email;
        document.getElementById('verify-email-highlight').textContent = user.email;
        return;
    }

    // Email vérifié → afficher upload + lecteur
    authSection.classList.add('hidden');
    verifySection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    playerSection.classList.remove('hidden');
    document.getElementById('user-email').textContent = user.email;
});

// Initialiser le lecteur au chargement
document.addEventListener('DOMContentLoaded', () => {
    initPlayer();
});
