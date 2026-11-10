/**
 * main.js — Orchestrateur
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, reload } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initAuth } from './auth.js';
import { initUpload } from './upload.js';

function setStatus(msg, color = '#ffffff') {
    const status = document.getElementById('status');
    if (status) {
        status.innerText = msg;
        status.style.color = color;
    }
}

function updateUI(user) {
    const authSection = document.getElementById('auth-section');
    const verifySection = document.getElementById('verify-section');
    const uploadSection = document.getElementById('upload-section');

    if (!user) {
        authSection?.classList.remove('hidden');
        verifySection?.classList.add('hidden');
        uploadSection?.classList.add('hidden');
        return;
    }

    if (!user.emailVerified) {
        authSection?.classList.add('hidden');
        verifySection?.classList.remove('hidden');
        uploadSection?.classList.add('hidden');

        const verifyEmail = document.getElementById('verify-user-email');
        const verifyHighlight = document.getElementById('verify-email-highlight');
        if (verifyEmail) verifyEmail.textContent = user.email;
        if (verifyHighlight) verifyHighlight.textContent = user.email;
        return;
    }

    authSection?.classList.add('hidden');
    verifySection?.classList.add('hidden');
    uploadSection?.classList.remove('hidden');

    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
        userEmailEl.title = user.email;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("[main] DOM prêt");

    try {
        initAuth(auth);
        console.log("[main] initAuth OK");
    } catch (e) {
        console.error("[main] initAuth a échoué :", e);
    }

    try {
        initUpload(auth, db);
        console.log("[main] initUpload OK");
    } catch (e) {
        console.error("[main] initUpload a échoué :", e);
    }

    onAuthStateChanged(auth, (user) => {
        setStatus("");
        updateUI(user);
    });
});

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

window.app = { auth, db };
