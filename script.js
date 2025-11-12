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

// Web Audio API Setup for Visualizer
let audioContext, analyser, source, dataArray;
function setupAudioVisualizer() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaElementSource(audioPlayer);

    analyser.fftSize = 512; // تعداد میله‌ها رو بیشتر می‌کنم برای جزئیات بیشتر
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    visualize();
}

function visualize() {
    const bufferLength = analyser.frequencyBinCount;
    const barWidth = (visualizerCanvas.width / bufferLength) * 3; // پهن‌تر برای پر کردن فضا
    let x = 0;
    let waveOffset = 0; // برای افکت موج‌دار

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        // گرادیانت پس‌زمینه پویا
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

        // رسم میله‌ها
        for (let i = 0; i < bufferLength; i++) {
            let barHeight = dataArray[i] * 0.4; // مقیاس بزرگ‌تر برای جلوه بیشتر

            // اضافه کردن افکت موج‌دار
            const wave = Math.sin(i * 0.1 + waveOffset) * 10;
            barHeight += wave;

            // گرادیانت پویا برای میله‌ها
            const hue = (i / bufferLength) * 360 + waveOffset * 10; // رنگ متغیر با موج
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

            // میله‌ها با گوشه‌های گرد و انیمیشن نرم
            visualizerCtx.beginPath();
            visualizerCtx.roundRect(
                x,
                visualizerCanvas.height - barHeight,
                barWidth - 2,
                barHeight,
                10
            );
            visualizerCtx.fill();

            // افکت درخشش در بالای میله‌ها
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

        // به‌روزرسانی افکت موج‌دار
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
            const maxLength = 20; // حداکثر طول اسم آهنگ قبل از کوتاه شدن
            if (displayTitle.length > maxLength) {
                displayTitle =
                    displayTitle.substring(0, maxLength - 3) +
                    "... " +
                    (song.artist || "Unknown Artist");
            }
            songTitleDisplay.textContent = displayTitle;
            artistDisplay.textContent = song.artist || "Unknown Artist";
            currentSongIndex = playlist.findIndex((s) => s.id === songId);
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

                    // به‌روزرسانی عنوان با توجه به طول
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
                    songTitleDisplay.textContent = displayTitle; // استفاده از عنوان قبلی در صورت خطا
                    showNotification(song.title, song.artist);
                },
            });

            audioPlayer.addEventListener(
                "loadeddata",
                () => {
                    audioPlayer.play();
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
        let loadedSongs = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith("audio/")) {
                const song = {
                    title: file.name,
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

playBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        if (audioPlayer.paused) {
            audioPlayer.play();
            updatePlayButtonText();
        } else {
            audioPlayer.pause();
            updatePlayButtonText();
        }
    }
});

nextBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        loadSong(playlist[currentSongIndex].id);
        updatePlayButtonText();
    }
});

prevBtn.addEventListener("click", () => {
    if (playlist.length > 0) {
        currentSongIndex =
            (currentSongIndex - 1 + playlist.length) % playlist.length;
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
});

seekSlider.addEventListener("input", () => {
    audioPlayer.currentTime = seekSlider.value;
});

audioPlayer.addEventListener("timeupdate", () => {
    seekSlider.max = audioPlayer.duration;
    seekSlider.value = audioPlayer.currentTime;

    // اصلاح نمایش زمان با اضافه کردن صفر
    const currentTimeMinutes = Math.floor(audioPlayer.currentTime / 60);
    const currentTimeSeconds = Math.floor(audioPlayer.currentTime % 60);
    const durationMinutes = Math.floor(audioPlayer.duration / 60);
    const durationSeconds = Math.floor(audioPlayer.duration % 60);

    // فرمت زمان با دو رقم برای ثانیه‌ها
    currentTimeDisplay.textContent = `${currentTimeMinutes}:${
        currentTimeSeconds < 10 ? "0" : ""
    }${currentTimeSeconds}`;
    durationDisplay.textContent = `${
        isNaN(durationMinutes) ? "0" : durationMinutes
    }:${isNaN(durationSeconds) ? "0" : ""}${
        isNaN(durationSeconds) ? "0" : durationSeconds < 10 ? "0" : ""
    }${isNaN(durationSeconds) ? "0" : durationSeconds}`;
});

audioPlayer.addEventListener("ended", () => {
    if (isRepeating) {
        audioPlayer.play();
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

playlistList.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
        const selectedId = parseInt(event.target.dataset.index);
        loadSong(selectedId);
        updatePlayButtonText();
        lyricsBox.classList.add("show");
        container.classList.add("lyrics-visible");
    }
});

searchInput.addEventListener("input", (event) => {
    const searchTerm = event.target.value.trim();
    displayPlaylist(searchTerm);
});

function toggleTheme() {
    document.body.classList.toggle("dark-theme");
    if (document.body.classList.contains("dark-theme")) {
        localStorage.setItem("theme", "dark");
        themeToggleBtn.textContent = "تم روشن";
    } else {
        localStorage.setItem("theme", "light");
        themeToggleBtn.textContent = "تم تیره";
    }
}

window.addEventListener("load", () => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.body.classList.add("dark-theme");
        themeToggleBtn.textContent = "تم روشن";
    } else {
        themeToggleBtn.textContent = "تم تیره";
    }
});

themeToggleBtn.addEventListener("click", toggleTheme);

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

document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
        event.preventDefault();
        if (audioPlayer.paused) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
        updatePlayButtonText();
    } else if (event.code === "ArrowRight") {
        event.preventDefault();
        if (playlist.length > 0) {
            currentSongIndex = (currentSongIndex + 1) % playlist.length;
            loadSong(playlist[currentSongIndex].id);
            updatePlayButtonText();
        }
    } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        if (playlist.length > 0) {
            currentSongIndex =
                (currentSongIndex - 1 + playlist.length) % playlist.length;
            loadSong(playlist[currentSongIndex].id);
            updatePlayButtonText();
        }
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}
