/**
 * Module d'upload de fichiers .lrc vers Firestore
 */

import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const MAX_FILE_SIZE = 500 * 1024; // 500 Ko

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
        // Double sécurité : email vérifié requis
        if (!auth.currentUser || !auth.currentUser.emailVerified) {
            setStatus("Votre email doit être vérifié avant de publier.", "#e74c3c");
            return;
        }

        if (fileInput.files.length === 0) {
            setStatus("Veuillez sélectionner un fichier .lrc !", "#f39c12");
            return;
        }

        const file = fileInput.files[0];

        // Validations
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
                    ownerEmail: auth.currentUser.email,
                    ownerEmailVerified: true,
                    updatedAt: new Date()
                });

                setStatus("Paroles publiées avec succès !", "#1DB954");
                fileInput.value = "";

                // Émettre un événement pour que main.js puisse réagir
                window.dispatchEvent(new CustomEvent('lyrics-uploaded', {
                    detail: { artist, title, queryKey }
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
