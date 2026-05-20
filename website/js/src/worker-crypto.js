// Web Worker — SHA-256 of an article body computed off the main thread.
// Spawned by the Web Crypto experience in experiences.js. Receives a
// MessagePort and posts back the hex digest, then is terminated by the
// caller.

self.addEventListener("message", async (event) => {
    const port = event.ports[0];
    const { text } = event.data || {};
    if (!text || !port) {
        port?.postMessage("");
        return;
    }
    try {
        const bytes = new TextEncoder().encode(text);
        const digest = await self.crypto.subtle.digest("SHA-256", bytes);
        const hex = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        port.postMessage(hex);
    } catch {
        port.postMessage("");
    }
});
