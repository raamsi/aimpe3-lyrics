/**
 * utils.js : fonctions partagées (DOM, notifications, LRC, téléchargements)
 */

export const $ = (id) => document.getElementById(id);

export function on(id, event, handler, options) {
    const el = $(id);
    if (!el) {
        console.warn(`[ui] Élément #${id} introuvable`);
        return null;
    }
    el.addEventListener(event, handler, options);
    return el;
}

/** Crée une icône à partir du sprite défini dans index.html. */
export function icon(name, extraClass = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `icon ${extraClass}`.trim());
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.appendChild(use);
    return svg;
}

/** Notification discrète (type : info | success | error | warn). */
export function toast(message, type = 'info', duration = 4200) {
    const host = $('toasts');
    if (!host) return;

    while (host.children.length >= 3) host.firstElementChild.remove();

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const dot = document.createElement('span');
    dot.className = 'toast-dot';
    const text = document.createElement('span');
    text.textContent = message;
    el.append(dot, text);
    host.appendChild(el);

    requestAnimationFrame(() => el.classList.add('show'));

    const remove = () => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 260);
    };
    el.addEventListener('click', remove);
    setTimeout(remove, duration);
}

/* ---------- Fenêtres <dialog> ---------- */

export function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
}

export function setupDialog(dialog) {
    dialog.querySelectorAll('[data-close]').forEach((btn) => {
        btn.addEventListener('click', () => dialog.close());
    });

    // Clic sur le fond sombre = fermer
    dialog.addEventListener('click', (event) => {
        const r = dialog.getBoundingClientRect();
        const inside = event.clientX >= r.left && event.clientX <= r.right
            && event.clientY >= r.top && event.clientY <= r.bottom;
        if (!inside) dialog.close();
    });

    dialog.addEventListener('close', () => {
        if (!document.querySelector('dialog[open]')) {
            document.body.classList.remove('modal-open');
        }
    });
}

/* ---------- Divers ---------- */

export function debounce(fn, delay = 150) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/** Masque une adresse e-mail : ra***@gmail.com */
export function maskEmail(email) {
    if (!email || !email.includes('@')) return '—';
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
}

/** Teinte (0-359) stable à partir d'un texte, pour les pochettes colorées. */
export function hueFromString(str) {
    let hash = 0;
    for (const ch of String(str || '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    return hash % 360;
}

export function normalize(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase();
}

/* ---------- LRC ---------- */

export function formatTime(seconds) {
    if (seconds == null || isNaN(seconds)) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.round((seconds - Math.floor(seconds)) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(Math.min(cs, 99)).padStart(2, '0')}`;
}

export function formatDuration(seconds) {
    if (seconds == null || isNaN(seconds)) return '—';
    const total = Math.round(Number(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Analyse un fichier LRC : tableau de { time, text } ou null si aucun timestamp.
 */
export function parseLrc(lrcText) {
    const lines = [];
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    const metaRegex = /^\[(ti|ar|al|by|offset|length|re|ve):(.+)\]$/i;

    for (const rawLine of String(lrcText || '').split(/\r?\n/)) {
        const trimmed = rawLine.trim();
        if (!trimmed || metaRegex.test(trimmed)) continue;

        const timestamps = [];
        let match;
        timeRegex.lastIndex = 0;
        while ((match = timeRegex.exec(trimmed)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            let ms = 0;
            if (match[3]) {
                if (match[3].length === 1) ms = parseInt(match[3], 10) * 100;
                else if (match[3].length === 2) ms = parseInt(match[3], 10) * 10;
                else ms = parseInt(match[3], 10);
            }
            timestamps.push(minutes * 60 + seconds + ms / 1000);
        }
        if (timestamps.length === 0) continue;

        const text = trimmed.replace(timeRegex, '').trim();
        if (!text) continue;
        for (const time of timestamps) lines.push({ time, text });
    }

    if (lines.length === 0) return null;
    lines.sort((a, b) => a.time - b.time);

    const deduped = [];
    for (const line of lines) {
        const last = deduped[deduped.length - 1];
        if (!last || Math.abs(last.time - line.time) > 0.01) deduped.push(line);
    }
    return deduped;
}

export function safeFileName(value) {
    return String(value || '')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .trim()
        .replace(/[. ]+$/g, '')
        .slice(0, 150) || 'lyrics';
}

/** Contenu .lrc d'une fiche (nouveaux documents, ou reconstruit pour les anciens). */
export function getLyricsContent(data) {
    if (typeof data.lyricsContent === 'string' && data.lyricsContent.length > 0) {
        return data.lyricsContent;
    }
    if (Array.isArray(data.timestamps) && data.timestamps.length > 0) {
        return data.timestamps
            .filter((line) => Number.isFinite(Number(line.time)))
            .map((line) => `[${formatTime(Number(line.time))}]${line.text || ''}`)
            .join('\n');
    }
    return '';
}

/** Lignes (time + text) d'une fiche. */
export function getLines(data) {
    return parseLrc(getLyricsContent(data)) || [];
}

/** Paroles seules, sans les timestamps. */
export function getPlainText(data) {
    return getLines(data).map((l) => l.text).join('\n');
}

export function downloadFile(content, filename, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
