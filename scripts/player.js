/**
 * player.js — Moteur de synchronisation LRC
 * Parse le fichier .lrc et synchronise l'affichage avec l'audio
 */

export class LyricsPlayer {
    constructor(audioElement, viewportElement, containerElement) {
        this.audio = audioElement;
        this.viewport = viewportElement;
        this.container = containerElement;

        this.lines = [];
        this.currentIndex = -1;
        this.offsetMs = 0;
        this.rafId = null;
        this.isPlaying = false;

        this.onLineChange = null;
        this.onPlayStateChange = null;
        this.onTimeUpdate = null;
    }

    /**
     * Parse le contenu brut d'un fichier .lrc
     * Supporte : [mm:ss.xx], [mm:ss.xxx], [mm:ss], [mm:ss:xx]
     * Métadonnées : [ti:], [ar:], [al:], [by:], [offset:], [length:], [re:], [ve:]
     */
    parseLrc(lrcText) {
        const lines = [];
        let offsetMs = 0;

        const timeRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
        const metaRegex = /^\[(ti|ar|al|by|offset|length|re|ve):(.+)\]$/i;

        const rawLines = lrcText.split(/\r?\n/);

        console.log(`[LRC] ${rawLines.length} lignes brutes à analyser`);

        for (const rawLine of rawLines) {
            const trimmed = rawLine.trim();
            if (!trimmed) continue;

            const metaMatch = trimmed.match(metaRegex);
            if (metaMatch) {
                const key = metaMatch[1].toLowerCase();
                const value = metaMatch[2].trim();
                if (key === 'offset') {
                    offsetMs = parseInt(value, 10) || 0;
                }
                continue;
            }

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

        console.log(`[LRC] ${lines.length} entrées avec timestamps trouvées`);

        this.offsetMs = offsetMs;

        lines.sort((a, b) => a.time - b.time);

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

        console.log(`[LRC] ${this.lines.length} lignes finales après déduplication`);
        if (this.lines.length > 0) {
            console.log(`[LRC] Première : ${this.lines[0].time.toFixed(2)}s → "${this.lines[0].text}"`);
            console.log(`[LRC] Dernière : ${this.lines[this.lines.length - 1].time.toFixed(2)}s`);
        }

        return this.lines;
    }

    loadLyrics(lrcText) {
        this.parseLrc(lrcText);
        this.buildDom();
        this.currentIndex = -1;
    }

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

        const spacerTop = document.createElement('div');
        spacerTop.style.height = '40vh';
        this.container.insertBefore(spacerTop, this.container.firstChild);

        const spacerBottom = document.createElement('div');
        spacerBottom.style.height = '40vh';
        this.container.appendChild(spacerBottom);
    }

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

    update() {
        if (!this.isPlaying) return;

        const currentTime = this.audio.currentTime;
        const newIndex = this.findLineIndexAtTime(currentTime);

        if (newIndex !== this.currentIndex) {
            this.setActiveLine(newIndex);
        }

        if (this.onTimeUpdate) {
            this.onTimeUpdate(currentTime, this.audio.duration || 0);
        }

        this.rafId = requestAnimationFrame(() => this.update());
    }

    setActiveLine(index) {
        // Retirer "active" de toutes les lignes
        this.container.querySelectorAll('.lyric-line.active').forEach(el => {
            el.classList.remove('active');
        });

        this.currentIndex = index;

        const newLine = this.lines[index];
        if (newLine && newLine.element) {
            newLine.element.classList.add('active');

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

    seek(timeInSeconds) {
        this.audio.currentTime = timeInSeconds;
        const newIndex = this.findLineIndexAtTime(timeInSeconds);
        this.setActiveLine(newIndex);
    }

    setOffset(offsetMs) {
        this.offsetMs = offsetMs;
        if (this.audio) {
            const newIndex = this.findLineIndexAtTime(this.audio.currentTime);
            this.setActiveLine(newIndex);
        }
    }

    loadAudio(url) {
        this.audio.src = url;
        this.audio.load();
    }

    destroy() {
        this.pause();
        this.lines = [];
        this.container.innerHTML = '';
        this.audio.src = '';
    }
}
