const audioPlayer = document.getElementById("audio-player");
const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const volumeSlider = document.getElementById("volume-slider");
const seekSlider = document.getElementById("seek-slider");
const currentTimeDisplay = document.getElementById("current-time");
const durationDisplay = document.getElementById("duration");
const playlistList = document.getElementById("playlist-list");
const songTitleDisplay = document.getElementById("song-title");
const repeatBtn = document.getElementById("repeat-btn");
const shuffleBtn = document.getElementById("shuffle-btn");
const artistDisplay = document.getElementById("artist");
const folderInput = document.getElementById("folder-input");
const selectFolderBtn = document.getElementById("select-folder-btn");
const lyricsBox = document.getElementById("lyrics-box");
const lyricsTextarea = document.getElementById("lyrics-textarea");
const saveLyricsBtn = document.getElementById("save-lyrics-btn");
const container = document.querySelector(".container");
const searchInput = document.getElementById("search-input");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const albumCoverImg = document.getElementById("album-cover-img");
const songNotification = document.getElementById("song-notification");
const notificationTitle = document.getElementById("notification-title");
const notificationArtist = document.getElementById("notification-artist");
const togglePlaylistBtn = document.getElementById("toggle-playlist-btn");
const musicPlayer = document.querySelector(".music-player");
const visualizerCanvas = document.getElementById("visualizer");
const visualizerCtx = visualizerCanvas.getContext("2d");
const themePickerPanel = document.getElementById("theme-picker-panel");
const themeOptions = document.querySelectorAll(".theme-option");
const favoritesFilterBtn = document.getElementById("favorites-filter-btn");

const dbName = "musicPlayerDB";
const dbVersion = 1;
const request = indexedDB.open(dbName, dbVersion);
let db;
let currentSongIndex = 0;
let playlist = [];
let isRepeating = false;
let isShuffling = false;
let isPlaylistCollapsed = false;
let showOnlyFavorites = false;

// Web Audio API Setup for Visualizer & Fade
let audioContext, analyser, source, dataArray;
let gainNode;
let fadeInterval = null;
let isFadingOut = false;

const FADE_DURATION = 1500;
const FADE_STEPS = 30;

function setupAudioVisualizer() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    gainNode = audioContext.createGain();
    source = audioContext.createMediaElementSource(audioPlayer);

    analyser.fftSize = 512;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // مسیر: source → gainNode → analyser → destination
    source.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    gainNode.gain.value = audioPlayer.volume;

    visualize();
}

/* ============================================
   Fade In / Fade Out (فقط برای تغییر آهنگ)
   ============================================ */
function fadeIn(duration = FADE_DURATION, callback) {
    if (!gainNode || !audioContext) {
        if (callback) callback();
        return;
    }

    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }

    isFadingOut = false;

    const targetVolume = audioPlayer.volume;
    const stepTime = duration / FADE_STEPS;
    let currentStep = 0;

    gainNode.gain.value = 0;

    fadeInterval = setInterval(() => {
        currentStep++;
        const progress = currentStep / FADE_STEPS;
        gainNode.gain.value = targetVolume * progress;

        if (currentStep >= FADE_STEPS) {
            clearInterval(fadeInterval);
            fadeInterval = null;
            gainNode.gain.value = targetVolume;
            if (callback) callback();
        }
    }, stepTime);
}

function fadeOut(duration = FADE_DURATION, callback) {
    if (!gainNode || !audioContext) {
        if (callback) callback();
        return;
    }

    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }

    isFadingOut = true;

    const startVolume = gainNode.gain.value;
    const stepTime = duration / FADE_STEPS;
    let currentStep = 0;

    fadeInterval = setInterval(() => {
        currentStep++;
        const progress = currentStep / FADE_STEPS;
        gainNode.gain.value = startVolume * (1 - progress);

        if (currentStep >= FADE_STEPS) {
            clearInterval(fadeInterval);
            fadeInterval = null;
            gainNode.gain.value = 0;
            if (callback) callback();
        }
    }, stepTime);
}

function visualize() {
    const bufferLength = analyser.frequencyBinCount;
    const barWidth = (visualizerCanvas.width / bufferLength) * 3;
    let x = 0;
    let waveOffset = 0;

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        const gradientBg = visualizerCtx.createLinearGradient(
            0,
            0,
            0,
            visualizerCanvas.height
        );
        gradientBg.addColorStop(0, "rgba(0, 0, 50, 0.2)");
        gradientBg.addColorStop(1, "rgba(0, 100, 200, 0.1)");
        visualizerCtx.fillStyle = gradientBg;
        visualizerCtx.fillRect(
            0,
            0,
            visualizerCanvas.width,
            visualizerCanvas.height
        );

        for (let i = 0; i < bufferLength; i++) {
            let barHeight = dataArray[i] * 0.4;
            const wave = Math.sin(i * 0.1 + waveOffset) * 10;
            barHeight += wave;

            const hue = (i / bufferLength) * 360 + waveOffset * 10;
            const gradient = visualizerCtx.createLinearGradient(
                0,
                visualizerCanvas.height,
                0,
                visualizerCanvas.height - barHeight
            );
            gradient.addColorStop(0, `hsla(${hue}, 100%, 50%, 0.9)`);
            gradient.addColorStop(1, `hsla(${hue + 60}, 100%, 70%, 0.7)`);

            visualizerCtx.fillStyle = gradient;
            visualizerCtx.shadowBlur = 20;
            visualizerCtx.shadowColor = `hsla(${hue}, 100%, 50%, 0.6)`;

            visualizerCtx.beginPath();
            if (visualizerCtx.roundRect) {
                visualizerCtx.roundRect(
                    x,
                    visualizerCanvas.height - barHeight,
                    barWidth - 2,
                    barHeight,
                    10
                );
            } else {
                visualizerCtx.rect(
                    x,
                    visualizerCanvas.height - barHeight,
                    barWidth - 2,
                    barHeight
                );
            }
            visualizerCtx.fill();

            const glowGradient = visualizerCtx.createLinearGradient(
                0,
                visualizerCanvas.height - barHeight,
                0,
                visualizerCanvas.height - barHeight - 10
            );
            glowGradient.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.5)`);
            glowGradient.addColorStop(1, `hsla(${hue}, 100%, 70%, 0)`);
            visualizerCtx.fillStyle = glowGradient;
            visualizerCtx.fillRect(
                x,
                visualizerCanvas.height - barHeight - 10,
                barWidth - 2,
                10
            );

            x += barWidth + 1;
        }

        waveOffset += 0.05;
        x = 0;
    }

    draw();
}

function loadSong(songId) {
    getSongFromDB(songId, (song) => {
        if (song) {
            audioPlayer.src = URL.createObjectURL(song.file);
            let displayTitle = song.title;
            const maxLength = 20;
            if (displayTitle.length > maxLength) {
                displayTitle =
                    displayTitle.substring(0, maxLength - 3) +
                    "... " +
                    (song.artist || "Unknown Artist");
            }
            songTitleDisplay.textContent = displayTitle;
            artistDisplay.textContent = song.artist || "Unknown Artist";
            currentSongIndex = playlist.findIndex((s) => s.id === songId);
            displayPlaylist();
            audioPlayer.load();

            jsmediatags.read(song.file, {
                onSuccess: (tag) => {
                    const picture = tag.tags.picture;
                    if (picture) {
                        const base64String = btoa(
                            String.fromCharCode(...new Uint8Array(picture.data))
                        );
                        const imageUrl = `data:${picture.format};base64,${base64String}`;
                        albumCoverImg.src = imageUrl;
                    } else {
                        albumCoverImg.src = "/Icon/Default.png";
                    }

                    if (tag.tags.artist) {
                        artistDisplay.textContent = tag.tags.artist;
                        song.artist = tag.tags.artist;
                        updateSongMetadataInDB(songId, {
                            artist: tag.tags.artist,
                        });
                    }

                    displayTitle = tag.tags.title || song.title;
                    if (displayTitle.length > maxLength) {
                        displayTitle =
                            displayTitle.substring(0, maxLength - 3) +
                            "... " +
                            (tag.tags.artist ||
                                song.artist ||
                                "Unknown Artist");
                    }
                    songTitleDisplay.textContent = displayTitle;

                    showNotification(
                        song.title,
                        tag.tags.artist || song.artist
                    );
                },
                onError: (error) => {
                    console.error("Error reading metadata:", error);
                    albumCoverImg.src = "/Icon/Default.png";
                    artistDisplay.textContent = song.artist || "Unknown Artist";
                    songTitleDisplay.textContent = displayTitle;
                    showNotification(song.title, song.artist);
                },
            });

            audioPlayer.addEventListener(
                "loadeddata",
                () => {
                    if (gainNode) {
                        gainNode.gain.value = 0;
                    }

                    const playPromise = audioPlayer.play();
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                fadeIn();
                                updatePlayButtonText();
                            })
                            .catch((error) => {
                                console.warn("Autoplay blocked:", error);
                                updatePlayButtonText();
                            });
                    }

                    lyricsTextarea.value = song.lyrics || "";
                    lyricsBox.classList.add("show");
                    container.classList.add("lyrics-visible");
                },
                { once: true }
            );
        } else {
            lyricsBox.classList.remove("show");
            container.classList.remove("lyrics-visible");
            albumCoverImg.src = "/Icon/Default.png";
        }
    });
}

function updatePlayButtonText() {
    if (audioPlayer.paused) {
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
    } else {
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
    }
}

function saveSongToDB(song, callback) {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const request = objectStore.add(song);

    request.onsuccess = (event) => {
        console.log("Song added to database with ID:", event.target.result);
        if (callback) callback(event.target.result);
    };
    request.onerror = (event) => {
        console.error("Error adding song:", event.target.error);
    };
}

function getSongFromDB(id, callback) {
    const transaction = db.transaction(["songs"], "readonly");
    const objectStore = transaction.objectStore("songs");
    const request = objectStore.get(id);

    request.onsuccess = (event) => {
        const song = event.target.result;
        if (song) {
            if (typeof song.isFavorite === "undefined") {
                song.isFavorite = false;
            }
            const blob = song.file;
            const url = URL.createObjectURL(blob);
            callback({ ...song, src: url });
        } else {
            callback(null);
        }
    };
}

function getAllSongsFromDB(callback) {
    const transaction = db.transaction(["songs"], "readonly");
    const objectStore = transaction.objectStore("songs");
    const request = objectStore.getAll();
    request.onsuccess = (event) => {
        callback(event.target.result);
    };
}

function loadSavedPlaylist() {
    getAllSongsFromDB((songs) => {
        if (songs) {
            songs.forEach((song) => {
                if (typeof song.isFavorite === "undefined") {
                    song.isFavorite = false;
                }
            });
            playlist = songs;
            displayPlaylist();
            if (playlist.length > 0) {
                loadSong(playlist[0].id);
            } else {
                lyricsBox.classList.remove("show");
                container.classList.remove("lyrics-visible");
                albumCoverImg.src = "/Icon/Default.png";
            }
        } else {
            lyricsBox.classList.remove("show");
            container.classList.remove("lyrics-visible");
            albumCoverImg.src = "/Icon/Default.png";
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

    const currentSongId =
        playlist[currentSongIndex] && playlist[currentSongIndex].id;

    filteredPlaylist.forEach((song, index) => {
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = `${index + 1}. ${song.title}`;
        link.dataset.index = song.id;

        if (song.id === currentSongId) {
            link.classList.add("active-song");
        }

        const favBtn = document.createElement("button");
        favBtn.className = "favorite-btn";
        favBtn.dataset.songId = song.id;
        if (song.isFavorite) {
            favBtn.classList.add("is-favorite");
        }
        favBtn.setAttribute(
            "aria-label",
            song.isFavorite ? "حذف از موردعلاقه‌ها" : "افزودن به موردعلاقه‌ها"
        );
        favBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
        `;

        listItem.appendChild(link);
        listItem.appendChild(favBtn);
        playlistList.appendChild(listItem);
    });
}

function updateSongLyricsInDB(id, lyrics) {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const getRequest = objectStore.get(id);

    getRequest.onsuccess = (event) => {
        const song = event.target.result;
        if (song) {
            song.lyrics = lyrics;
            const putRequest = objectStore.put(song);
            putRequest.onsuccess = () => {
                console.log("Lyrics updated in database.");
            };
            putRequest.onerror = (error) => {
                console.error("Error updating lyrics:", error);
            };
        }
    };
}

function updateSongMetadataInDB(id, metadata) {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const getRequest = objectStore.get(id);

    getRequest.onsuccess = (event) => {
        const song = event.target.result;
        if (song) {
            Object.assign(song, metadata);
            const putRequest = objectStore.put(song);
            putRequest.onsuccess = () => {
                console.log("Metadata updated in database.");
            };
            putRequest.onerror = (error) => {
                console.error("Error updating metadata:", error);
            };
        }
    };
}

function toggleFavorite(songId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const song = playlist.find((s) => s.id === songId);
    if (!song) return;

    song.isFavorite = !song.isFavorite;
    updateSongMetadataInDB(songId, { isFavorite: song.isFavorite });

    if (showOnlyFavorites && !song.isFavorite) {
        displayPlaylist(searchInput.value.trim());
        return;
    }

    const favBtn = document.querySelector(
        `.favorite-btn[data-song-id="${songId}"]`
    );
    if (favBtn) {
        favBtn.classList.toggle("is-favorite", song.isFavorite);
        favBtn.setAttribute(
            "aria-label",
            song.isFavorite ? "حذف از موردعلاقه‌ها" : "افزودن به موردعلاقه‌ها"
        );

        favBtn.classList.remove("heart-beat");
        void favBtn.offsetWidth;
        favBtn.classList.add("heart-beat");

        favBtn.addEventListener(
            "animationend",
            () => {
                favBtn.classList.remove("heart-beat");
            },
            { once: true }
        );
    }
}

/* ============================================
   نوتیفیکیشن (رفع باگ‌ها)
   ============================================ */
let notificationTimeout = null;
let notificationHideTimeout = null;

function showNotification(title, artist) {
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
    if (notificationHideTimeout) {
        clearTimeout(notificationHideTimeout);
        notificationHideTimeout = null;
    }

    notificationTitle.textContent = title;
    notificationArtist.textContent = artist || "Unknown Artist";

    songNotification.classList.remove("hide");
    songNotification.classList.add("show");

    notificationTimeout = setTimeout(() => {
        songNotification.classList.remove("show");
        songNotification.classList.add("hide");

        notificationHideTimeout = setTimeout(() => {
            songNotification.classList.remove("hide");
            notificationHideTimeout = null;
        }, 500);

        notificationTimeout = null;
    }, 3000);
}

request.onerror = (event) => {
    console.error("Database error:", event.target.errorCode);
};

request.onsuccess = (event) => {
    db = event.target.result;
    loadSavedPlaylist();
};

request.onupgradeneeded = (event) => {
    db = event.target.result;
    const objectStore = db.createObjectStore("songs", {
        keyPath: "id",
        autoIncrement: true,
    });
    objectStore.createIndex("title", "title", { unique: false });
};

selectFolderBtn.addEventListener("click", () => {
    folderInput.click();
});

folderInput.addEventListener("change", (event) => {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const clearRequest = objectStore.clear();

    clearRequest.onsuccess = () => {
        playlist = [];
        playlistList.innerHTML = "";
        const files = event.target.files;
        let audioFilesCount = 0;
        let loadedSongs = 0;
        for (let i = 0; i < files.length; i++) {
            if (files[i].type.startsWith("audio/")) audioFilesCount++;
        }
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith("audio/")) {
                const song = {
                    title: file.name,
                    artist: "",
                    file: file,
                    lyrics: "",
                    isFavorite: false,
                };
                saveSongToDB(song, (id) => {
                    song.id = id;
                    playlist.push(song);
                    displayPlaylist();
                    loadedSongs++;
                    if (
                        loadedSongs === audioFilesCount &&
                        playlist.length > 0
                    ) {
                        loadSong(playlist[0].id);
                    }
                });
            }
        }
    };
    clearRequest.onerror = (event) => {
        console.error("Error clearing Object Store:", event.target.error);
    };
});

saveLyricsBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        const selectedId = playlist[currentSongIndex].id;
        const newLyrics = lyricsTextarea.value;
        updateSongLyricsInDB(selectedId, newLyrics);
    }
});

/* ============================================
   دکمه‌ی Play/Pause — بدون Fade
   ============================================ */
playBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        if (audioPlayer.paused) {
            if (isFadingOut) return;
            if (audioContext && audioContext.state === "suspended") {
                audioContext.resume();
            }
            if (gainNode) {
                gainNode.gain.value = audioPlayer.volume;
            }
            audioPlayer.play().catch((error) => {
                console.warn("Play failed:", error);
            });
            updatePlayButtonText();
        } else {
            audioPlayer.pause();
            updatePlayButtonText();
        }
    }
});

/* ============================================
   Next/Prev — با Fade
   ============================================ */
nextBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        fadeOut(500, () => {
            currentSongIndex = (currentSongIndex + 1) % playlist.length;
            loadSong(playlist[currentSongIndex].id);
        });
    }
});

prevBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        fadeOut(500, () => {
            currentSongIndex =
                (currentSongIndex - 1 + playlist.length) % playlist.length;
            loadSong(playlist[currentSongIndex].id);
        });
    }
});

playlistList.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
        const selectedId = parseInt(event.target.dataset.index);
        if (
            playlist[currentSongIndex] &&
            playlist[currentSongIndex].id === selectedId
        ) {
            return;
        }
        fadeOut(400, () => {
            loadSong(selectedId);
            updatePlayButtonText();
            lyricsBox.classList.add("show");
            container.classList.add("lyrics-visible");
        });
    }
});

playlistList.addEventListener("click", (event) => {
    const favBtn = event.target.closest(".favorite-btn");
    if (favBtn) {
        const songId = parseInt(favBtn.dataset.songId);
        toggleFavorite(songId, event);
    }
});

repeatBtn.addEventListener("click", () => {
    isRepeating = !isRepeating;
    repeatBtn.classList.toggle("active");
    shuffleBtn.classList.remove("active");
    isShuffling = false;
});

shuffleBtn.addEventListener("click", () => {
    isShuffling = !isShuffling;
    shuffleBtn.classList.toggle("active");
    repeatBtn.classList.remove("active");
    isRepeating = false;
    if (isShuffling) {
        playlist.sort(() => Math.random() - 0.5);
        displayPlaylist();
    } else {
        playlist.sort((a, b) => a.title.localeCompare(b.title));
        displayPlaylist();
    }
});

volumeSlider.addEventListener("input", () => {
    audioPlayer.volume = volumeSlider.value;
    if (!fadeInterval && !isFadingOut) {
        if (gainNode) {
            gainNode.gain.value = audioPlayer.volume;
        }
    }
});

seekSlider.addEventListener("input", () => {
    audioPlayer.currentTime = seekSlider.value;
});

audioPlayer.addEventListener("timeupdate", () => {
    seekSlider.max = audioPlayer.duration;
    seekSlider.value = audioPlayer.currentTime;

    const currentTimeMinutes = Math.floor(audioPlayer.currentTime / 60);
    const currentTimeSeconds = Math.floor(audioPlayer.currentTime % 60);
    const durationMinutes = Math.floor(audioPlayer.duration / 60);
    const durationSeconds = Math.floor(audioPlayer.duration % 60);

    currentTimeDisplay.textContent = `${currentTimeMinutes}:${
        currentTimeSeconds < 10 ? "0" : ""
    }${currentTimeSeconds}`;
    durationDisplay.textContent = `${
        isNaN(durationMinutes) ? "0" : durationMinutes
    }:${isNaN(durationSeconds) ? "0" : ""}${
        isNaN(durationSeconds) ? "0" : durationSeconds < 10 ? "0" : ""
    }${isNaN(durationSeconds) ? "0" : durationSeconds}`;
});

/* ============================================
   اتمام آهنگ — همه با Fade
   ============================================ */
audioPlayer.addEventListener("ended", () => {
    if (isRepeating) {
        // تکرار همین آهنگ - با Fade In
        if (gainNode) gainNode.gain.value = 0;
        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                fadeIn();
                updatePlayButtonText();
            });
        }
    } else if (isShuffling) {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * playlist.length);
        } while (newIndex === currentSongIndex && playlist.length > 1);
        currentSongIndex = newIndex;
        loadSong(playlist[currentSongIndex].id);
    } else {
        nextBtn.click();
    }
});

searchInput.addEventListener("input", (event) => {
    const searchTerm = event.target.value.trim();
    displayPlaylist(searchTerm);
});

favoritesFilterBtn.addEventListener("click", () => {
    showOnlyFavorites = !showOnlyFavorites;
    favoritesFilterBtn.classList.toggle("active", showOnlyFavorites);
    displayPlaylist(searchInput.value.trim());
});

/* ============================================
   مدیریت تم پیشرفته
   ============================================ */
const AVAILABLE_THEMES = [
    "light",
    "dark",
    "ocean",
    "galaxy",
    "forest",
    "sunset",
    "neon",
    "rose",
];
const DEFAULT_THEME = "light";

function applyTheme(themeName) {
    if (!AVAILABLE_THEMES.includes(themeName)) {
        themeName = DEFAULT_THEME;
    }

    document.body.setAttribute("data-theme", themeName);

    if (themeName === "dark") {
        document.body.classList.add("dark-theme");
    } else {
        document.body.classList.remove("dark-theme");
    }

    themeOptions.forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.theme === themeName);
    });

    localStorage.setItem("theme", themeName);
}

function initTheme() {
    const savedTheme = localStorage.getItem("theme") || DEFAULT_THEME;
    applyTheme(savedTheme);
}

themeToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    themePickerPanel.classList.toggle("open");
});

themeOptions.forEach((option) => {
    option.addEventListener("click", () => {
        applyTheme(option.dataset.theme);
    });
});

document.addEventListener("click", (e) => {
    if (
        themePickerPanel.classList.contains("open") &&
        !themePickerPanel.contains(e.target) &&
        !themeToggleBtn.contains(e.target)
    ) {
        themePickerPanel.classList.remove("open");
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && themePickerPanel.classList.contains("open")) {
        themePickerPanel.classList.remove("open");
    }
});

initTheme();

if (!audioContext) setupAudioVisualizer();

/* ============================================
   تاگل پلی‌لیست
   ============================================ */
togglePlaylistBtn.addEventListener("click", () => {
    isPlaylistCollapsed = !isPlaylistCollapsed;
    if (isPlaylistCollapsed) {
        musicPlayer.classList.add("collapsed");
        togglePlaylistBtn.textContent = "↓";
    } else {
        musicPlayer.classList.remove("collapsed");
        togglePlaylistBtn.textContent = "↑";
    }
});

/* ============================================
   کلیدهای میانبر
   ============================================ */
document.addEventListener("keydown", (event) => {
    const tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (event.code === "Space") {
        event.preventDefault();
        if (playlist.length === 0) return;

        if (audioPlayer.paused) {
            if (isFadingOut) return;
            if (audioContext && audioContext.state === "suspended") {
                audioContext.resume();
            }
            if (gainNode) {
                gainNode.gain.value = audioPlayer.volume;
            }
            audioPlayer.play().catch((error) => {
                console.warn("Play failed:", error);
            });
            updatePlayButtonText();
        } else {
            audioPlayer.pause();
            updatePlayButtonText();
        }
    } else if (event.code === "ArrowRight") {
        event.preventDefault();
        if (playlist.length > 0) {
            fadeOut(500, () => {
                currentSongIndex = (currentSongIndex + 1) % playlist.length;
                loadSong(playlist[currentSongIndex].id);
                updatePlayButtonText();
            });
        }
    } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        if (playlist.length > 0) {
            fadeOut(500, () => {
                currentSongIndex =
                    (currentSongIndex - 1 + playlist.length) % playlist.length;
                loadSong(playlist[currentSongIndex].id);
                updatePlayButtonText();
            });
        }
    } else if (event.code === "ArrowUp") {
        event.preventDefault();
        audioPlayer.volume = Math.min(1, audioPlayer.volume + 0.1);
        volumeSlider.value = audioPlayer.volume;
        if (!fadeInterval && !isFadingOut && gainNode) {
            gainNode.gain.value = audioPlayer.volume;
        }
    } else if (event.code === "ArrowDown") {
        event.preventDefault();
        audioPlayer.volume = Math.max(0, audioPlayer.volume - 0.1);
        volumeSlider.value = audioPlayer.volume;
        if (!fadeInterval && !isFadingOut && gainNode) {
            gainNode.gain.value = audioPlayer.volume;
        }
    }
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./service-worker.js")
            .then((registration) => {
                console.log("Service Worker registered:", registration);
            })
            .catch((error) => {
                console.error("Service Worker registration failed:", error);
            });
    });
}
