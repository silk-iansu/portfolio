import { nowPlayingConfig } from "../data/nowPlayingConfig";

function formatTime(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function initNowPlaying() {
  const card = document.getElementById("spotify-now-playing");
  if (!card) return;

  const cover = card.querySelector(".about-wrapper__spotify-cover");
  const coverImg = card.querySelector(".about-wrapper__spotify-cover-img");
  const track = card.querySelector(".about-wrapper__spotify-track");
  const artist = card.querySelector(".about-wrapper__spotify-artist");
  const status = card.querySelector(".about-wrapper__spotify-status");
  const fill = card.querySelector(".about-wrapper__spotify-progress-fill");
  const timeCurrent = card.querySelector(
    ".about-wrapper__spotify-time-current"
  );
  const timeRemaining = card.querySelector(
    ".about-wrapper__spotify-time-remaining"
  );

  const state = {
    trackKey: null,
    durationMs: 0,
    baseProgressMs: 0,
    lastSyncTime: 0,
  };

  let hasRenderedOnce = false;
  let tickTimerId = null;
  let pollTimerId = null;

  coverImg.addEventListener("error", () => {
    cover.classList.remove("about-wrapper__spotify-cover--has-image");
  });

  function render(progressMs) {
    const progress = Math.min(Math.max(progressMs, 0), state.durationMs || 0);
    const percent = state.durationMs ? (progress / state.durationMs) * 100 : 0;
    fill.style.width = `${percent}%`;
    timeCurrent.textContent = formatTime(progress);
    timeRemaining.textContent = `-${formatTime(
      (state.durationMs || 0) - progress
    )}`;
  }

  function stopTicking() {
    if (tickTimerId) {
      clearInterval(tickTimerId);
      tickTimerId = null;
    }
  }

  function tick() {
    const elapsed = performance.now() - state.lastSyncTime;
    const progress = state.baseProgressMs + elapsed;

    if (state.durationMs > 0 && progress >= state.durationMs) {
      stopTicking();
      render(state.durationMs);
      sync();
      return;
    }

    render(progress);
  }

  function startTicking() {
    stopTicking();
    tickTimerId = setInterval(tick, nowPlayingConfig.tickIntervalMs);
  }

  function showOffline() {
    stopTicking();
    card.dataset.state = "offline";
  }

  function showTrack(data, trackChanged) {
    card.dataset.state = "track";

    if (trackChanged) {
      track.textContent = data.title;
      artist.textContent = data.artist;

      if (data.albumImageUrl) {
        coverImg.src = data.albumImageUrl;
        cover.classList.add("about-wrapper__spotify-cover--has-image");
      } else {
        cover.classList.remove("about-wrapper__spotify-cover--has-image");
      }
    }

    status.textContent = data.isPlaying ? "Now Playing" : "Last Played";
    status.classList.toggle(
      "about-wrapper__spotify-status--live",
      data.isPlaying
    );
    fill.classList.toggle(
      "about-wrapper__spotify-progress-fill--live",
      data.isPlaying
    );

    state.durationMs = data.durationMs || 0;
    state.baseProgressMs = data.isPlaying ? data.progressMs || 0 : 0;
    state.lastSyncTime = performance.now();

    if (data.isPlaying) {
      render(state.baseProgressMs);
      startTicking();
    } else {
      stopTicking();
      render(0);
    }
  }

  async function sync() {
    try {
      const res = await fetch(nowPlayingConfig.jsonEndpoint, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`unexpected status ${res.status}`);
      const data = await res.json();

      if (!data || data.error || !data.title) {
        showOffline();
        hasRenderedOnce = true;
        return;
      }

      const trackKey = data.trackUrl || `${data.title}|${data.artist}`;
      const trackChanged = trackKey !== state.trackKey;
      state.trackKey = trackKey;
      showTrack(data, trackChanged);
      hasRenderedOnce = true;
    } catch (e) {
      if (!hasRenderedOnce) {
        card.dataset.state = "hidden";
      }
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopTicking();
      if (pollTimerId) {
        clearInterval(pollTimerId);
        pollTimerId = null;
      }
    } else {
      sync();
      if (!pollTimerId) {
        pollTimerId = setInterval(sync, nowPlayingConfig.pollIntervalMs);
      }
    }
  });

  sync();
  pollTimerId = setInterval(sync, nowPlayingConfig.pollIntervalMs);
}
