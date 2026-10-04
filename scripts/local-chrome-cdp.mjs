// Small transport for repository-owned, local Chrome profiling fixtures.
export class Cdp {
    constructor(url) {
        this.socket = new WebSocket(url);
        this.nextId = 0;
        this.pending = new Map();
        this.listeners = new Map();
        this.open = new Promise((resolveOpen, reject) => {
            this.socket.addEventListener('open', resolveOpen, { once: true });
            this.socket.addEventListener('error', reject, { once: true });
        });
        this.socket.addEventListener('message', (message) => {
            const data = JSON.parse(message.data);
            if (data.id) {
                const pending = this.pending.get(data.id);
                if (!pending) return;
                this.pending.delete(data.id);
                if (data.error) pending.reject(Object.assign(new Error(`${pending.method}: ${data.error.message}`), { cdp: data.error }));
                else pending.resolve(data.result);
            } else this.listeners.get(data.method)?.forEach((fn) => fn(data.params));
        });
    }
    async command(method, params = {}, sessionId) {
        await this.open;
        const id = ++this.nextId;
        const result = new Promise((resolveCommand, reject) => this.pending.set(id, { resolve: resolveCommand, reject, method }));
        this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        return result;
    }
    on(method, fn) {
        if (!this.listeners.has(method)) this.listeners.set(method, new Set());
        this.listeners.get(method).add(fn);
        return () => this.listeners.get(method).delete(fn);
    }
    once(method) { return new Promise((resolveOnce) => { const off = this.on(method, (data) => { off(); resolveOnce(data); }); }); }
    close() { this.socket.close(); }
}
