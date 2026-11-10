/**
 * Moteur de synchronisation de paroles LRC
 * Parse le fichier .lrc et synchronise l'affichage avec l'audio
 */

export class LyricsPlayer {
    constructor(audioElement, viewportElement, containerElement) {
        this.audio = audioElement;
        this.viewport = viewportElement;
        this.container = containerElement;
        
        this.lines = [];           // [{ time, text, element }]
        this.currentIndex = -1;
        this.offsetMs = 0;
        this.rafId = null;
        this.isPlaying = false;
        
        // Callbacks
        this.onLineChange = null;
        this.onPlayStateChange = null;
        this.onTimeUpdate = null;
    }

    /**
     * Parse le contenu brut d'un fichier .lrc
     * Supporte : timestamps [mm:ss.xx], métadonnées [ti:], [ar:], [offset:]
     */
    parseLrc(lrcText) {
        const lines = [];
        let offsetMs = 0;
        const timeRegex = /\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
        const metaRegex = /^\[(\w+):(.+)\]$/;

        const rawLines = lrcText.split('\n');

        for (const rawLine of rawLines) {
            const trimmed = rawLine.trim();
            if (!trimmed) continue;

            // Détecter les métadonnées
            const metaMatch = trimmed.match(metaRegex);
            if (metaMatch) {
                const key = metaMatch[1].toLowerCase();
                const value = metaMatch[2].trim();
                if (key === 'offset') {
                    offsetMs = parseInt(value, 10) || 0;
                }
                // On pourrait stocker [ti:], [ar:] mais on les ignore pour l'instant
                continue;
            }

            // Chercher tous les timestamps de la ligne
            // Une ligne peut avoir plusieurs timestamps (refrain)
            const timestamps = [];
            let match;
            timeRegex.lastIndex = 0;
            
            while ((match = timeRegex.exec(trimmed)) !== null) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
                const timeInSeconds = minutes * 60 + seconds + ms / 1000;
                timestamps.push(timeInSeconds);
            }

            if (timestamps.length === 0) continue;

            // Extraire le texte après le dernier timestamp
            const text = trimmed.replace(timeRegex, '').trim();
            if (!text) continue;

            // Ajouter chaque timestamp comme une entrée distincte
            for (const time of timestamps) {
                lines.push({ time, text });
            }
        }

        // Appliquer l'offset global
        this.offsetMs = offsetMs;
        
        // Trier par temps croissant
        lines.sort((a, b) => a.time - b.time);
        
        // Dédupliquer les entrées au même timestamp (garder la première)
        const deduped = [];
        for (const line of lines) {
            if (deduped.length === 0 || Math.abs(deduped[deduped.length - 1].time - line.time) > 0.01) {
                deduped.push(line);
            }
        }

        this.lines = deduped.map((line, index) => ({
            ...line,
            index,
            element: null
        }));

        return this.lines;
    }

    /**
     * Charge les paroles et construit le DOM
     */
    loadLyrics(lrcText) {
        this.parseLrc(lrcText);
        this.buildDom();
        this.currentIndex = -1;
    }

    /**
     * Construit les éléments DOM pour chaque ligne
     */
    buildDom() {
        this.container.innerHTML = '';
        
        for (const line of this.lines) {
            const div = document.createElement('div');
            div.className = 'lyric-line';
            div.dataset.index = line.index;
            div.textContent = line.text;
            this.container.appendChild(div);
            line.element = div;
        }

        // Ajouter un espace en haut et en bas pour permettre le centrage
        const spacer = document.createElement('div');
        spacer.style.height = '40vh';
        this.container.insertBefore(spacer, this.container.firstChild);
        this.container.appendChild(spacer.cloneNode());
    }

    /**
     * Trouve l'index de la ligne active pour un temps donné
     * Recherche binaire pour performance
     */
    findLineIndexAtTime(timeInSeconds) {
        if (this.lines.length === 0) return -1;
        
        const adjustedTime = timeInSeconds + this.offsetMs / 1000;
        
        if (adjustedTime < this.lines[0].time) return -1;
        if (adjustedTime >= this.lines[this.lines.length - 1].time) {
            return this.lines.length - 1;
        }

        let low = 0;
        let high = this.lines.length - 1;
        let result = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.lines[mid].time <= adjustedTime) {
                result = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return result;
    }

    /**
     * Met à jour l'affichage en fonction du temps audio
     * Appelé à chaque frame via requestAnimationFrame
     */
    update() {
        if (!this.isPlaying) return;

        const currentTime = this.audio.currentTime;
        const newIndex = this.findLineIndexAtTime(currentTime);

        if (newIndex !== this.currentIndex) {
            this.setActiveLine(newIndex);
        }

        // Mettre à jour la barre de progression
        if (this.onTimeUpdate) {
            this.onTimeUpdate(currentTime, this.audio.duration || 0);
        }

        this.rafId = requestAnimationFrame(() => this.update());
    }

    /**
     * Change la ligne active avec animation de scroll
     */
    setActiveLine(index) {
        const oldLine = this.lines[this.currentIndex];
        if (oldLine && oldLine.element) {
            oldLine.element.classList.remove('active');
        }

        this.currentIndex = index;

        const newLine = this.lines[index];
        if (newLine && newLine.element) {
            newLine.element.classList.add('active');
            
            // Scroll fluide vers la ligne active
            const viewportHeight = this.viewport.clientHeight;
            const lineTop = newLine.element.offsetTop;
            const lineHeight = newLine.element.offsetHeight;
            const targetScroll = lineTop - (viewportHeight / 2) + (lineHeight / 2);
            
            this.viewport.scrollTo({
                top: Math.max(0, targetScroll),
                behavior: 'smooth'
            });

            if (this.onLineChange) {
                this.onLineChange(newLine, index);
            }
        }
    }

    /**
     * Démarre la synchronisation
     */
    play() {
        this.isPlaying = true;
        this.audio.play();
        this.update();
        if (this.onPlayStateChange) this.onPlayStateChange(true);
    }

    pause() {
        this.isPlaying = false;
        this.audio.pause();
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.onPlayStateChange) this.onPlayStateChange(false);
    }

    toggle() {
        if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    /**
     * Seek vers un temps donné et met à jour l'affichage immédiatement
     */
    seek(timeInSeconds) {
        this.audio.currentTime = timeInSeconds;
        const newIndex = this.findLineIndexAtTime(timeInSeconds);
        this.setActiveLine(newIndex);
    }

    /**
     * Ajuste le décalage manuel
     */
    setOffset(offsetMs) {
        this.offsetMs = offsetMs;
        // Recalculer la ligne active
        if (this.audio) {
            const newIndex = this.findLineIndexAtTime(this.audio.currentTime);
            this.setActiveLine(newIndex);
        }
    }

    /**
     * Charge un fichier audio
     */
    loadAudio(url) {
        this.audio.src = url;
        this.audio.load();
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.pause();
        this.lines = [];
        this.container.innerHTML = '';
        this.audio.src = '';
    }
}
