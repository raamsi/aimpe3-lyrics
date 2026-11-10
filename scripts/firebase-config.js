/**
 * firebase-config.js
 * Initialise Firebase + App Check et exporte auth, db
 * Ce fichier est importé par main.js, auth.js, upload.js
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ========== CONFIG FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyBRGa-C4CBQHOfoU_dVdbqf3HMGMmP7olQ",
    authDomain: "aimpe3-web.firebaseapp.com",
    projectId: "aimpe3-web",
    storageBucket: "aimpe3-web.firebasestorage.app",
    messagingSenderId: "141430245510",
    appId: "1:141430245510:web:c26a4d06a89dd4ede46907"
};

// ========== INITIALISATION ==========
const app = initializeApp(firebaseConfig);

// ✅ App Check — AVANT getAuth / getFirestore
initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('VOTRE_CLE_DE_SITE_RECAPTCHA_V3'),
    isTokenAutoRefreshEnabled: true
});

// ========== EXPORTS ==========
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
