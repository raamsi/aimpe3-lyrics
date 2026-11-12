<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#0a0b0e">
    <meta name="description" content="Bibliothèque de paroles synchronisées (.lrc) pour AimpE3 : recherchez, prévisualisez et téléchargez.">
    <title>AimpE3 Lyrics · Paroles synchronisées à télécharger</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
    <link rel="stylesheet" href="styles/main.css">
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🎵%3C/text%3E%3C/svg%3E">
</head>
<body>

<!-- Icônes (sprite) -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></symbol>
    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></symbol>
    <symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></symbol>
    <symbol id="i-refresh" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></symbol>
    <symbol id="i-file-text" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></symbol>
    <symbol id="i-music" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></symbol>
    <symbol id="i-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="i-mail" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></symbol>
    <symbol id="i-inbox" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></symbol>
</svg>

<div class="bg-glow" aria-hidden="true"></div>

<!-- ========== BARRE DU HAUT ========== -->
<header class="topbar" id="topbar">
    <div class="topbar-inner">
        <a class="brand" href="./" aria-label="AimpE3 Lyrics, accueil">
            <span class="brand-mark"><svg class="icon"><use href="#i-music"/></svg></span>
            <span class="brand-name">AimpE3 <b>Lyrics</b></span>
        </a>

        <div class="search-box">
            <svg class="icon"><use href="#i-search"/></svg>
            <input type="search" id="catalog-search" placeholder="Rechercher un artiste ou un titre…" autocomplete="off" spellcheck="false" aria-label="Rechercher dans le répertoire">
            <kbd aria-hidden="true">/</kbd>
        </div>

        <div class="topbar-actions">
            <button type="button" class="btn btn-primary" id="btn-open-upload">
                <svg class="icon"><use href="#i-upload"/></svg><span class="btn-label">Publier</span>
            </button>
            <button type="button" class="btn btn-ghost" id="btn-open-login">Se connecter</button>

            <div class="account hidden" id="account-menu">
                <button type="button" class="avatar" id="btn-account" aria-haspopup="true" aria-expanded="false" aria-label="Mon compte">?</button>
                <div class="menu hidden" id="account-popover" role="menu">
                    <div class="menu-label">Connecté en tant que</div>
                    <div class="menu-email" id="user-email">—</div>
                    <button type="button" class="menu-item" id="btn-logout" role="menuitem">Se déconnecter</button>
                </div>
            </div>
        </div>
    </div>
</header>

<!-- ========== BANDEAU DE VÉRIFICATION E-MAIL ========== -->
<div class="verify-banner hidden" id="verify-banner" role="status">
    <div class="verify-inner">
        <svg class="icon"><use href="#i-mail"/></svg>
        <p>Vérifiez votre e-mail <strong id="verify-email-highlight">—</strong> pour publier et accéder au répertoire.</p>
        <div class="verify-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-resend">Renvoyer</button>
            <button type="button" class="btn btn-primary btn-sm" id="btn-check-verified">J'ai vérifié</button>
        </div>
    </div>
</div>

<!-- ========== PAGE ========== -->
<main class="page">

    <section class="hero">
        <p class="eyebrow">Bibliothèque communautaire</p>
        <h1>Des paroles <span class="grad">synchronisées</span>,<br>prêtes pour votre lecteur.</h1>
        <p class="lead">Recherchez un titre, prévisualisez les paroles ligne par ligne et téléchargez le fichier <code>.lrc</code> en un geste.</p>
        <div class="stats">
            <div><strong id="stat-count">—</strong><span>paroles</span></div>
            <div><strong id="stat-artists">—</strong><span>artistes</span></div>
        </div>
    </section>

    <section class="catalog" aria-labelledby="catalog-title">
        <div class="catalog-head">
            <div>
                <h2 id="catalog-title">Répertoire</h2>
                <p class="result-count" id="result-count" aria-live="polite"></p>
            </div>
            <div class="catalog-tools">
                <label class="select">
                    <span class="sr-only">Trier par</span>
                    <select id="catalog-sort">
                        <option value="recent">Plus récents</option>
                        <option value="artist">Artiste (A → Z)</option>
                        <option value="title">Titre (A → Z)</option>
                        <option value="duration">Plus longs</option>
                    </select>
                </label>
                <button type="button" class="btn btn-ghost btn-icon" id="btn-load-catalog" aria-label="Actualiser la liste" title="Actualiser">
                    <svg class="icon"><use href="#i-refresh"/></svg>
                </button>
            </div>
        </div>

        <div id="catalog-grid" class="grid"></div>
        <div id="catalog-state" class="state hidden"></div>
        <div class="more-wrap"><button type="button" class="btn btn-secondary hidden" id="btn-more">Afficher plus</button></div>
    </section>
</main>

<footer class="footer">
    <p>© <span id="year"></span> AimpE3 · Fichiers <code>.lrc</code> partagés par la communauté</p>
</footer>

<noscript><p class="noscript">JavaScript est nécessaire pour utiliser ce site.</p></noscript>

<!-- ========== FENÊTRE : PAROLES ========== -->
<dialog id="detail-dialog" class="dialog dialog-lg" aria-labelledby="detail-title">
    <div class="dialog-head">
        <div class="cover" id="detail-cover" aria-hidden="true"><span></span></div>
        <div class="dialog-titles">
            <h3 id="detail-title">—</h3>
            <p id="detail-artist">—</p>
            <div class="chips" id="detail-chips"></div>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Fermer"><svg class="icon"><use href="#i-x"/></svg></button>
    </div>
    <ol class="lyrics-view" id="detail-lines"></ol>
    <div class="dialog-foot">
        <button type="button" class="btn btn-primary" id="detail-dl-lrc"><svg class="icon"><use href="#i-download"/></svg>Télécharger .lrc</button>
        <button type="button" class="btn btn-secondary" id="detail-dl-txt"><svg class="icon"><use href="#i-file-text"/></svg>Texte (.txt)</button>
        <button type="button" class="btn btn-ghost" id="detail-copy"><svg class="icon"><use href="#i-copy"/></svg>Copier</button>
    </div>
</dialog>

<!-- ========== FENÊTRE : CONNEXION / INSCRIPTION ========== -->
<dialog id="auth-dialog" class="dialog dialog-sm" aria-labelledby="auth-title">
    <form id="auth-form" novalidate>
        <div class="dialog-head simple">
            <h3 id="auth-title">Connexion</h3>
            <button type="button" class="icon-btn" data-close aria-label="Fermer"><svg class="icon"><use href="#i-x"/></svg></button>
        </div>

        <div class="dialog-body">
            <div class="tabs" role="tablist">
                <button type="button" role="tab" id="tab-login" aria-selected="true">Connexion</button>
                <button type="button" role="tab" id="tab-signup" aria-selected="false">Inscription</button>
            </div>

            <label class="field">
                <span>Adresse e-mail</span>
                <input type="email" id="email" autocomplete="email" placeholder="vous@exemple.com">
            </label>

            <label class="field">
                <span>Mot de passe</span>
                <div class="pw">
                    <input type="password" id="password" autocomplete="current-password" placeholder="••••••••••••">
                    <button type="button" class="pw-toggle" id="pw-toggle" aria-label="Afficher le mot de passe"><svg class="icon"><use href="#i-eye"/></svg></button>
                </div>
            </label>

            <div id="signup-extra" class="hidden">
                <div class="strength"><div id="strength-bar" class="strength-bar"></div></div>
                <ul class="reqs" id="pwd-reqs">
                    <li data-req="length">12 caractères min.</li>
                    <li data-req="upper">Une majuscule</li>
                    <li data-req="lower">Une minuscule</li>
                    <li data-req="digit">Un chiffre</li>
                    <li data-req="special">Un caractère spécial</li>
                </ul>
                <label class="field">
                    <span>Confirmer le mot de passe</span>
                    <input type="password" id="password-confirm" autocomplete="new-password" placeholder="••••••••••••">
                </label>
            </div>

            <p class="form-msg" id="auth-msg" role="alert"></p>
        </div>

        <div class="dialog-foot single">
            <button type="submit" class="btn btn-primary btn-block" id="btn-auth">Se connecter</button>
        </div>
    </form>
</dialog>

<!-- ========== FENÊTRE : PUBLIER ========== -->
<dialog id="upload-dialog" class="dialog dialog-md" aria-labelledby="upload-title">
    <div class="dialog-head simple">
        <h3 id="upload-title">Publier des paroles</h3>
        <button type="button" class="icon-btn" data-close aria-label="Fermer"><svg class="icon"><use href="#i-x"/></svg></button>
    </div>

    <div class="dialog-body">
        <label class="dropzone" id="dropzone" for="fileInput">
            <svg class="icon icon-lg"><use href="#i-upload"/></svg>
            <strong id="dropzone-title">Déposez votre fichier .lrc</strong>
            <span id="dropzone-hint">ou touchez pour parcourir · 500 Ko maximum</span>
            <input type="file" id="fileInput" accept=".lrc,text/plain" hidden>
        </label>

        <div id="upload-form" class="hidden">
            <div class="two-col">
                <label class="field"><span>Artiste</span><input type="text" id="up-artist" maxlength="100" autocomplete="off"></label>
                <label class="field"><span>Titre</span><input type="text" id="up-title" maxlength="150" autocomplete="off"></label>
            </div>
            <div class="preview">
                <div class="preview-head"><strong id="preview-count">0</strong> lignes synchronisées <span id="preview-duration"></span></div>
                <ul id="preview-list" class="preview-list"></ul>
            </div>
        </div>

        <p class="form-msg" id="upload-msg" role="alert"></p>
    </div>

    <div class="dialog-foot">
        <button type="button" class="btn btn-ghost" data-close>Annuler</button>
        <button type="button" class="btn btn-primary" id="btn-upload" disabled>Publier</button>
    </div>
</dialog>

<div id="toasts" class="toasts" aria-live="polite"></div>

<script type="module" src="scripts/main.js"></script>
</body>
</html>
