/**
 * upload.js : publication d'un fichier .lrc (validation, aperçu, modification artiste/titre)
 */

import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { $, on, toast, parseLrc, formatTime, formatDuration, openDialog, setupDialog } from './utils.js';

const MAX_FILE_SIZE = 500 * 1024;

// Retire les termes parasites d'un nom de fichier (même logique qu'avant)
const cleanText = (text) => text
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/official video|lyrics|audio|clip officiel|mp3|\b\d{2,3}kbps\b/gi, '')
    .trim();

export function initUpload(auth, db, hooks) {
    const dialog = $('upload-dialog');
    setupDialog(dialog);

    let validated = null; // { file, lines, content }

    const msg = (text = '', type = 'error') => {
        const el = $('upload-msg');
        if (!el) return;
        el.textContent = text;
        el.className = `form-msg ${text ? type : ''}`.trim();
    };

    function reset() {
        validated = null;
        $('fileInput').value = '';
        $('upload-form').classList.add('hidden');
        $('preview-list').replaceChildren();
        $('up-artist').value = '';
        $('up-title').value = '';
        $('btn-upload').disabled = true;
        $('btn-upload').textContent = 'Publier';
        $('dropzone').classList.remove('has-file', 'is-drag');
        $('dropzone-title').textContent = 'Déposez votre fichier .lrc';
        $('dropzone-hint').textContent = 'ou touchez pour parcourir · 500 Ko maximum';
        msg('');
    }

    function open() {
        const user = auth.currentUser;
        if (!user) {
            toast('Connectez-vous pour publier des paroles.', 'info');
            hooks.openAuth('login');
            return;
        }
        if (!user.emailVerified) {
            toast('Vérifiez votre e-mail avant de publier.', 'warn');
            return;
        }
        reset();
        openDialog(dialog);
    }

    function refreshPublishButton() {
        const artist = $('up-artist').value.trim();
        const title = $('up-title').value.trim();
        $('btn-upload').disabled = !(validated && artist && title);
    }

    // ---------- Lecture et validation du fichier ----------
    function handleFile(file) {
        validated = null;
        $('upload-form').classList.add('hidden');
        $('btn-upload').disabled = true;
        msg('');

        if (!file) return;
        if (!/\.lrc$/i.test(file.name)) { msg('Seuls les fichiers .lrc sont acceptés.'); return; }
        if (file.size > MAX_FILE_SIZE) { msg(`Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024} Ko).`); return; }
        if (file.size === 0) { msg('Le fichier est vide.'); return; }

        const reader = new FileReader();
        reader.onerror = () => msg('Impossible de lire le fichier.');
        reader.onload = (e) => {
            const content = e.target.result;
            if (typeof content !== 'string' || content.length === 0) {
                msg('Contenu du fichier invalide.');
                return;
            }

            const lines = parseLrc(content);
            if (!lines || lines.length === 0) {
                msg('Aucun timestamp valide détecté. Utilisez des lignes au format [mm:ss.xx] texte.');
                return;
            }

            validated = { file, lines, content };

            // Artiste / titre proposés à partir du nom du fichier (modifiables)
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const idx = baseName.indexOf('-');
            if (idx > 0) {
                $('up-artist').value = cleanText(baseName.slice(0, idx)).slice(0, 100);
                $('up-title').value = cleanText(baseName.slice(idx + 1)).slice(0, 150);
            } else {
                $('up-artist').value = '';
                $('up-title').value = cleanText(baseName).slice(0, 150);
            }

            $('dropzone').classList.add('has-file');
            $('dropzone-title').textContent = file.name;
            $('dropzone-hint').textContent = `${(file.size / 1024).toFixed(1)} Ko`;

            $('preview-count').textContent = String(lines.length);
            $('preview-duration').textContent = `· ${formatDuration(lines[lines.length - 1].time)}`;

            const list = $('preview-list');
            list.replaceChildren();
            lines.slice(0, 8).forEach((line) => {
                const li = document.createElement('li');
                const ts = document.createElement('span');
                ts.className = 'ts';
                ts.textContent = `[${formatTime(line.time)}]`;
                li.append(ts, document.createTextNode(line.text));
                list.appendChild(li);
            });
            if (lines.length > 8) {
                const li = document.createElement('li');
                li.className = 'more';
                li.textContent = `… et ${lines.length - 8} autres lignes`;
                list.appendChild(li);
            }

            $('upload-form').classList.remove('hidden');
            refreshPublishButton();

            if (!$('up-artist').value.trim()) {
                msg("Indiquez l'artiste pour pouvoir publier.", 'warn');
                $('up-artist').focus();
            } else {
                msg(`${lines.length} timestamps validés. Vérifiez l'artiste et le titre.`, 'success');
            }
        };
        reader.readAsText(file);
    }

    on('fileInput', 'change', (e) => handleFile(e.target.files?.[0]));
    on('up-artist', 'input', refreshPublishButton);
    on('up-title', 'input', refreshPublishButton);
    on('btn-open-upload', 'click', open);

    // Glisser-déposer
    const zone = $('dropzone');
    ['dragenter', 'dragover'].forEach((type) => zone.addEventListener(type, (e) => {
        e.preventDefault();
        zone.classList.add('is-drag');
    }));
    ['dragleave', 'drop'].forEach((type) => zone.addEventListener(type, (e) => {
        e.preventDefault();
        zone.classList.remove('is-drag');
    }));
    zone.addEventListener('drop', (e) => handleFile(e.dataTransfer?.files?.[0]));

    dialog.addEventListener('close', reset);

    // ---------- Publication ----------
    on('btn-upload', 'click', async () => {
        const user = auth.currentUser;
        if (!user || !user.emailVerified) {
            msg('Votre e-mail doit être vérifié avant de publier.');
            return;
        }
        if (!validated) {
            msg('Aucun fichier validé.');
            return;
        }

        const artist = $('up-artist').value.trim().slice(0, 100);
        const title = $('up-title').value.trim().slice(0, 150);
        if (!artist || !title) {
            msg("L'artiste et le titre ne peuvent pas être vides.");
            return;
        }

        const { file, lines, content } = validated;
        const btn = $('btn-upload');

        // Clé normalisée (identique à l'ancien site, ex. lion_hill_ano_tavela)
        const queryKey = (artist + '_' + title)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 200);

        btn.disabled = true;
        btn.textContent = 'Publication…';
        msg('');

        try {
            const ref = doc(db, 'lyrics', queryKey);

            // Évite d'écraser sans prévenir
            try {
                const existing = await getDoc(ref);
                if (existing.exists()
                    && !window.confirm(`Des paroles existent déjà pour « ${artist} – ${title} ». Les remplacer ?`)) {
                    btn.disabled = false;
                    btn.textContent = 'Publier';
                    return;
                }
            } catch { /* lecture impossible : on tente quand même l'écriture */ }

            await setDoc(ref, {
                artist: artist.toLowerCase(),
                title: title.toLowerCase(),
                artistOriginal: artist,
                titleOriginal: title,
                lyricsContent: content,
                timestamps: lines.map((l) => ({ time: l.time, text: l.text })),
                timestampCount: lines.length,
                duration: lines[lines.length - 1].time,
                size: file.size,
                ownerEmail: user.email,
                ownerEmailVerified: true,
                updatedAt: new Date()
            });

            toast(`Paroles de « ${title} » publiées !`, 'success');
            dialog.close();
            hooks.onPublished?.();
        } catch (error) {
            console.error('[upload] Erreur Firestore :', error);
            msg(error.code === 'permission-denied'
                ? 'Accès refusé. Vérifiez que votre e-mail est vérifié.'
                : `Erreur : ${error.code || error.message}`);
            btn.disabled = false;
            btn.textContent = 'Publier';
        }
    });

    return { open };
}
