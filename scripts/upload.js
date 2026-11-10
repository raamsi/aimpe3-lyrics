/**
 * upload.js — Upload de fichiers .lrc vers Firestore
 * Détecte l'absence de timestamps et avertit l'utilisateur
 */

import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const MAX_FILE_SIZE = 500 * 1024;

function setStatus(msg, color = '#ffffff') {
    const status = document.getElementById('status');
    if (status) {
        status.innerText = msg;
        status.style.color = color;
    }
}

export function initUpload(auth, db) {
    const btnUpload = document.getElementById('btn-upload');
    const fileInput = document.getElementById('fileInput');

    if (!btnUpload || !fileInput) {
        console.warn("Éléments d'upload introuvables dans le DOM");
        return;
    }

    btnUpload.addEventListener('click', async () => {
        if (!auth.currentUser || !auth.currentUser.emailVerified) {
            setStatus("Votre email doit être vérifié avant de publier.", "#e74c3c");
            return;
        }

        if (fileInput.files.length === 0) {
            setStatus("Veuillez sélectionner un fichier .lrc !", "#f39c12");
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

        const artist = parts[0].trim().slice(0, 100);
        const title = parts.slice(1).join('-').trim().slice(0, 150);

        if (!artist || !title) {
            setStatus("Artiste et titre ne peuvent pas être vides.", "#e74c3c");
            return;
        }

        btnUpload.disabled = true;
        setStatus("Envoi vers Firestore en cours…", "#ffffff");

        const reader = new FileReader();
        reader.onerror = () => {
            setStatus("Impossible de lire le fichier.", "#e74c3c");
            btnUpload.disabled = false;
        };

        reader.onload = async (e) => {
            const lyricsContent = e.target.result;

            if (typeof lyricsContent !== 'string' || lyricsContent.length === 0) {
                setStatus("Contenu du fichier invalide.", "#e74c3c");
                btnUpload.disabled = false;
                return;
            }

            // ✅ Détection des timestamps
            const hasTimestamps = /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/.test(lyricsContent);
            const timestampCount = (lyricsContent.match(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g) || []).length;

            console.log(`[UPLOAD] Timestamps détectés : ${timestampCount}`);

            if (!hasTimestamps) {
                const proceed = confirm(
                    "⚠️ Aucun timestamp [mm:ss.xx] détecté dans ce fichier.\n\n" +
                    "La synchronisation ne fonctionnera pas sans timestamps.\n\n" +
                    "Voulez-vous quand même publier ?"
                );
                if (!proceed) {
                    setStatus("Upload annulé. Ajoutez des timestamps [mm:ss.xx] au fichier.", "#f39c12");
                    btnUpload.disabled = false;
                    return;
                }
            }

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
                    lyricsContent: lyricsContent,
                    size: file.size,
                    timestampCount: timestampCount,
                    ownerEmail: auth.currentUser.email,
                    ownerEmailVerified: true,
                    updatedAt: new Date()
                });

                if (hasTimestamps) {
                    setStatus(`Paroles publiées ! ${timestampCount} timestamps détectés.`, "#1DB954");
                } else {
                    setStatus("Paroles publiées (sans timestamps — pas de synchronisation).", "#f39c12");
                }

                fileInput.value = "";

                window.dispatchEvent(new CustomEvent('lyrics-uploaded', {
                    detail: { artist, title, queryKey, timestampCount }
                }));
            } catch (error) {
                if (error.code === 'permission-denied') {
                    setStatus("Accès refusé. Votre email est peut-être non vérifié.", "#e74c3c");
                } else {
                    setStatus("Erreur lors de l'envoi : " + (error.code || 'inconnu'), "#e74c3c");
                }
            } finally {
                btnUpload.disabled = false;
            }
        };
        reader.readAsText(file);
    });
}
