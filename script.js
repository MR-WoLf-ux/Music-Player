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

const dbName = "musicPlayerDB";
const dbVersion = 1;
const request = indexedDB.open(dbName, dbVersion);
let db;
let currentSongIndex = 0;
let playlist = [];
let isRepeating = false;
let isShuffling = false;
let isPlaylistCollapsed = false;
let audioContext, analyser, source, dataArray;

// بررسی پشتیبانی Web Audio API
function setupAudioVisualizer() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaElementSource(audioPlayer);

        analyser.fftSize = 256; // کاهش برای عملکرد بهتر در موبایل
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);
        analyser.connect(audioContext.destination);

        visualize();
    } catch (e) {
        console.warn("Web Audio API not supported or failed:", e);
        visualizerCanvas.style.display = "none"; // مخفی کردن در صورت عدم پشتیبانی
    }
}

function visualize() {
    const bufferLength = analyser.frequencyBinCount;
    const barWidth = (visualizerCanvas.width / bufferLength) * 2;
    let x = 0;

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        visualizerCtx.fillStyle = "rgba(0, 0, 0, 0.1)";
        visualizerCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

        for (let i = 0; i < bufferLength; i++) {
            let barHeight = dataArray[i] * 0.3;

            const hue = (i / bufferLength) * 360;
            visualizerCtx.fillStyle = `hsl(${hue}, 80%, 60%)`;
            visualizerCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth - 1, barHeight);

            x += barWidth;
        }
        x = 0;
    }

    draw();
}

function loadSong(songId) {
    getSongFromDB(songId, (song) => {
        if (song) {
            audioPlayer.src = URL.createObjectURL(song.file);
            let displayTitle = song.title;
            const maxLength = 15; // کوتاه‌تر برای موبایل
            if (displayTitle.length > maxLength) {
                displayTitle = displayTitle.substring(0, maxLength - 3) + "...";
            }
            songTitleDisplay.textContent = displayTitle;
            artistDisplay.textContent = song.artist || "Unknown Artist";
            currentSongIndex = playlist.findIndex((s) => s.id === songId);
            audioPlayer.load();

            jsmediatags.read(song.file, {
                onSuccess: (tag) => {
                    const picture = tag.tags.picture;
                    if (picture) {
                        const base64String = btoa(String.fromCharCode(...new Uint8Array(picture.data)));
                        albumCoverImg.src = `data:${picture.format};base64,${base64String}`;
                    } else {
                        albumCoverImg.src = "/images/default-cover.jpg";
                    }

                    if (tag.tags.artist) {
                        artistDisplay.textContent = tag.tags.artist;
                        song.artist = tag.tags.artist;
                        updateSongMetadataInDB(songId, { artist: tag.tags.artist });
                    }

                    displayTitle = tag.tags.title || song.title;
                    if (displayTitle.length > maxLength) {
                        displayTitle = displayTitle.substring(0, maxLength - 3) + "...";
                    }
                    songTitleDisplay.textContent = displayTitle;

                    showNotification(song.title, tag.tags.artist || song.artist);
                },
                onError: (error) => {
                    console.error("Error reading metadata:", error);
                    albumCoverImg.src = "/images/default-cover.jpg";
                    artistDisplay.textContent = song.artist || "Unknown Artist";
                    songTitleDisplay.textContent = displayTitle;
                    showNotification(song.title, song.artist);
                },
            });

            audioPlayer.addEventListener(
                "loadeddata",
                () => {
                    audioPlayer.play().catch((e) => console.error("Playback failed:", e));
                    updatePlayButtonText();
                    lyricsTextarea.value = song.lyrics || "";
                    lyricsBox.classList.add("show");
                    container.classList.add("lyrics-visible");
                    if (!audioContext) setupAudioVisualizer();
                },
                { once: true }
            );
        } else {
            lyricsBox.classList.remove("show");
            container.classList.remove("lyrics-visible");
            albumCoverImg.src = "/images/default-cover.jpg";
        }
    });
}

function updatePlayButtonText() {
    playIcon.style.display = audioPlayer.paused ? "block" : "none";
    pauseIcon.style.display = audioPlayer.paused ? "none" : "block";
}

function saveSongToDB(song, callback) {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const request = objectStore.add(song);

    request.onsuccess = (event) => {
        console.log("Song added to database with ID:", event.target.result);
        callback?.(event.target.result);
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
            callback({ ...song, src: URL.createObjectURL(song.file) });
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
        playlist = songs || [];
        displayPlaylist();
        if (playlist.length > 0) {
            loadSong(playlist[0].id);
        } else {
            lyricsBox.classList.remove("show");
            container.classList.remove("lyrics-visible");
            albumCoverImg.src = "/images/default-cover.jpg";
        }
    });
}

function displayPlaylist(searchTerm = "") {
    const filteredPlaylist = playlist.filter((song) =>
        song.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    playlistList.innerHTML = "";
    filteredPlaylist.forEach((song, index) => {
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = `${index + 1}. ${song.title}`;
        link.dataset.index = song.id;
        link.setAttribute("aria-label", `پخش آهنگ ${song.title}`);
        listItem.appendChild(link);
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
            putRequest.onsuccess = () => console.log("Lyrics updated in database.");
            putRequest.onerror = (error) => console.error("Error updating lyrics:", error);
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
            putRequest.onsuccess = () => console.log("Metadata updated in database.");
            putRequest.onerror = (error) => console.error("Error updating metadata:", error);
        }
    };
}

function showNotification(title, artist) {
    notificationTitle.textContent = title;
    notificationArtist.textContent = artist || "Unknown Artist";

    songNotification.classList.remove("hide");
    songNotification.classList.add("show");

    setTimeout(() => {
        songNotification.classList.remove("show");
        songNotification.classList.add("hide");
    }, 3000);
}

request.onerror = (event) => console.error("Database error:", event.target.errorCode);

request.onsuccess = (event) => {
    db = event.target.result;
    loadSavedPlaylist();
};

request.onupgradeneeded = (event) => {
    db = event.target.result;
    const objectStore = db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
    objectStore.createIndex("title", "title", { unique: false });
};

selectFolderBtn.addEventListener("click", () => folderInput.click());

folderInput.addEventListener("change", (event) => {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const clearRequest = objectStore.clear();

    clearRequest.onsuccess = () => {
        playlist = [];
        playlistList.innerHTML = "";
        const files = event.target.files;
        let loadedSongs = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith("audio/")) {
                const song = {
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    artist: "",
                    file: file,
                    lyrics: "",
                };
                saveSongToDB(song, (id) => {
                    song.id = id;
                    playlist.push(song);
                    displayPlaylist();
                    loadedSongs++;
                    if (loadedSongs === files.length && playlist.length > 0) {
                        loadSong(playlist[0].id);
                    }
                });
            }
        }
        if (files.length === 0) {
            showNotification("خطا", "هیچ فایل صوتی یافت نشد");
        }
    };
    clearRequest.onerror = (event) => console.error("Error clearing Object Store:", event.target.error);
});

saveLyricsBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        const selectedId = playlist[currentSongIndex].id;
        const newLyrics = lyricsTextarea.value;
        updateSongLyricsInDB(selectedId, newLyrics);
        showNotification("موفق", "متن ترانه ذخیره شد");
    }
});

playBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        if (audioPlayer.paused) {
            audioPlayer.play().catch((e) => console.error("Playback failed:", e));
            updatePlayButtonText();
        } else {
            audioPlayer.pause();
            updatePlayButtonText();
        }
    } else {
        showNotification("خطا", "هیچ آهنگی انتخاب نشده است");
    }
});

nextBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        currentSongIndex = isShuffling
            ? Math.floor(Math.random() * playlist.length)
            : (currentSongIndex + 1) % playlist.length;
        loadSong(playlist[currentSongIndex].id);
        updatePlayButtonText();
    }
});

prevBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
        loadSong(playlist[currentSongIndex].id);
        updatePlayButtonText();
    }
});

playlistList.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
        const selectedId = parseInt(event.target.dataset.index);
        loadSong(selectedId);
        updatePlayButtonText();
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
});

volumeSlider.addEventListener("input", () => {
    audioPlayer.volume = volumeSlider.value;
});

seekSlider.addEventListener("input", () => {
    audioPlayer.currentTime = seekSlider.value;
});

audioPlayer.addEventListener("timeupdate", () => {
    seekSlider.max = audioPlayer.duration || 0;
    seekSlider.value = audioPlayer.currentTime;

    const currentTimeMinutes = Math.floor(audioPlayer.currentTime / 60);
    const currentTimeSeconds = Math.floor(audioPlayer.currentTime % 60);
    const durationMinutes = Math.floor(audioPlayer.duration / 60);
    const durationSeconds = Math.floor(audioPlayer.duration % 60);

    currentTimeDisplay.textContent = `${currentTimeMinutes}:${currentTimeSeconds < 10 ? "0" : ""}${currentTimeSeconds}`;
    durationDisplay.textContent = `${isNaN(durationMinutes) ? "0" : durationMinutes}:${isNaN(durationSeconds) ? "00" : durationSeconds < 10 ? "0" : ""}${isNaN(durationSeconds) ? "0" : durationSeconds}`;
});

audioPlayer.addEventListener("ended", () => {
    if (isRepeating) {
        audioPlayer.play();
    } else if (isShuffling) {
        currentSongIndex = Math.floor(Math.random() * playlist.length);
        loadSong(playlist[currentSongIndex].id);
    } else {
        nextBtn.click();
    }
});

searchInput.addEventListener("input", (event) => {
    displayPlaylist(event.target.value.trim());
});

function toggleTheme() {
    document.body.classList.toggle("dark-theme");
    const isDark = document.body.classList.contains("dark-theme");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    themeToggleBtn.textContent = isDark ? "تم روشن" : "تم تیره";
}

window.addEventListener("load", () => {
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-theme");
        themeToggleBtn.textContent = "تم روشن";
    } else {
        themeToggleBtn.textContent = "تم تیره";
    }
});

themeToggleBtn.addEventListener("click", toggleTheme);

togglePlaylistBtn.addEventListener("click", () => {
    isPlaylistCollapsed = !isPlaylistCollapsed;
    musicPlayer.classList.toggle("collapsed");
    togglePlaylistBtn.textContent = isPlaylistCollapsed ? "↓" : "↑";
});

document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
        event.preventDefault();
        playBtn.click();
    } else if (event.code === "ArrowRight") {
        event.preventDefault();
        nextBtn.click();
    } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        prevBtn.click();
    } else if (event.code === "ArrowUp") {
        event.preventDefault();
        audioPlayer.volume = Math.min(1, audioPlayer.volume + 0.1);
        volumeSlider.value = audioPlayer.volume;
    } else if (event.code === "ArrowDown") {
        event.preventDefault();
        audioPlayer.volume = Math.max(0, audioPlayer.volume - 0.1);
        volumeSlider.value = audioPlayer.volume;
    }
});

// پشتیبانی از ژست‌های لمسی
let touchStartX = 0;
let touchEndX = 0;

musicPlayer.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

musicPlayer.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) {
        nextBtn.click(); // سوایپ به چپ
    } else if (touchEndX - touchStartX > 50) {
        prevBtn.click(); // سوایپ به راست
    }
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("service-worker.js")
            .then((registration) => console.log("Service Worker registered:", registration))
            .catch((error) => console.error("Service Worker registration failed:", error));
    });
}
