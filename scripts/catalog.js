/**
 * catalog.js : répertoire (cartes), recherche, tri, aperçu des paroles et téléchargements
 */

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    $, on, icon, toast, debounce, normalize, maskEmail, hueFromString,
    formatDuration, getLines, getLyricsContent, getPlainText,
    safeFileName, downloadFile, openDialog, setupDialog
} from './utils.js';

const PAGE_SIZE = 24;

const artistOf = (d) => d.artistOriginal || d.artist || 'Artiste inconnu';
const titleOf = (d) => d.titleOriginal || d.title || 'Sans titre';
const linesCountOf = (d) => d.timestampCount ?? (d.timestamps?.length || 0);
const timeOf = (d) => d.updatedAt?.toMillis?.() ?? (d.updatedAt instanceof Date ? d.updatedAt.getTime() : 0);

const collator = new Intl.Collator('fr', { sensitivity: 'base' });
const sorters = {
    recent: (a, b) => timeOf(b) - timeOf(a),
    artist: (a, b) => collator.compare(artistOf(a), artistOf(b)) || collator.compare(titleOf(a), titleOf(b)),
    title: (a, b) => collator.compare(titleOf(a), titleOf(b)) || collator.compare(artistOf(a), artistOf(b)),
    duration: (a, b) => (Number(b.duration) || 0) - (Number(a.duration) || 0)
};

function setCover(el, artist) {
    el.style.setProperty('--h', String(hueFromString(artist)));
    const letter = el.querySelector('span');
    if (letter) letter.textContent = (artist.trim()[0] || '♪').toUpperCase();
}

function makeChip(text) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = text;
    return chip;
}

export function initCatalog(auth, db, hooks) {
    let docs = [];
    let view = [];
    let visible = PAGE_SIZE;
    let term = '';
    let sortKey = 'recent';
    let loading = false;
    let loaded = false;
    let current = null;

    const grid = $('catalog-grid');
    const stateEl = $('catalog-state');
    const moreBtn = $('btn-more');
    const refreshBtn = $('btn-load-catalog');
    const resultCount = $('result-count');
    const detail = $('detail-dialog');
    setupDialog(detail);

    // ---------- Téléchargements ----------
    function fileBase(d) {
        return `${safeFileName(artistOf(d))} - ${safeFileName(titleOf(d))}`;
    }

    function downloadLrc(d) {
        const content = getLyricsContent(d);
        if (!content) {
            toast("Le contenu de ces paroles n'est pas disponible.", 'error');
            return;
        }
        downloadFile(content, `${fileBase(d)}.lrc`);
        toast(`« ${titleOf(d)} » téléchargé (.lrc).`, 'success');
    }

    function downloadTxt(d) {
        const text = getPlainText(d);
        if (!text) {
            toast("Le contenu de ces paroles n'est pas disponible.", 'error');
            return;
        }
        downloadFile(text, `${fileBase(d)}.txt`);
        toast(`« ${titleOf(d)} » téléchargé (.txt).`, 'success');
    }

    async function copyText(d) {
        const text = getPlainText(d);
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            area.remove();
        }
        toast('Paroles copiées dans le presse-papiers.', 'success');
    }

    // ---------- Aperçu ----------
    function openDetail(d) {
        current = d;
        const artist = artistOf(d);

        setCover($('detail-cover'), artist);
        $('detail-title').textContent = titleOf(d);
        $('detail-artist').textContent = artist;

        const chips = $('detail-chips');
        chips.replaceChildren(
            makeChip(formatDuration(d.duration)),
            makeChip(`${linesCountOf(d)} lignes`),
            makeChip(`Par ${maskEmail(d.ownerEmail)}`)
        );

        const list = $('detail-lines');
        const lines = getLines(d);
        list.replaceChildren();
        if (lines.length === 0) {
            const li = document.createElement('li');
            li.textContent = "Aperçu indisponible pour ce fichier.";
            list.appendChild(li);
        } else {
            const frag = document.createDocumentFragment();
            lines.forEach((line) => {
                const li = document.createElement('li');
                const ts = document.createElement('span');
                ts.className = 'ts';
                const m = Math.floor(line.time / 60);
                const s = Math.floor(line.time % 60);
                ts.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                const tx = document.createElement('span');
                tx.className = 'tx';
                tx.textContent = line.text;
                li.append(ts, tx);
                frag.appendChild(li);
            });
            list.appendChild(frag);
        }
        list.scrollTop = 0;
        openDialog(detail);
    }

    on('detail-dl-lrc', 'click', () => current && downloadLrc(current));
    on('detail-dl-txt', 'click', () => current && downloadTxt(current));
    on('detail-copy', 'click', () => current && copyText(current));

    // ---------- Cartes ----------
    function buildCard(d, index) {
        const artist = artistOf(d);
        const title = titleOf(d);

        const card = document.createElement('article');
        card.className = 'card';
        card.style.animationDelay = `${Math.min(index, 12) * 25}ms`;

        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'card-main';
        main.setAttribute('aria-label', `Voir les paroles de ${title} par ${artist}`);
        main.addEventListener('click', () => openDetail(d));

        const cover = document.createElement('span');
        cover.className = 'cover';
        cover.appendChild(document.createElement('span'));
        setCover(cover, artist);

        const info = document.createElement('span');
        info.className = 'card-info';
        const t = document.createElement('span');
        t.className = 'card-title';
        t.textContent = title;
        t.title = title;
        const a = document.createElement('span');
        a.className = 'card-artist';
        a.textContent = artist;
        a.title = artist;
        const chips = document.createElement('span');
        chips.className = 'chips';
        chips.append(makeChip(formatDuration(d.duration)), makeChip(`${linesCountOf(d)} lignes`));
        info.append(t, a, chips);
        main.append(cover, info);

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'btn btn-primary btn-sm';
        dl.append(icon('download'), document.createTextNode('Télécharger .lrc'));
        dl.setAttribute('aria-label', `Télécharger ${title} de ${artist} au format LRC`);
        dl.addEventListener('click', () => downloadLrc(d));

        const txt = document.createElement('button');
        txt.type = 'button';
        txt.className = 'btn btn-secondary btn-sm';
        txt.append(icon('file-text'), document.createTextNode('.txt'));
        txt.setAttribute('aria-label', `Télécharger ${title} de ${artist} en texte`);
        txt.addEventListener('click', () => downloadTxt(d));

        actions.append(dl, txt);
        card.append(main, actions);
        return card;
    }

    function showSkeleton() {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 8; i++) {
            const card = document.createElement('div');
            card.className = 'card skeleton';
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:14px;align-items:center';
            const cover = document.createElement('div');
            cover.className = 'sk';
            cover.style.cssText = 'width:68px;height:68px;border-radius:16px;flex:none';
            const lines = document.createElement('div');
            lines.style.cssText = 'flex:1;display:grid;gap:8px';
            [70, 45, 30].forEach((w) => {
                const l = document.createElement('div');
                l.className = 'sk';
                l.style.cssText = `height:12px;width:${w}%`;
                lines.appendChild(l);
            });
            row.append(cover, lines);
            const btn = document.createElement('div');
            btn.className = 'sk';
            btn.style.cssText = 'height:36px;border-radius:999px';
            card.append(row, btn);
            frag.appendChild(card);
        }
        grid.replaceChildren(frag);
    }

    // ---------- États (vide, verrouillé, erreur) ----------
    function showState({ iconName, title, text, actions = [] }) {
        stateEl.replaceChildren();
        stateEl.appendChild(icon(iconName));
        const h = document.createElement('h3');
        h.textContent = title;
        const p = document.createElement('p');
        p.textContent = text;
        stateEl.append(h, p);

        if (actions.length) {
            const wrap = document.createElement('div');
            wrap.className = 'state-actions';
            actions.forEach(({ label, onClick, primary }) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `btn ${primary ? 'btn-primary' : 'btn-ghost'}`;
                b.textContent = label;
                b.addEventListener('click', onClick);
                wrap.appendChild(b);
            });
            stateEl.appendChild(wrap);
        }
        stateEl.classList.remove('hidden');
    }

    const hideState = () => stateEl.classList.add('hidden');

    function showLocked() {
        const user = auth.currentUser;
        if (!user) {
            showState({
                iconName: 'lock',
                title: 'Répertoire réservé aux membres',
                text: 'Connectez-vous pour parcourir les paroles et les télécharger.',
                actions: [
                    { label: 'Se connecter', primary: true, onClick: () => hooks.openAuth('login') },
                    { label: 'Créer un compte', onClick: () => hooks.openAuth('signup') }
                ]
            });
        } else if (!user.emailVerified) {
            showState({
                iconName: 'mail',
                title: 'Vérifiez votre e-mail',
                text: "Confirmez votre adresse via le lien reçu pour accéder au répertoire."
            });
        } else {
            showState({
                iconName: 'alert',
                title: 'Accès refusé',
                text: 'Vérifiez les règles Firestore de la collection « lyrics ».',
                actions: [{ label: 'Réessayer', onClick: () => load() }]
            });
        }
    }

    // ---------- Affichage ----------
    function updateStats() {
        $('stat-count').textContent = loaded ? String(docs.length) : '—';
        $('stat-artists').textContent = loaded
            ? String(new Set(docs.map((d) => normalize(artistOf(d)))).size)
            : '—';
    }

    function applyView(resetPage = true) {
        if (resetPage) visible = PAGE_SIZE;

        const needle = normalize(term).trim();
        view = docs.filter((d) => {
            if (!needle) return true;
            return normalize(`${artistOf(d)} ${titleOf(d)}`).includes(needle);
        });
        view.sort(sorters[sortKey] || sorters.recent);

        grid.replaceChildren(...view.slice(0, visible).map(buildCard));

        if (!loaded) {
            resultCount.textContent = '';
        } else if (needle) {
            resultCount.textContent = `${view.length} résultat${view.length > 1 ? 's' : ''} pour « ${term.trim()} »`;
        } else {
            resultCount.textContent = `${view.length} paroles disponibles`;
        }

        if (loaded && docs.length === 0) {
            showState({
                iconName: 'inbox',
                title: 'Aucune parole pour le moment',
                text: 'Soyez le premier à publier un fichier .lrc.',
                actions: [{ label: 'Publier des paroles', primary: true, onClick: () => hooks.openUpload() }]
            });
        } else if (loaded && view.length === 0) {
            showState({
                iconName: 'search',
                title: 'Aucun résultat',
                text: `Aucune parole ne correspond à « ${term.trim()} ».`
            });
        } else {
            hideState();
        }

        const remaining = view.length - visible;
        moreBtn.classList.toggle('hidden', remaining <= 0);
        if (remaining > 0) moreBtn.textContent = `Afficher plus (${remaining})`;
    }

    // ---------- Chargement ----------
    async function load() {
        if (loading) return;
        loading = true;
        hideState();
        showSkeleton();
        moreBtn.classList.add('hidden');
        refreshBtn.disabled = true;
        refreshBtn.classList.add('is-spinning');

        try {
            const snapshot = await getDocs(collection(db, 'lyrics'));
            docs = [];
            snapshot.forEach((s) => docs.push({ id: s.id, ...s.data() }));
            loaded = true;
            updateStats();
            applyView(true);
        } catch (error) {
            console.error('[catalog] Erreur :', error);
            docs = [];
            loaded = false;
            grid.replaceChildren();
            updateStats();
            resultCount.textContent = '';

            if (error.code === 'permission-denied') {
                showLocked();
            } else {
                showState({
                    iconName: 'alert',
                    title: 'Chargement impossible',
                    text: 'Vérifiez votre connexion puis réessayez.',
                    actions: [{ label: 'Réessayer', primary: true, onClick: () => load() }]
                });
            }
        } finally {
            loading = false;
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('is-spinning');
        }
    }

    // ---------- Événements ----------
    on('catalog-search', 'input', debounce((e) => {
        term = e.target.value;
        if (loaded) applyView(true);
    }, 120));

    on('catalog-sort', 'change', (e) => {
        sortKey = e.target.value;
        if (loaded) applyView(true);
    });

    on('btn-more', 'click', () => {
        visible += PAGE_SIZE;
        applyView(false);
    });

    on('btn-load-catalog', 'click', () => load());

    return { load };
}
