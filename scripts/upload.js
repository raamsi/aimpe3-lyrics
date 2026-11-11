/**
 * upload.js — Upload .lrc + validation des timestamps + répertoire
 */

import {
    doc,
    setDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

        if (metaRegex.test(trimmed)) continue;

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

    const deduped = [];
    for (const line of lines) {
        if (deduped.length === 0 || Math.abs(deduped[deduped.length - 1].time - line.time) > 0.01) {
            deduped.push(line);
        }
    }

    return deduped;
}

function formatTime(seconds) {
    if (seconds == null || isNaN(seconds)) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds - Math.floor(seconds)) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function safeFileName(value) {
    return String(value || '')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .trim()
        .replace(/[. ]+$/g, '')
        .slice(0, 150) || 'lyrics';
}

function getLyricsContent(data) {
    // Les nouveaux enregistrements conservent le texte LRC original.
    if (typeof data.lyricsContent === 'string' && data.lyricsContent.length > 0) {
        return data.lyricsContent;
    }

    // Compatibilité avec les anciens documents qui n'ont que les timestamps.
    if (Array.isArray(data.timestamps) && data.timestamps.length > 0) {
        return data.timestamps
            .filter(line => Number.isFinite(Number(line.time)))
            .map(line => `[${formatTime(Number(line.time))}]${line.text || ''}`)
            .join('\n');
    }

    return '';
}

function downloadLyrics(data) {
    const content = getLyricsContent(data);
    if (!content) {
        setStatus("Le contenu des paroles n'est pas disponible pour ce fichier.", "#e74c3c");
        return;
    }

    const artist = data.artistOriginal || data.artist || 'Artiste';
    const title = data.titleOriginal || data.title || 'Titre';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName(artist)} - ${safeFileName(title)}.lrc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initUpload(auth, db) {
    console.log("[upload] Initialisation…");

    let validatedFile = null;
    let catalogDocs = [];

    // Construit les lignes avec DOM API afin de traiter le contenu comme du texte.
    const renderCatalog = (searchTerm = '') => {
        const tbody = $('catalog-body');
        if (!tbody) return;

        const needle = searchTerm.trim().toLocaleLowerCase();
        const filteredDocs = catalogDocs.filter(data => {
            const searchable = [
                data.artistOriginal, data.artist,
                data.titleOriginal, data.title,
                data.ownerEmail
            ].filter(Boolean).join(' ').toLocaleLowerCase();
            return searchable.includes(needle);
        });

        tbody.replaceChildren();
        if (filteredDocs.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.textContent = catalogDocs.length
                ? 'Aucun résultat pour cette recherche.'
                : 'Aucun fichier .lrc trouvé.';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        filteredDocs.forEach(data => {
            const tr = document.createElement('tr');
            const values = [
                data.artistOriginal || data.artist || '—',
                data.titleOriginal || data.title || '—',
                data.timestampCount ?? (data.timestamps?.length || 0),
                data.duration != null ? formatTime(Number(data.duration)) : '—',
                data.ownerEmail || '—'
            ];

            values.forEach((value, index) => {
                const td = document.createElement('td');
                td.textContent = String(value);
                if (index === 0 || index === 1 || index === 4) td.title = String(value);
                if (index === 4) td.style.fontSize = '0.7rem';
                tr.appendChild(td);
            });

            const downloadCell = document.createElement('td');
            const downloadButton = document.createElement('button');
            downloadButton.type = 'button';
            downloadButton.className = 'download-btn';
            downloadButton.textContent = 'Télécharger';
            downloadButton.setAttribute('aria-label', `Télécharger ${values[0]} - ${values[1]} au format LRC`);
            downloadButton.addEventListener('click', () => downloadLyrics(data));
            downloadCell.appendChild(downloadButton);
            tr.appendChild(downloadCell);
            tbody.appendChild(tr);
        });
    };

    on('catalog-search', 'input', (event) => renderCatalog(event.target.value));

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

        const fileName = file.name.replace(/\.[^/.]+$/, "");
        const parts = fileName.split('-');

        if (parts.length < 2) {
            setStatus("Format requis : Artiste - Titre.lrc", "#e74c3c");
            return;
        }

        let rawArtist = parts[0].trim();
        let rawTitle = parts.slice(1).join('-').trim();

        // Nettoyage intelligent des termes parasites pour standardiser la clé.
        const cleanText = (text) => {
            return text
                .replace(/\(.*?\)/g, '')
                .replace(/\[.*?\]/g, '')
                .replace(/official video|lyrics|audio|clip officiel|mp3|\b\d{2,3}kbps\b/gi, '')
                .trim();
        };

        const artist = cleanText(rawArtist).slice(0, 100);
        const title = cleanText(rawTitle).slice(0, 150);

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

            validatedFile = { file, artist, title, lines, content };

            if (previewSection) previewSection.classList.remove('hidden');
            if (previewCount) previewCount.textContent = lines.length;
            if (previewStatus) {
                previewStatus.textContent = "✓ Prêt à publier";
                previewStatus.className = "preview-status ok";
            }

            if (previewList) {
                previewList.replaceChildren();
                lines.slice(0, 10).forEach(line => {
                    const li = document.createElement('li');
                    const timestamp = document.createElement('span');
                    timestamp.className = 'ts';
                    timestamp.textContent = `[${formatTime(line.time)}]`;
                    li.append(timestamp, document.createTextNode(` ${line.text}`));
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

        // Clé normalisée (ex: lion_hill_ano_tavela).
        const queryKey = (artist + "_" + title)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")
            .replace(/_+/g, "_")
            .slice(0, 200);

        try {
            await setDoc(doc(db, "lyrics", queryKey), {
                artist: artist.toLowerCase(),
                title: title.toLowerCase(),
                artistOriginal: artist,
                titleOriginal: title,
                // On conserve le fichier .lrc brut pour permettre sa restitution exacte.
                lyricsContent: content,
                timestamps: lines.map(l => ({ time: l.time, text: l.text })),
                timestampCount: lines.length,
                duration: lines[lines.length - 1].time,
                size: file.size,
                ownerEmail: auth.currentUser.email,
                ownerEmailVerified: true,
                updatedAt: new Date()
            });

            setStatus(`✅ Paroles publiées sous la clé [${queryKey}] !`, "#1DB954");

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

    // ---------- RÉPERTOIRE : chargement et recherche ----------
    on('btn-load-catalog', 'click', async () => {
        if (!auth.currentUser || !auth.currentUser.emailVerified) {
            setStatus("Connectez-vous avec un email vérifié pour voir le répertoire.", "#e74c3c");
            return;
        }

        const tbody = $('catalog-body');
        const btnCatalog = $('btn-load-catalog');
        if (!tbody) return;

        tbody.replaceChildren();
        const loadingRow = document.createElement('tr');
        const loadingCell = document.createElement('td');
        loadingCell.colSpan = 6;
        loadingCell.textContent = 'Chargement…';
        loadingRow.appendChild(loadingCell);
        tbody.appendChild(loadingRow);
        if (btnCatalog) btnCatalog.disabled = true;

        try {
            const querySnapshot = await getDocs(collection(db, "lyrics"));
            catalogDocs = [];

            querySnapshot.forEach(docSnap => {
                catalogDocs.push({ id: docSnap.id, ...docSnap.data() });
            });

            catalogDocs.sort((a, b) => {
                const dateA = a.updatedAt?.toDate?.()?.getTime?.() || 0;
                const dateB = b.updatedAt?.toDate?.()?.getTime?.() || 0;
                return dateB - dateA;
            });

            renderCatalog($('catalog-search')?.value || '');
            setStatus(`${catalogDocs.length} fichier(s) .lrc trouvé(s).`, catalogDocs.length ? "#1DB954" : "#f39c12");

        } catch (error) {
            console.error("[catalog] Erreur :", error);
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.textContent = error.code === 'permission-denied'
                ? 'Accès refusé.'
                : 'Erreur lors du chargement.';
            row.appendChild(cell);
            tbody.replaceChildren(row);
            if (error.code === 'permission-denied') {
                setStatus("Accès refusé. Vérifiez les règles Firestore.", "#e74c3c");
            } else {
                setStatus("Erreur : " + (error.code || error.message), "#e74c3c");
            }
        } finally {
            if (btnCatalog) btnCatalog.disabled = false;
        }
    });
}
