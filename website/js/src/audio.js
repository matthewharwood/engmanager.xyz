// Shared SFX playback service.
//
// One Audio element per "channel" — repeated calls on the same channel
// cancel the in-flight clip and replay from the start. Channels are
// arbitrary strings so independent sounds (theme cycler, trash drop,
// keystroke click) don't stomp each other while still being cancelable
// within their own stream.
//
// API:
//   window.__engAudio.play(channel, url, options?)
//     - channel: string. Cancels any in-flight clip on this channel
//       before starting the new one.
//     - url: string. No-ops silently if falsy (so callers can pass
//       window.__engSfxUrls?.foo without guarding).
//     - options.volume: 0..1. Default 0.5.
//
//   window.__engAudio.stop(channel)
//     - Stop the clip on this channel (if any) without replaying.
//
// Channel naming convention (used across the codebase):
//   "theme"    - js/theme-toggle.js (per-theme stinger on cycle)
//   "trash"    - js/trash-drag.js (drop into trash can)
//   "keyclick" - js/search-keyclick.js (keystrokes inside search)
//
// Loaded before any consumer (defer + listed first in <head>) so
// window.__engAudio is set when their click/keydown handlers fire.

(() => {
    const channels = new Map();

    window.__engAudio = {
        play(channel, url, options) {
            const volume = (options && options.volume) ?? 0.5;
            if (!url) return;
            this.stop(channel);
            try {
                const audio = new Audio(url);
                audio.volume = volume;
                channels.set(channel, audio);
                audio.addEventListener("ended", () => {
                    if (channels.get(channel) === audio) {
                        channels.delete(channel);
                    }
                });
                audio.play().catch(() => {});
            } catch {}
        },

        stop(channel) {
            const existing = channels.get(channel);
            if (!existing) return;
            try {
                existing.pause();
                existing.currentTime = 0;
            } catch {}
            channels.delete(channel);
        },
    };
})();
