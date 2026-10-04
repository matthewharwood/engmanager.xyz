import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../website/js/src/payment-provider.js', import.meta.url), 'utf8');
function harness() {
    const window = {}, nodes = [], timers = new Map();
    let id = 0;
    const context = vm.createContext({ window, Promise, Error,
        document: { createElement: () => ({ remove() { this.removed = true; } }), head: { append(node) { nodes.push(node); } } },
        setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(key) { timers.delete(key); },
    });
    const mount = () => vm.runInContext(source, context);
    mount();
    return { window, nodes, timers, mount, load: () => window.__engPayments.loadStripe(),
        expire() { for (const fn of [...timers.values()]) fn(); },
    };
}

test('a storefront mount makes no provider request and checkout intents share one native script', async () => {
    const h = harness(); h.mount();
    assert.equal(h.nodes.length, 0);
    const first = h.load(), second = h.load(); assert.equal(first, second);
    assert.equal(h.nodes.length, 1); assert.equal(h.nodes[0].src, 'https://js.stripe.com/v3'); assert.equal(h.nodes[0].async, true);
    h.window.Stripe = () => {}; h.nodes[0].onload(); await first;
    assert.equal(h.timers.size, 0); await h.load(); h.mount(); await h.load();
    assert.equal(h.nodes.length, 1, 'retained-page mounts reuse the initialized provider');
});

test('provider errors remove their script and allow a fresh checkout attempt', async () => {
    const h = harness(); const failed = h.load(); const error = assert.rejects(failed, /could not load/);
    h.nodes[0].onerror(); await error;
    assert.equal(h.nodes[0].removed, true); assert.equal(h.timers.size, 0);
    const retry = h.load(); assert.equal(h.nodes.length, 2); h.window.Stripe = () => {}; h.nodes[1].onload(); await retry;
});

test('a stalled or non-initializing provider cannot hold checkout indefinitely', async () => {
    const h = harness(); const stalled = h.load(); const timeout = assert.rejects(stalled, /timed out/); h.expire(); await timeout;
    assert.equal(h.nodes[0].removed, true); assert.equal(h.nodes[0].onload, null);
    const invalid = h.load(); const error = assert.rejects(invalid, /did not initialize/); h.nodes[1].onload(); await error;
    assert.equal(h.nodes[1].removed, true);
    h.window.Stripe = () => {}; await h.load(); assert.equal(h.nodes.length, 2, 'a late successful provider can be reused');
});
