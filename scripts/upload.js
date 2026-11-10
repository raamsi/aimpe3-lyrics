/**
 * upload.js — Upload .lrc avec validation des timestamps
 */

import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const MAX_FILE_SIZE = 500 * 1024;

const $ = (id) => document.getElementById(id);

function setStatus(msg, color = '#ffffff') {
    const status = $('status');
    if (status) {
        status.innerText = msg;
        status.style.color = color;
    }
}

function on(id, event, handler) {
    const el = $(id);
    if (el) {
        el.addEventListener(event, handler);
        return true;
    }
    console.warn(`[upload] Élément #${id} introuvable`);
    return false;
}

/**
 * Parse un fichier LRC et retourne un tableau de { time, text }
 * Retourne null si aucun timestamp n'est trouvé
 */
function parseLrc(lrcText) {
    const lines = [];
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    const metaRegex = /^\[(ti|ar|al|by|offset|length|re|ve):(.+)\]$/i;

    const rawLines = lrcText.split(/\r?\n/);

    for (const rawLine of rawLines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;

        // Ignorer les métadonnées
        if (metaRegex.test(trimmed)) continue;

        // Chercher les timestamps
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

        for (const time of timestamps) {
            lines.push({ time, text });
        }
    }

    if (lines.length === 0) return null;

    lines.sort((a, b) => a.time - b.time);

    // Dédupliquer
    const deduped = [];
    for (const line of lines) {
        if (deduped.length === 0 || Math.abs(deduped[deduped.length - 1].time - line.time) > 0.01) {
            deduped.push(line);
        }
    }

    return deduped;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds - Math.floor(seconds)) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function initUpload(auth, db) {
    console.log("[upload] Initialisation…");

    let validatedFile = null;      // { file, artist, title, lines, content }
    let validateTimeout = null;

    // ---------- Validation à la sélection du fichier ----------
    on('fileInput', 'change', () => {
        const fileInput = $('fileInput');
        const previewSection = $('preview-section');
        const previewList = $('preview-list');
        const previewCount = $('preview-count');
        const previewStatus = $('preview-status');
        const btnUpload = $('btn-upload');

        validatedFile = null;
        if (btnUpload) btnUpload.disabled = true;
        if (previewSection) previewSection.classList.add('hidden');
        if (previewList) previewList.innerHTML = '';

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            return;
        }

        const file = fileInput.files[0];

        // Validations basiques
        if (!/\.lrc$/i.test(file.name)) {
            setStatus("Seuls les fichiers .lrc sont acceptés.", "#e74c3c");
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setStatus(`Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024} Ko).`, "#e74c3c");
            return;
        }
        if (file.size === 0) {
            setStatus("Le fichier est vide.", "#e74c3c");
            return;
        }

        // Validation du nom : "Artiste - Titre.lrc"
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        const parts = fileName.split('-');

        if (parts.length < 2) {
            setStatus("Format requis : Artiste - Titre.lrc", "#e74c3c");
            return;
        }

        const artist = parts[0].trim().slice(0, 100);
        const title = parts.slice(1).join('-').trim().slice(0, 150);

        if (!artist || !title) {
            setStatus("Artiste et titre ne peuvent pas être vides.", "#e74c3c");
            return;
        }

        setStatus("Analyse du fichier…", "#ffffff");

        const reader = new FileReader();
        reader.onerror = () => setStatus("Impossible de lire le fichier.", "#e74c3c");

        reader.onload = (e) => {
            const content = e.target.result;

            if (typeof content !== 'string' || content.length === 0) {
                setStatus("Contenu du fichier invalide.", "#e74c3c");
                return;
            }

            // ✅ Parse et validation des timestamps
            const lines = parseLrc(content);

            if (!lines || lines.length === 0) {
                setStatus(
                    "❌ Aucun timestamp valide détecté. " +
                    "Ajoutez des lignes au format [mm:ss.xx]texte.",
                    "#e74c3c"
                );
                if (previewSection) previewSection.classList.add('hidden');
                return;
            }

            // Afficher la prévisualisation
            validatedFile = { file, artist, title, lines, content };

            if (previewSection) previewSection.classList.remove('hidden');
            if (previewCount) previewCount.textContent = lines.length;
            if (previewStatus) {
                previewStatus.textContent = "✓ Prêt à publier";
                previewStatus.className = "preview-status ok";
            }

            // Afficher les 10 premières lignes
            if (previewList) {
                previewList.innerHTML = '';
                lines.slice(0, 10).forEach(line => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span class="ts">[${formatTime(line.time)}]</span> ${escapeHtml(line.text)}`;
                    previewList.appendChild(li);
                });
                if (lines.length > 10) {
                    const li = document.createElement('li');
                    li.className = 'more';
                    li.textContent = `… et ${lines.length - 10} autres lignes`;
                    previewList.appendChild(li);
                }
            }

            if (btnUpload) btnUpload.disabled = false;
            setStatus(`${lines.length} timestamps validés. Cliquez sur Publier.`, "#1DB954");
        };

        reader.readAsText(file);
    });

    // ---------- Publication ----------
    on('btn-upload', 'click', async () => {
        if (!auth.currentUser || !auth.currentUser.emailVerified) {
            setStatus("Votre email doit être vérifié avant de publier.", "#e74c3c");
            return;
        }

        if (!validatedFile) {
            setStatus("Aucun fichier validé.", "#e74c3c");
            return;
        }

        const { file, artist, title, lines, content } = validatedFile;
        const btn = $('btn-upload');

        if (btn) btn.disabled = true;
        setStatus("Publication en cours…", "#ffffff");

        const queryKey = (artist + "_" + title)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")
            .slice(0, 200);

        try {
            await setDoc(doc(db, "lyrics", queryKey), {
                artist: artist.toLowerCase(),
                title: title.toLowerCase(),
                artistOriginal: artist,
                titleOriginal: title,
                lyricsContent: content,
                // ✅ On stocke les timestamps déjà parsés pour la lecture
                timestamps: lines.map(l => ({ time: l.time, text: l.text })),
                timestampCount: lines.length,
                duration: lines[lines.length - 1].time,
                size: file.size,
                ownerEmail: auth.currentUser.email,
                ownerEmailVerified: true,
                updatedAt: new Date()
            });

            setStatus(`✅ Paroles publiées ! ${lines.length} lignes synchronisées.`, "#1DB954");

            // Reset
            validatedFile = null;
            const fileInput = $('fileInput');
            if (fileInput) fileInput.value = '';
            const previewSection = $('preview-section');
            if (previewSection) previewSection.classList.add('hidden');

        } catch (error) {
            console.error("[upload] Erreur Firestore :", error);
            if (error.code === 'permission-denied') {
                setStatus("Accès refusé. Vérifiez que votre email est vérifié.", "#e74c3c");
            } else {
                setStatus("Erreur : " + (error.code || error.message), "#e74c3c");
            }
            if (btn) btn.disabled = false;
        }
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
