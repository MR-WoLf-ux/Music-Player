const audioPlayer = document.getElementById("audio-player");
const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const playStatusLabel = document.getElementById("play-status-label");
const seekSlider = document.getElementById("seek-slider");
const seekProgressFill = document.getElementById("seek-progress-fill");
const currentTimeDisplay = document.getElementById("current-time");
const durationDisplay = document.getElementById("duration");
const playlistList = document.getElementById("playlist-list");
const repeatBtn = document.getElementById("repeat-btn");
const shuffleBtn = document.getElementById("shuffle-btn");
const folderInput = document.getElementById("folder-input");
const selectFolderBtn = document.getElementById("select-folder-btn");
const lyricsBox = document.getElementById("lyrics-box");
const lyricsTextarea = document.getElementById("lyrics-textarea");
const saveLyricsBtn = document.getElementById("save-lyrics-btn");
const searchInput = document.getElementById("search-input");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const albumCoverImg = document.getElementById("album-cover-img");
const togglePlaylistBtn = document.getElementById("toggle-playlist-btn");
const playlistCloseBtn = document.getElementById("playlist-close-btn");
const cdDeck = document.querySelector(".cd-deck");

// Visualizer Canvas
const visualizerCanvas = document.getElementById("visualizer");
const visualizerCtx = visualizerCanvas.getContext("2d");

// Studio Segmented Spectrum Configuration
const BARS_COUNT = 24;
const TOTAL_SEGMENTS = 14;
const currentBarHeights = new Float32Array(BARS_COUNT).fill(0);
const peakHoldValues = new Float32Array(BARS_COUNT).fill(0);
const peakHoldTimers = new Uint8Array(BARS_COUNT).fill(0);

// Analog VU Meters
const vuNeedleL = document.getElementById("vu-needle-l");
const vuNeedleR = document.getElementById("vu-needle-r");
const peakLedL = document.getElementById("peak-led-l");
const peakLedR = document.getElementById("peak-led-r");

const themePickerPanel = document.getElementById("theme-picker-panel");
const themeOptions = document.querySelectorAll(".theme-option");
const favoritesFilterBtn = document.getElementById("favorites-filter-btn");

// Tray and Disc
const trayHousing = document.getElementById("tray-housing");
const compactDisc = document.getElementById("compact-disc");
const laserLed = document.getElementById("laser-led");

// VFD Display & Marquee Elements
const trackNumberDisplay = document.getElementById("track-number");
const vfdText = document.getElementById("vfd-text");
const vfdTextClone = document.getElementById("vfd-text-clone");
const titleMarqueeTrack = document.getElementById("title-marquee-track");
const titleScrollerBox = document.getElementById("title-scroller-box");

const vfdArtist = document.getElementById("vfd-artist");
const vfdArtistClone = document.getElementById("vfd-artist-clone");
const artistMarqueeTrack = document.getElementById("artist-marquee-track");
const artistScrollerBox = document.getElementById("artist-scroller-box");

const indRepeat = document.getElementById("ind-repeat");
const indShuffle = document.getElementById("ind-shuffle");
const indFav = document.getElementById("ind-fav");

// Rotary Volume Knob
const knobZone = document.getElementById("knob-zone");
const volumeKnob = document.getElementById("volume-knob");
const volumeReadout = document.getElementById("volume-readout");
const scaleDots = document.querySelectorAll(".scale-dot");

const dbName = "musicPlayerDB";
const dbVersion = 1;
const request = indexedDB.open(dbName, dbVersion);
let db;
let currentSongIndex = 0;
let playlist = [];
let isRepeating = false;
let isShuffling = false;
let showOnlyFavorites = false;

// Tray State
let isTrayOpen = true;
let isTrayClosing = false;
let isUserSeeking = false;
let isAutoplayArmed = false;

// Active Track Info
let currentActiveTitle = "READY - INSERT DISC";
let currentActiveArtist = "NO DISC INSERTED";

// Volume Variables
let currentVolume = 1;
let prevVolume = 1;
const MIN_DEG = -135;
const MAX_DEG = 135;

// Web Audio API
let audioContext,
    analyserL,
    analyserR,
    visualizerAnalyser,
    splitter,
    source,
    dataArrayL,
    dataArrayR,
    visualizerDataArray;
let gainNode;
let waveOffset = 0;

// VU Needle Angles
let currentAngleL = -42;
let currentAngleR = -42;
const VU_MIN_ANGLE = -42;
const VU_MAX_ANGLE = 42;

let wasPlayingBeforePick = false;
let previousCoverBackup = "./Icon/Default.png";
let folderFallbackCover = null;

/* ============================================
   Lyrics Visibility Management
   ============================================ */
function updateLyricsVisibility() {
    if (playlist && playlist.length > 0) {
        lyricsBox.classList.remove("hidden");
    } else {
        lyricsBox.classList.add("hidden");
    }
}

/* ============================================
   Tag Extraction Helpers
   ============================================ */
function extractCoverUrlFromPicture(picture) {
    if (!picture || !picture.data || picture.data.length === 0) return null;
    try {
        const byteArray = new Uint8Array(picture.data);
        const mimeType = picture.format || "image/jpeg";
        const blob = new Blob([byteArray], { type: mimeType });
        return URL.createObjectURL(blob);
    } catch (err) {
        console.error("Error creating Blob for cover:", err);
        return null;
    }
}

function extractLyricsFromTags(tags) {
    if (!tags) return "";

    if (tags.lyrics) {
        if (typeof tags.lyrics === "string") return tags.lyrics.trim();
        if (typeof tags.lyrics === "object") {
            if (tags.lyrics.lyrics) return tags.lyrics.lyrics.trim();
            if (tags.lyrics.data && typeof tags.lyrics.data === "string")
                return tags.lyrics.data.trim();
            if (tags.lyrics.data && tags.lyrics.data.lyrics)
                return tags.lyrics.data.lyrics.trim();
        }
    }

    if (tags.USLT) {
        if (typeof tags.USLT === "string") return tags.USLT.trim();
        if (typeof tags.USLT === "object") {
            if (tags.USLT.data) {
                if (typeof tags.USLT.data === "string")
                    return tags.USLT.data.trim();
                if (tags.USLT.data.lyrics) return tags.USLT.data.lyrics.trim();
            }
            if (tags.USLT.lyrics) return tags.USLT.lyrics.trim();
        }
    }

    if (tags.unsyncedLyrics) {
        if (typeof tags.unsyncedLyrics === "string")
            return tags.unsyncedLyrics.trim();
        if (
            typeof tags.unsyncedLyrics === "object" &&
            tags.unsyncedLyrics.lyrics
        ) {
            return tags.unsyncedLyrics.lyrics.trim();
        }
    }

    if (tags.TXXX) {
        const list = Array.isArray(tags.TXXX) ? tags.TXXX : [tags.TXXX];
        for (const item of list) {
            if (
                item &&
                (item.description === "LYRICS" || item.description === "Lyrics")
            ) {
                return (item.data || "").trim();
            }
        }
    }

    return "";
}

/* ============================================
   Audio Engine Initialization
   ============================================ */
function setupAudioEngine() {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        splitter = audioContext.createChannelSplitter(2);
        analyserL = audioContext.createAnalyser();
        analyserR = audioContext.createAnalyser();
        analyserL.fftSize = 256;
        analyserR.fftSize = 256;
        analyserL.smoothingTimeConstant = 0.8;
        analyserR.smoothingTimeConstant = 0.8;

        visualizerAnalyser = audioContext.createAnalyser();
        visualizerAnalyser.fftSize = 512;
        visualizerAnalyser.smoothingTimeConstant = 0.82;

        gainNode = audioContext.createGain();
        source = audioContext.createMediaElementSource(audioPlayer);

        source.connect(gainNode);
        gainNode.connect(visualizerAnalyser);
        visualizerAnalyser.connect(audioContext.destination);

        gainNode.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);

        gainNode.gain.value = currentVolume;

        dataArrayL = new Uint8Array(analyserL.frequencyBinCount);
        dataArrayR = new Uint8Array(analyserR.frequencyBinCount);
        visualizerDataArray = new Uint8Array(
            visualizerAnalyser.frequencyBinCount
        );
    } catch (e) {
        console.warn("AudioContext init delayed:", e);
    }
}

/* ============================================
   Studio VFD Segmented Visualizer Rendering
   ============================================ */
function renderVisualizerAndMeters() {
    requestAnimationFrame(renderVisualizerAndMeters);

    const isEngineActive = Boolean(
        audioContext && analyserL && analyserR && visualizerAnalyser
    );
    const isPlaying = !audioPlayer.paused && isEngineActive;

    // 1. Analog VU Meter Needles
    let targetNormL = 0;
    let targetNormR = 0;

    if (isEngineActive) {
        analyserL.getByteFrequencyData(dataArrayL);
        analyserR.getByteFrequencyData(dataArrayR);
        visualizerAnalyser.getByteFrequencyData(visualizerDataArray);

        if (isPlaying) {
            let sumL = 0,
                sumR = 0;
            const sampleCount = Math.min(32, dataArrayL.length);
            for (let i = 0; i < sampleCount; i++) {
                sumL += dataArrayL[i] * dataArrayL[i];
                sumR += dataArrayR[i] * dataArrayR[i];
            }
            const rmsL = Math.sqrt(sumL / sampleCount) / 255;
            const rmsR = Math.sqrt(sumR / sampleCount) / 255;

            targetNormL = Math.min(1, rmsL * 1.35 * currentVolume);
            targetNormR = Math.min(1, rmsR * 1.35 * currentVolume);
        }
    }

    const targetAngleL =
        VU_MIN_ANGLE + targetNormL * (VU_MAX_ANGLE - VU_MIN_ANGLE);
    const targetAngleR =
        VU_MIN_ANGLE + targetNormR * (VU_MAX_ANGLE - VU_MIN_ANGLE);

    currentAngleL += (targetAngleL - currentAngleL) * 0.18;
    currentAngleR += (targetAngleR - currentAngleR) * 0.18;

    vuNeedleL.style.transform = `rotate(${currentAngleL}deg)`;
    vuNeedleR.style.transform = `rotate(${currentAngleR}deg)`;

    peakLedL.classList.toggle("lit", targetNormL > 0.9);
    peakLedR.classList.toggle("lit", targetNormR > 0.9);

    // 2. VFD Segmented Spectrum Rendering
    const w = visualizerCanvas.width;
    const h = visualizerCanvas.height;

    visualizerCtx.clearRect(0, 0, w, h);

    // VFD Vacuum Tube Dark Background
    visualizerCtx.fillStyle = "rgba(4, 8, 12, 0.95)";
    visualizerCtx.fillRect(0, 0, w, h);

    // Extract Active Theme Glow Color
    const computedStyles = getComputedStyle(document.body);
    const themeGlow =
        computedStyles.getPropertyValue("--vfd-glow").trim() || "#00ffcc";

    const padX = 6;
    const padY = 5;
    const usableW = w - padX * 2;
    const usableH = h - padY * 2;

    const gapX = 3.5;
    const colWidth = (usableW - (BARS_COUNT - 1) * gapX) / BARS_COUNT;

    const gapY = 1.6;
    const segHeight = (usableH - (TOTAL_SEGMENTS - 1) * gapY) / TOTAL_SEGMENTS;

    for (let i = 0; i < BARS_COUNT; i++) {
        let normalizedLevel = 0;

        if (isPlaying && visualizerDataArray) {
            const lowFreqIndex = Math.floor(
                Math.pow(i / BARS_COUNT, 2.1) *
                    (visualizerDataArray.length * 0.65)
            );
            const highFreqIndex = Math.floor(
                Math.pow((i + 1) / BARS_COUNT, 2.1) *
                    (visualizerDataArray.length * 0.65)
            );

            let sum = 0;
            let count = 0;
            for (let b = lowFreqIndex; b <= highFreqIndex; b++) {
                sum += visualizerDataArray[b] || 0;
                count++;
            }
            const avg = count > 0 ? sum / count : 0;
            normalizedLevel = Math.min(1, (avg / 255) * 1.28);
        } else {
            // Smooth Ambient Idle Scan in Standby
            const scan = Math.sin(i * 0.45 - waveOffset * 2.2);
            normalizedLevel = Math.max(0.04, (scan + 1) * 0.08);
        }

        // Height Smoothing
        if (normalizedLevel >= currentBarHeights[i]) {
            currentBarHeights[i] = normalizedLevel;
        } else {
            const decay = isPlaying ? 0.16 : 0.06;
            currentBarHeights[i] +=
                (normalizedLevel - currentBarHeights[i]) * decay;
        }

        // Peak-Hold Processing
        if (currentBarHeights[i] >= peakHoldValues[i]) {
            peakHoldValues[i] = currentBarHeights[i];
            peakHoldTimers[i] = 16;
        } else {
            if (peakHoldTimers[i] > 0) {
                peakHoldTimers[i]--;
            } else {
                peakHoldValues[i] = Math.max(0, peakHoldValues[i] - 0.015);
            }
        }

        const activeSegments = Math.round(
            currentBarHeights[i] * TOTAL_SEGMENTS
        );
        const peakSegmentIndex = Math.min(
            TOTAL_SEGMENTS - 1,
            Math.floor(peakHoldValues[i] * TOTAL_SEGMENTS)
        );
        const colX = padX + i * (colWidth + gapX);

        // Render Segments from Bottom to Top
        for (let s = 0; s < TOTAL_SEGMENTS; s++) {
            const segY = h - padY - segHeight - s * (segHeight + gapY);
            const isLit = s < activeSegments;
            const isPeak =
                isPlaying && s === peakSegmentIndex && peakSegmentIndex > 0;

            let fillColor;
            let glow = 0;

            if (s >= TOTAL_SEGMENTS - 2) {
                // Critical Peak (+3dB)
                fillColor =
                    isLit || isPeak ? "#ff1e42" : "rgba(255, 30, 66, 0.08)";
                glow = isLit || isPeak ? 8 : 0;
            } else if (s >= TOTAL_SEGMENTS - 4) {
                // Warning Zone (0dB)
                fillColor =
                    isLit || isPeak ? "#ff9500" : "rgba(255, 149, 0, 0.08)";
                glow = isLit || isPeak ? 6 : 0;
            } else {
                // Standard Frequency Range
                fillColor =
                    isLit || isPeak ? themeGlow : "rgba(0, 255, 204, 0.07)";
                glow = isLit || isPeak ? 5 : 0;
            }

            visualizerCtx.fillStyle = fillColor;
            if (glow > 0 && isPlaying) {
                visualizerCtx.shadowColor = fillColor;
                visualizerCtx.shadowBlur = glow;
            } else {
                visualizerCtx.shadowBlur = 0;
            }

            if (visualizerCtx.roundRect) {
                visualizerCtx.beginPath();
                visualizerCtx.roundRect(colX, segY, colWidth, segHeight, 1);
                visualizerCtx.fill();
            } else {
                visualizerCtx.fillRect(colX, segY, colWidth, segHeight);
            }
        }
    }

    visualizerCtx.shadowBlur = 0;
    waveOffset += isPlaying ? 0.04 : 0.015;
}

requestAnimationFrame(renderVisualizerAndMeters);

/* ============================================
   VFD Display Texts Management
   ============================================ */
function setVFDText(title, artist) {
    if (title !== undefined && title !== null) {
        currentActiveTitle = title;
    }
    if (artist !== undefined && artist !== null) {
        currentActiveArtist = artist;
    }

    vfdText.textContent = currentActiveTitle;
    vfdTextClone.textContent = currentActiveTitle;
    titleMarqueeTrack.classList.remove("animating");

    setTimeout(() => {
        if (vfdText.offsetWidth > titleScrollerBox.clientWidth) {
            titleMarqueeTrack.classList.add("animating");
        }
    }, 60);

    const artistUpper = (
        currentActiveArtist || "NO DISC INSERTED"
    ).toUpperCase();
    vfdArtist.textContent = artistUpper;
    vfdArtistClone.textContent = artistUpper;
    artistMarqueeTrack.classList.remove("animating");

    setTimeout(() => {
        if (vfdArtist.offsetWidth > artistScrollerBox.clientWidth) {
            artistMarqueeTrack.classList.add("animating");
        }
    }, 60);
}

/* ============================================
   Disc Tray Mechanism & Media Loading
   ============================================ */
function openTrayUnder() {
    if (isTrayClosing) return;
    isTrayOpen = true;
    wasPlayingBeforePick = !audioPlayer.paused;
    if (wasPlayingBeforePick) {
        audioPlayer.pause();
        updatePlayButtonText();
    }

    previousCoverBackup = albumCoverImg.src;

    trayHousing.classList.add("ejected-under");
    vfdText.textContent = "WAITING FOR DISC...";
    vfdTextClone.textContent = "WAITING FOR DISC...";
    titleMarqueeTrack.classList.remove("animating");
    laserLed.classList.remove("active");
}

function closeTrayFromUnder(callback) {
    if (isTrayClosing) return;
    if (!isTrayOpen) {
        if (callback) callback();
        return;
    }

    isTrayClosing = true;
    isTrayOpen = false;
    trayHousing.classList.remove("ejected-under");
    laserLed.classList.add("active");

    setTimeout(() => {
        isTrayClosing = false;
        if (playlist.length > 0) {
            setVFDText(currentActiveTitle, currentActiveArtist);
        } else {
            setVFDText("READY - INSERT DISC", "NO DISC INSERTED");
        }

        if (callback) {
            callback();
        } else {
            albumCoverImg.src = previousCoverBackup;
            if (wasPlayingBeforePick && playlist.length > 0) {
                startPlayback();
            }
        }
    }, 1250);
}

selectFolderBtn.addEventListener("click", () => {
    folderInput.value = "";
    if (!isTrayOpen) {
        openTrayUnder();
        setTimeout(() => {
            folderInput.click();
        }, 500);
    } else {
        vfdText.textContent = "WAITING FOR DISC...";
        vfdTextClone.textContent = "WAITING FOR DISC...";
        titleMarqueeTrack.classList.remove("animating");
        folderInput.click();
    }
});

folderInput.addEventListener("cancel", () => {
    if (playlist.length > 0) {
        closeTrayFromUnder();
    } else {
        setVFDText("READY - INSERT DISC", "NO DISC INSERTED");
    }
    folderInput.value = "";
});

folderInput.addEventListener("change", async (event) => {
    setupAudioEngine();
    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
    }

    const files = event.target.files;
    if (!files || files.length === 0) {
        if (playlist.length > 0) closeTrayFromUnder();
        return;
    }

    albumCoverImg.src = "./Icon/Default.png";

    const audioFiles = [];
    const textFiles = new Map();
    let folderCoverFile = null;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.toLowerCase();

        if (
            file.type.startsWith("audio/") ||
            /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(fileName)
        ) {
            audioFiles.push(file);
        } else if (/\.(lrc|txt)$/i.test(fileName)) {
            const baseName = fileName.replace(/\.[^/.]+$/, "");
            textFiles.set(baseName, file);
        } else if (/\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
            if (
                !folderCoverFile ||
                /(cover|folder|front|albumart)/i.test(fileName)
            ) {
                folderCoverFile = file;
            }
        }
    }

    folderFallbackCover = folderCoverFile
        ? URL.createObjectURL(folderCoverFile)
        : null;

    if (audioFiles.length === 0) {
        if (playlist.length > 0) closeTrayFromUnder();
        setVFDText("NO AUDIO TRACKS", "");
        folderInput.value = "";
        updateLyricsVisibility();
        return;
    }

    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const clearRequest = objectStore.clear();

    clearRequest.onsuccess = async () => {
        playlist = [];
        playlistList.innerHTML = "";
        let loadedSongs = 0;

        for (let i = 0; i < audioFiles.length; i++) {
            const file = audioFiles[i];
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            let externalLyrics = "";

            if (textFiles.has(baseName.toLowerCase())) {
                try {
                    externalLyrics = await textFiles
                        .get(baseName.toLowerCase())
                        .text();
                } catch (e) {
                    console.warn("Could not read lyric file:", e);
                }
            }

            const song = {
                title: baseName,
                artist: "",
                file: file,
                lyrics: externalLyrics || "",
                isFavorite: false,
            };

            saveSongToDB(song, (id) => {
                song.id = id;
                playlist.push(song);
                loadedSongs++;
                if (loadedSongs === audioFiles.length) {
                    updateLyricsVisibility();
                    displayPlaylist();
                    loadSong(playlist[0].id, false);
                    closeTrayFromUnder(() => {
                        startPlayback();
                    });
                    folderInput.value = "";
                }
            });
        }
    };
});

/* ============================================
   Playback Engine
   ============================================ */
function startPlayback() {
    if (isTrayOpen && !isTrayClosing) {
        closeTrayFromUnder(() => {
            startPlayback();
        });
        return;
    }

    setupAudioEngine();

    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
    }

    if (gainNode) gainNode.gain.value = currentVolume;

    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                updatePlayButtonText();
            })
            .catch((err) => {
                console.log("Autoplay paused waiting for user gesture:", err);
                updatePlayButtonText();
                armAutoplayOnUserGesture();
            });
    }
}

function armAutoplayOnUserGesture() {
    if (isAutoplayArmed) return;
    isAutoplayArmed = true;

    const resumeOnGesture = () => {
        window.removeEventListener("pointerdown", resumeOnGesture, true);
        window.removeEventListener("keydown", resumeOnGesture, true);
        window.removeEventListener("touchstart", resumeOnGesture, true);
        isAutoplayArmed = false;

        if (playlist.length > 0 && audioPlayer.paused) {
            if (isTrayOpen) {
                closeTrayFromUnder(() => startPlayback());
            } else {
                startPlayback();
            }
        }
    };

    window.addEventListener("pointerdown", resumeOnGesture, true);
    window.addEventListener("keydown", resumeOnGesture, true);
    window.addEventListener("touchstart", resumeOnGesture, true);
}

/* ============================================
   Seek Slider Progress
   ============================================ */
function updateSeekVisual(percent) {
    seekProgressFill.style.width = `${percent}%`;
}

seekSlider.addEventListener("mousedown", () => {
    isUserSeeking = true;
});
seekSlider.addEventListener(
    "touchstart",
    () => {
        isUserSeeking = true;
    },
    { passive: true }
);

seekSlider.addEventListener("input", () => {
    const val = parseFloat(seekSlider.value);
    updateSeekVisual(val);

    if (audioPlayer.duration) {
        const targetTime = (val / 100) * audioPlayer.duration;
        const curMin = String(Math.floor(targetTime / 60)).padStart(2, "0");
        const curSec = String(Math.floor(targetTime % 60)).padStart(2, "0");
        currentTimeDisplay.textContent = `${curMin}:${curSec}`;
    }
});

function applySeek() {
    if (audioPlayer.duration) {
        audioPlayer.currentTime =
            (parseFloat(seekSlider.value) / 100) * audioPlayer.duration;
    }
    isUserSeeking = false;
}

seekSlider.addEventListener("mouseup", applySeek);
seekSlider.addEventListener("touchend", applySeek);
seekSlider.addEventListener("change", applySeek);

audioPlayer.addEventListener("timeupdate", () => {
    if (!isUserSeeking && audioPlayer.duration) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        seekSlider.value = percent;
        updateSeekVisual(percent);

        const curMin = String(
            Math.floor(audioPlayer.currentTime / 60)
        ).padStart(2, "0");
        const curSec = String(
            Math.floor(audioPlayer.currentTime % 60)
        ).padStart(2, "0");
        const durMin = String(Math.floor(audioPlayer.duration / 60)).padStart(
            2,
            "0"
        );
        const durSec = String(Math.floor(audioPlayer.duration % 60)).padStart(
            2,
            "0"
        );

        currentTimeDisplay.textContent = `${curMin}:${curSec}`;
        durationDisplay.textContent = `${durMin}:${durSec}`;
    }
});

/* ============================================
   Volume Knob Processing
   ============================================ */
function updateVolume(val) {
    currentVolume = Math.max(0, Math.min(1, val));
    audioPlayer.volume = currentVolume;
    if (gainNode) gainNode.gain.value = currentVolume;

    const deg = MIN_DEG + currentVolume * (MAX_DEG - MIN_DEG);
    volumeKnob.style.transform = `rotate(${deg}deg)`;
    volumeReadout.textContent = `${Math.round(currentVolume * 100)}%`;

    const stepRatio = 1 / (scaleDots.length - 1);
    scaleDots.forEach((dot, index) => {
        dot.classList.toggle("lit", currentVolume >= index * stepRatio - 0.05);
    });
}

function calculateAngleFromEvent(e) {
    const rect = knobZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle > 180) angle -= 360;

    if (angle < MIN_DEG) angle = MIN_DEG;
    if (angle > MAX_DEG) angle = MAX_DEG;

    const norm = (angle - MIN_DEG) / (MAX_DEG - MIN_DEG);
    updateVolume(norm);
}

let isAdjustingVolume = false;

knobZone.addEventListener("mousedown", (e) => {
    isAdjustingVolume = true;
    calculateAngleFromEvent(e);
});

window.addEventListener("mousemove", (e) => {
    if (isAdjustingVolume) calculateAngleFromEvent(e);
});

window.addEventListener("mouseup", () => {
    isAdjustingVolume = false;
});

knobZone.addEventListener(
    "touchstart",
    (e) => {
        isAdjustingVolume = true;
        calculateAngleFromEvent(e);
    },
    { passive: false }
);

window.addEventListener(
    "touchmove",
    (e) => {
        if (isAdjustingVolume) calculateAngleFromEvent(e);
    },
    { passive: false }
);

window.addEventListener("touchend", () => {
    isAdjustingVolume = false;
});

knobZone.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        const step = e.deltaY < 0 ? 0.05 : -0.05;
        updateVolume(currentVolume + step);
    },
    { passive: false }
);

/* ============================================
   Track Loading and Playback Execution
   ============================================ */
function loadSong(songId, autoPlay = true) {
    getSongFromDB(songId, (song) => {
        if (!song) return;

        audioPlayer.src = URL.createObjectURL(song.file);
        currentSongIndex = playlist.findIndex((s) => s.id === songId);

        trackNumberDisplay.textContent = String(currentSongIndex + 1).padStart(
            2,
            "0"
        );
        setVFDText(song.title, song.artist || "UNKNOWN ARTIST");

        indFav.classList.toggle("active", Boolean(song.isFavorite));

        displayPlaylist(searchInput ? searchInput.value.trim() : "");
        audioPlayer.load();

        lyricsTextarea.value = song.lyrics || "";

        jsmediatags.read(song.file, {
            onSuccess: (tag) => {
                let coverUrl = null;
                if (tag.tags.picture) {
                    coverUrl = extractCoverUrlFromPicture(tag.tags.picture);
                }

                if (coverUrl) {
                    albumCoverImg.src = coverUrl;
                    previousCoverBackup = coverUrl;
                } else if (folderFallbackCover) {
                    albumCoverImg.src = folderFallbackCover;
                    previousCoverBackup = folderFallbackCover;
                } else {
                    albumCoverImg.src = "./Icon/Default.png";
                    previousCoverBackup = "./Icon/Default.png";
                }

                const extractedLyrics = extractLyricsFromTags(tag.tags);
                if (extractedLyrics && !song.lyrics) {
                    song.lyrics = extractedLyrics;
                    lyricsTextarea.value = extractedLyrics;
                    updateSongLyricsInDB(songId, extractedLyrics);
                } else if (song.lyrics) {
                    lyricsTextarea.value = song.lyrics;
                }

                const trackArtist =
                    tag.tags.artist || song.artist || "UNKNOWN ARTIST";
                const trackTitle = tag.tags.title || song.title;

                if (tag.tags.artist) {
                    song.artist = tag.tags.artist;
                    updateSongMetadataInDB(songId, { artist: tag.tags.artist });
                }
                setVFDText(trackTitle, trackArtist);
            },
            onError: (err) => {
                console.warn("jsmediatags read error:", err);
                if (folderFallbackCover) {
                    albumCoverImg.src = folderFallbackCover;
                    previousCoverBackup = folderFallbackCover;
                } else {
                    albumCoverImg.src = "./Icon/Default.png";
                    previousCoverBackup = "./Icon/Default.png";
                }
                lyricsTextarea.value = song.lyrics || "";
            },
        });

        audioPlayer.addEventListener(
            "loadeddata",
            () => {
                if (autoPlay) {
                    startPlayback();
                } else {
                    updatePlayButtonText();
                }
            },
            { once: true }
        );
    });
}

function updatePlayButtonText() {
    const isPaused = audioPlayer.paused;
    if (isPaused) {
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
        playStatusLabel.textContent = "PLAY";
        compactDisc.classList.remove("spinning");
        laserLed.classList.remove("active");
    } else {
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
        playStatusLabel.textContent = "PAUSE";
        compactDisc.classList.add("spinning");
        laserLed.classList.add("active");
    }

    const currentIndicator = playlistList.querySelector(
        ".now-playing-indicator"
    );
    if (currentIndicator) {
        currentIndicator.classList.toggle("playing", !isPaused);
    }
}

function togglePlayPause() {
    if (playlist.length === 0) return;
    if (isTrayOpen || isTrayClosing) {
        closeTrayFromUnder(() => startPlayback());
        return;
    }
    if (audioPlayer.paused) {
        startPlayback();
    } else {
        audioPlayer.pause();
        updatePlayButtonText();
    }
}

function playNext() {
    if (playlist.length > 0) {
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        loadSong(playlist[currentSongIndex].id, true);
    }
}

function playPrev() {
    if (playlist.length > 0) {
        currentSongIndex =
            (currentSongIndex - 1 + playlist.length) % playlist.length;
        loadSong(playlist[currentSongIndex].id, true);
    }
}

function toggleRepeat() {
    isRepeating = !isRepeating;
    repeatBtn.classList.toggle("active", isRepeating);
    indRepeat.classList.toggle("active", isRepeating);
    if (isRepeating) {
        isShuffling = false;
        shuffleBtn.classList.remove("active");
        indShuffle.classList.remove("active");
    }
}

function toggleShuffle() {
    isShuffling = !isShuffling;
    shuffleBtn.classList.toggle("active", isShuffling);
    indShuffle.classList.toggle("active", isShuffling);
    if (isShuffling) {
        isRepeating = false;
        repeatBtn.classList.remove("active");
        indRepeat.classList.remove("active");
        playlist.sort(() => Math.random() - 0.5);
    } else {
        playlist.sort((a, b) => a.title.localeCompare(b.title));
    }
    displayPlaylist(searchInput ? searchInput.value.trim() : "");
}

/* ============================================
   IndexedDB Storage
   ============================================ */
function saveSongToDB(song, callback) {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const req = objectStore.add(song);
    req.onsuccess = (e) => {
        if (callback) callback(e.target.result);
    };
}

function getSongFromDB(id, callback) {
    const transaction = db.transaction(["songs"], "readonly");
    const objectStore = transaction.objectStore("songs");
    const req = objectStore.get(id);
    req.onsuccess = (e) => {
        const song = e.target.result;
        if (song) {
            if (typeof song.isFavorite === "undefined") song.isFavorite = false;
            callback({ ...song, src: URL.createObjectURL(song.file) });
        } else {
            callback(null);
        }
    };
}

function getAllSongsFromDB(callback) {
    const transaction = db.transaction(["songs"], "readonly");
    const objectStore = transaction.objectStore("songs");
    const req = objectStore.getAll();
    req.onsuccess = (e) => callback(e.target.result);
}

function attemptAutoPlayWithTray() {
    trayHousing.classList.add("ejected-under");
    isTrayOpen = true;
    laserLed.classList.remove("active");

    const canAutoplayDirectly = Boolean(
        navigator.userActivation && navigator.userActivation.hasBeenActive
    );

    if (canAutoplayDirectly) {
        setTimeout(() => {
            closeTrayFromUnder(() => {
                startPlayback();
            });
        }, 350);
        return;
    }

    setupAudioEngine();
    const probePromise = audioPlayer.play();

    if (probePromise !== undefined) {
        probePromise
            .then(() => {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                setTimeout(() => {
                    closeTrayFromUnder(() => {
                        startPlayback();
                    });
                }, 350);
            })
            .catch(() => {
                setVFDText(
                    "TOUCH ANYWHERE TO PLAY",
                    playlist[0]?.title || "DISC READY"
                );
                playBtn.classList.add("pulse-standby");

                let activated = false;
                const handleFirstGesture = () => {
                    if (activated) return;
                    activated = true;

                    window.removeEventListener(
                        "pointerdown",
                        handleFirstGesture,
                        true
                    );
                    window.removeEventListener(
                        "keydown",
                        handleFirstGesture,
                        true
                    );
                    window.removeEventListener(
                        "touchstart",
                        handleFirstGesture,
                        true
                    );

                    playBtn.classList.remove("pulse-standby");

                    setupAudioEngine();
                    if (audioContext && audioContext.state === "suspended") {
                        audioContext.resume();
                    }

                    closeTrayFromUnder(() => {
                        startPlayback();
                    });
                };

                window.addEventListener(
                    "pointerdown",
                    handleFirstGesture,
                    true
                );
                window.addEventListener("keydown", handleFirstGesture, true);
                window.addEventListener("touchstart", handleFirstGesture, true);
            });
    }
}

function loadSavedPlaylist() {
    getAllSongsFromDB((songs) => {
        if (songs && songs.length > 0) {
            playlist = songs;
            updateLyricsVisibility();
            displayPlaylist();

            loadSong(playlist[0].id, false);
            attemptAutoPlayWithTray();
        } else {
            playlist = [];
            updateLyricsVisibility();
            trayHousing.classList.add("ejected-under");
            isTrayOpen = true;
            laserLed.classList.remove("active");
            setVFDText("READY - INSERT DISC", "NO DISC INSERTED");
        }
    });
}

function displayPlaylist(searchTerm = "") {
    let filteredPlaylist = playlist.filter((song) =>
        song.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (showOnlyFavorites) {
        filteredPlaylist = filteredPlaylist.filter((song) => song.isFavorite);
    }

    playlistList.innerHTML = "";
    const currentSongId = playlist[currentSongIndex]?.id;

    filteredPlaylist.forEach((song, index) => {
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";
        const trackNo = String(index + 1).padStart(2, "0");
        const isCurrentSong = song.id === currentSongId;
        const isCurrentlyPlaying = isCurrentSong && !audioPlayer.paused;

        link.dataset.index = song.id;

        if (isCurrentSong) {
            link.classList.add("active-song");

            const playIndicator = document.createElement("span");
            playIndicator.className = `now-playing-indicator ${
                isCurrentlyPlaying ? "playing" : ""
            }`;
            playIndicator.textContent = "▶";
            link.appendChild(playIndicator);
        }

        const titleText = document.createTextNode(`${trackNo}. ${song.title}`);
        link.appendChild(titleText);

        const favBtn = document.createElement("button");
        favBtn.className = "favorite-btn";
        favBtn.dataset.songId = song.id;
        if (song.isFavorite) favBtn.classList.add("is-favorite");
        favBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
        `;

        favBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleFavoriteDirect(song.id, favBtn);
        });

        listItem.appendChild(link);
        listItem.appendChild(favBtn);
        playlistList.appendChild(listItem);
    });
}

function updateSongLyricsInDB(id, lyrics) {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const req = objectStore.get(id);
    req.onsuccess = (e) => {
        const song = e.target.result;
        if (song) {
            song.lyrics = lyrics;
            objectStore.put(song);
        }
    };
}

function updateSongMetadataInDB(id, metadata) {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const req = objectStore.get(id);
    req.onsuccess = (e) => {
        const song = e.target.result;
        if (song) {
            Object.assign(song, metadata);
            objectStore.put(song);
        }
    };
}

function toggleFavoriteDirect(songId, targetBtn) {
    const song = playlist.find((s) => s.id === songId);
    if (!song) return;

    song.isFavorite = !song.isFavorite;
    updateSongMetadataInDB(songId, { isFavorite: song.isFavorite });

    if (playlist[currentSongIndex]?.id === songId) {
        indFav.classList.toggle("active", song.isFavorite);
    }

    if (targetBtn) {
        targetBtn.classList.toggle("is-favorite", song.isFavorite);
        targetBtn.classList.remove("heart-beat");
        void targetBtn.offsetWidth;
        targetBtn.classList.add("heart-beat");
    }

    displayPlaylist(searchInput ? searchInput.value.trim() : "");
}

/* ============================================
   Playlist Drawer Animation View
   ============================================ */
function togglePlaylistView(forceState) {
    const isCurrentlyActive = cdDeck.classList.contains("playlist-active");
    const targetState =
        typeof forceState === "boolean" ? forceState : !isCurrentlyActive;

    cdDeck.classList.toggle("playlist-active", targetState);
    togglePlaylistBtn.classList.toggle("active", targetState);
    togglePlaylistBtn.textContent = targetState ? "↓" : "↑";
}

togglePlaylistBtn.addEventListener("click", () => {
    togglePlaylistView();
});

if (playlistCloseBtn) {
    playlistCloseBtn.addEventListener("click", () => {
        togglePlaylistView(false);
    });
}

/* ============================================
   Key & Button Event Listeners
   ============================================ */
playBtn.addEventListener("click", togglePlayPause);
nextBtn.addEventListener("click", playNext);
prevBtn.addEventListener("click", playPrev);
repeatBtn.addEventListener("click", toggleRepeat);
shuffleBtn.addEventListener("click", toggleShuffle);

playlistList.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (link) {
        event.preventDefault();
        const selectedId = parseInt(link.dataset.index);
        loadSong(selectedId, true);
    }
});

audioPlayer.addEventListener("ended", () => {
    if (isRepeating) {
        startPlayback();
    } else if (isShuffling) {
        let newIndex = Math.floor(Math.random() * playlist.length);
        currentSongIndex = newIndex;
        loadSong(playlist[currentSongIndex].id, true);
    } else {
        playNext();
    }
});

saveLyricsBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        const currentSong = playlist[currentSongIndex];
        currentSong.lyrics = lyricsTextarea.value;
        updateSongLyricsInDB(currentSong.id, lyricsTextarea.value);
    }
});

searchInput.addEventListener("input", (e) => {
    displayPlaylist(e.target.value.trim());
});

favoritesFilterBtn.addEventListener("click", () => {
    showOnlyFavorites = !showOnlyFavorites;
    favoritesFilterBtn.classList.toggle("active", showOnlyFavorites);

    favoritesFilterBtn.classList.remove("heart-beat");
    void favoritesFilterBtn.offsetWidth;
    favoritesFilterBtn.classList.add("heart-beat");

    displayPlaylist(searchInput ? searchInput.value.trim() : "");
});

themeToggleBtn.addEventListener("click", () => {
    themePickerPanel.classList.toggle("open");
    themeToggleBtn.classList.toggle("open");
});

themeOptions.forEach((btn) => {
    btn.addEventListener("click", () => {
        const theme = btn.dataset.theme;
        document.body.setAttribute("data-theme", theme);
        localStorage.setItem("hifi-theme", theme);
    });
});
const savedTheme = localStorage.getItem("hifi-theme") || "dark";
document.body.setAttribute("data-theme", savedTheme);

/* ============================================
   Keyboard Hotkeys
   ============================================ */
document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    switch (e.code) {
        case "Space":
            e.preventDefault();
            togglePlayPause();
            break;
        case "ArrowRight":
            e.preventDefault();
            playNext();
            break;
        case "ArrowLeft":
            e.preventDefault();
            playPrev();
            break;
        case "ArrowUp":
            e.preventDefault();
            updateVolume(currentVolume + 0.05);
            break;
        case "ArrowDown":
            e.preventDefault();
            updateVolume(currentVolume - 0.05);
            break;
        case "KeyM":
            e.preventDefault();
            if (currentVolume > 0) {
                prevVolume = currentVolume;
                updateVolume(0);
            } else {
                updateVolume(prevVolume || 0.5);
            }
            break;
        case "KeyR":
            e.preventDefault();
            toggleRepeat();
            break;
        case "KeyS":
            e.preventDefault();
            toggleShuffle();
            break;
        case "KeyL":
            e.preventDefault();
            togglePlaylistView();
            break;
    }
});

request.onsuccess = (e) => {
    db = e.target.result;
    loadSavedPlaylist();
};
request.onupgradeneeded = (e) => {
    db = e.target.result;
    const store = db.createObjectStore("songs", {
        keyPath: "id",
        autoIncrement: true,
    });
    store.createIndex("title", "title", { unique: false });
};

updateLyricsVisibility();
updateVolume(1);
