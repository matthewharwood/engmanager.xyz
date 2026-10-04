import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../website/js/src/journey-state.js', import.meta.url), 'utf8');
const key = 'engmanager.reading-progress.v1';
const article = (slug) => ({ slug, path: `/articles/${slug}`, title: `Title of ${slug}` });
const manifest = { version: 1, articles: [article('newest'), article('second'), article('oldest')] };

function harness({ storage = new Map(), disabled = false, writeDisabled = false, roster = manifest } = {}) {
    const listeners = new Map(), notifications = [];
    const window = {
        __journeyArticles: roster,
        addEventListener(type, callback) {
            const list = listeners.get(type) || [];
            list.push(callback); listeners.set(type, list);
        },
        dispatchEvent(event) {
            notifications.push(event);
            for (const callback of listeners.get(event.type) || []) callback(event);
        },
    };
    const localStorage = {
        getItem(name) { if (disabled) throw new Error('storage disabled'); return storage.get(name) ?? null; },
        setItem(name, value) { if (disabled || writeDisabled) throw new Error('quota exceeded'); storage.set(name, value); },
    };
    vm.runInNewContext(source, { window, localStorage, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } } });
    return {
        state: window.__engReading, storage, notifications,
        snapshot() { return JSON.parse(JSON.stringify(window.__engReading.snapshot())); },
        storageChanged(value, name = key) {
            if (value === null) storage.delete(name); else storage.set(name, value);
            for (const callback of listeners.get('storage') || []) callback({ key: name });
        },
        queuedStorageEvent(value) {
            for (const callback of listeners.get('storage') || []) callback({ key, newValue: value });
        },
    };
}

test('the latest unfinished article stays selected after refresh, and completion advances one place', () => {
    const h = harness();
    assert.equal(h.state.nextArticle().slug, 'newest');
    assert.equal(h.state.complete('newest'), true);
    assert.equal(h.state.complete('newest'), false);
    assert.equal(h.state.nextArticle().slug, 'second');
    const refreshed = harness({ storage: h.storage });
    assert.equal(refreshed.state.nextArticle().slug, 'second');
    assert.deepEqual(refreshed.snapshot().completed, ['newest']);
    refreshed.state.complete('second'); refreshed.state.complete('oldest');
    assert.equal(refreshed.state.nextArticle(), null);
    assert.equal(refreshed.snapshot().allComplete, true);
});

test('clicked/visited state and private or unknown slugs never count as reading', () => {
    const storage = new Map([['engmanager.visited-articles', '["newest","second","oldest"]']]);
    const h = harness({ storage, roster: { articles: [...manifest.articles, article('big-personality'), article('newest'), { ...article('unsafe'), path: 'https://example.com/unsafe' }] } });
    assert.equal(h.snapshot().total, 3);
    assert.deepEqual(h.snapshot().completed, []);
    assert.equal(h.state.complete('big-personality'), false);
    assert.equal(h.state.complete('unknown'), false);
    assert.equal(h.state.complete('unsafe'), false);
    assert.equal(h.state.nextArticle().slug, 'newest');
});

test('corrupt, unknown-version and oversized progress recover safely', () => {
    for (const raw of ['{', '[]', '{"version":99,"completed":["newest"]}', ' '.repeat(65537)]) {
        const h = harness({ storage: new Map([[key, raw]]) });
        assert.deepEqual(h.snapshot().completed, []);
        assert.equal(h.state.nextArticle().slug, 'newest');
        assert.equal(h.state.complete('newest'), true);
        assert.equal(JSON.parse(h.storage.get(key)).version, 1);
    }
    const mixed = harness({ storage: new Map([[key, JSON.stringify({ version: 1, completed: ['newest', 'newest', 'deleted-article', '/personality/test', null, 42] })]]) });
    assert.deepEqual(mixed.snapshot().completed, ['newest']);
    mixed.state.configure({ articles: [article('brand-new'), article('newest')] });
    assert.equal(mixed.state.nextArticle().slug, 'brand-new');
    assert.equal(mixed.snapshot().allComplete, false);
});

test('progress works in memory when storage is unavailable and reset begins a fresh cycle', () => {
    const h = harness({ disabled: true });
    let updates = 0;
    const unsubscribe = h.state.subscribe(() => updates++);
    h.state.subscribe(() => { throw new Error('another surface failed'); });
    h.state.complete('newest'); h.state.complete('second'); h.state.complete('oldest');
    assert.equal(h.snapshot().allComplete, true);
    assert.equal(updates, 3);
    unsubscribe(); h.state.reset();
    assert.equal(updates, 3);
    assert.equal(h.state.nextArticle().slug, 'newest');
    assert.deepEqual(h.snapshot().completed, []);
    assert.equal(h.notifications.at(-1).type, 'eng:readingprogress');
    assert.equal(h.notifications.at(-1).detail.allComplete, false);
});

test('cross-tab changes and resets update the next article without losing another tab’s completed work', () => {
    const h = harness();
    h.state.complete('newest');
    // A second tab completed another article just before this tab writes.
    h.storage.set(key, JSON.stringify({ version: 1, completed: ['second'] }));
    h.state.complete('oldest');
    assert.deepEqual(h.snapshot().completed, ['newest', 'second', 'oldest']);
    h.storageChanged(JSON.stringify({ version: 1, completed: ['second'] }));
    assert.deepEqual(h.snapshot().completed, ['second']);
    assert.equal(h.state.nextArticle().slug, 'newest');
    h.storageChanged(null);
    assert.deepEqual(h.snapshot().completed, []);
});

test('a stale tab cannot revive a previous lap before the queued reset event arrives', () => {
    const storage = new Map([[key, JSON.stringify({ version: 1, completed: ['newest'] })]]);
    const stale = harness({ storage }), resetter = harness({ storage });
    const oldRecord = storage.get(key);
    assert.deepEqual(stale.snapshot().completed, ['newest']);
    resetter.state.reset();
    const resetRecord = storage.get(key), resetLap = JSON.parse(resetRecord).lap;
    assert.notEqual(resetLap, 'legacy');
    // Its storage event is still queued, so this tab has an old in-memory
    // completion when it finishes a different article in the new lap.
    assert.equal(stale.state.complete('second'), true);
    assert.deepEqual(stale.snapshot().completed, ['second']);
    assert.deepEqual(JSON.parse(storage.get(key)).completed, ['second']);
    assert.equal(JSON.parse(storage.get(key)).lap, resetLap);
    // Old notifications describe their historical write. The live record
    // remains authoritative even if those notifications arrive out of order.
    stale.queuedStorageEvent(resetRecord);
    resetter.queuedStorageEvent(oldRecord);
    assert.deepEqual(stale.snapshot().completed, ['second']);
    assert.deepEqual(resetter.snapshot().completed, ['second']);

    const beforeAnotherReset = harness({ storage });
    resetter.state.reset();
    beforeAnotherReset.state.configure(manifest);
    assert.deepEqual(beforeAnotherReset.snapshot().completed, []);
    assert.equal(beforeAnotherReset.state.nextArticle().slug, 'newest');
});

test('an in-memory reset stays fresh when readable storage rejects writes', () => {
    const storage = new Map([[key, JSON.stringify({ version: 1, completed: ['newest'] })]]);
    const h = harness({ storage, writeDisabled: true });
    h.state.complete('second');
    assert.deepEqual(h.snapshot().completed, ['newest', 'second']);
    h.state.reset();
    h.state.complete('oldest');
    h.state.configure(manifest);
    h.queuedStorageEvent(storage.get(key));
    assert.deepEqual(h.snapshot().completed, ['oldest']);
    assert.equal(h.state.nextArticle().slug, 'newest');
    // A successful reset from another tab still supersedes that memory-only
    // lap; quota failure is not permission to ignore an external reset.
    const other = harness({ storage });
    other.state.reset();
    h.state.complete('second');
    assert.deepEqual(h.snapshot().completed, ['second']);
});

test('storage and roster reads remain bounded and stale published articles are pruned', () => {
    const articles = Array.from({ length: 800 }, (_, index) => article(`article-${index}`));
    const completed = articles.map((entry) => entry.slug);
    const h = harness({ roster: { articles }, storage: new Map([[key, JSON.stringify({ version: 1, completed })]]) });
    assert.equal(h.snapshot().total, 512);
    assert.equal(h.snapshot().completed.length, 512);
    h.state.configure({ articles: [article('replacement')] });
    assert.deepEqual(h.snapshot().completed, []);
    assert.equal(h.state.nextArticle().slug, 'replacement');
});
