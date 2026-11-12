/**
 * main.js : orchestrateur (état de connexion, menu compte, raccourcis)
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, reload } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { $, on } from './utils.js';
import { initAuth } from './auth.js';
import { initCatalog } from './catalog.js';
import { initUpload } from './upload.js';

let catalog;
let upload;
let lastKey = null;

const authApi = initAuth(auth);

catalog = initCatalog(auth, db, {
    openAuth: (mode) => authApi.open(mode),
    openUpload: () => upload.open()
});

upload = initUpload(auth, db, {
    openAuth: (mode) => authApi.open(mode),
    onPublished: () => catalog.load()
});

/* ---------- Interface selon l'utilisateur ---------- */
function updateUI(user) {
    const loggedIn = Boolean(user);

    $('btn-open-login').classList.toggle('hidden', loggedIn);
    $('account-menu').classList.toggle('hidden', !loggedIn);
    $('verify-banner').classList.toggle('hidden', !(user && !user.emailVerified));

    if (user) {
        $('user-email').textContent = user.email || '';
        $('btn-account').textContent = (user.email || '?').trim()[0] || '?';
        $('verify-email-highlight').textContent = user.email || '';
    } else {
        closeMenu();
    }
}

/** Recharge le répertoire seulement si l'état de connexion a réellement changé. */
function syncCatalog(user) {
    const key = user ? `${user.uid}:${user.emailVerified}` : 'anon';
    if (key !== lastKey) {
        lastKey = key;
        catalog.load();
    }
}

onAuthStateChanged(auth, (user) => {
    updateUI(user);
    authApi.watchVerification(user);
    syncCatalog(user);
});

window.addEventListener('user-updated', async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await reload(user);
    } catch (e) {
        console.error(e);
    }
    updateUI(user);
    authApi.watchVerification(user);
    syncCatalog(user);
});

/* ---------- Menu du compte ---------- */
const popover = $('account-popover');
const accountBtn = $('btn-account');

function closeMenu() {
    popover.classList.add('hidden');
    accountBtn.setAttribute('aria-expanded', 'false');
}

on('btn-account', 'click', (event) => {
    event.stopPropagation();
    const willOpen = popover.classList.contains('hidden');
    popover.classList.toggle('hidden', !willOpen);
    accountBtn.setAttribute('aria-expanded', String(willOpen));
});

document.addEventListener('click', (event) => {
    if (!popover.classList.contains('hidden') && !$('account-menu').contains(event.target)) closeMenu();
});

/* ---------- Divers ---------- */
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();

    // « / » place le curseur dans la recherche
    const tag = (event.target.tagName || '').toLowerCase();
    if (event.key === '/' && !['input', 'textarea', 'select'].includes(tag)
        && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        $('catalog-search').focus();
    }
});

const topbar = $('topbar');
window.addEventListener('scroll', () => {
    topbar.classList.toggle('scrolled', window.scrollY > 8);
}, { passive: true });

$('year').textContent = String(new Date().getFullYear());

window.app = { auth, db };
