import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../website/js/src/reading-completion.js', import.meta.url), 'utf8');
const trashSource = await readFile(new URL('../website/js/src/trash-drag.js', import.meta.url), 'utf8');
const storageKey = 'engmanager.reading-cleanup.v1';

function harness({ complete = false, stored, blockedStorage = false } = {}) {
    const storage = new Map(stored ? [[storageKey, stored]] : []);
    const listeners = new Map();
    let holdNextAnimation = false, releaseAnimation;
    const add = (type, fn) => { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); };
    const emit = (type, detail) => { for (const fn of listeners.get(type) || []) fn(detail || {}); };
    function node(dataset = {}, textContent = '') {
        const element = {
            dataset, textContent, style: {}, attrs: {}, children: [], hidden: false,
            setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; },
            append(child) { child.parent = this; this.children.push(child); },
            remove() {
                if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
                if (document.activeElement === this) document.activeElement = document.body;
            },
            focus(options) { this.focused = options; document.activeElement = this; },
            querySelectorAll() { return [...this.children]; },
            getBoundingClientRect: () => ({ left: 12, top: 15, width: 90, height: 30 }),
            cloneNode() { const clone = node({ ...this.dataset }, this.textContent); clone.className = this.className; return clone; },
            closest(selector) {
                if (this.dataset.slug && selector.includes('article-fluid-link')) return this;
                if (this.dataset.chipId && selector.includes('.chip-tag')) return this;
                return null;
            },
            animate() {
                if (!holdNextAnimation) return { finished: Promise.resolve() };
                holdNextAnimation = false;
                return { finished: new Promise((resolve) => { releaseAnimation = resolve; }) };
            },
        };
        element.classList = { values: new Set(), add(value) { this.values.add(value); },
            contains(value) { return this.values.has(value) || element.className?.split(' ').includes(value); },
        };
        return element;
    }
    function page(slugs = ['first', 'second', 'assessment']) {
        const articles = slugs.map((slug) => node({ slug }));
        const tags = ['tag-Rust', 'tag-AI', 'tag-Rust', 'tag-AI'].map((chipId) => node({ chipId }, chipId.slice(4)));
        const island = node({}, JSON.stringify(Object.fromEntries(articles.map((article) => [article.dataset.slug, {}]))));
        const tray = node();
        const fields = Object.fromEntries(['title', 'copy', 'count', 'reset'].map((name) => [`[data-reading-completion-${name}]`, node()]));
        fields['[data-reading-completion-tags]'] = tray;
        const panel = node();
        panel.querySelector = (selector) => fields[selector];
        const count = node();
        const heading = node();
        const root = {
            articles, tags, tray, panel, fields, count, heading,
            querySelector(selector) {
                return selector === '#articles-data' ? island : selector === '[data-reading-completion]' ? panel
                    : selector === '[data-trash-count]' ? count : selector === 'h1' ? heading : null;
            },
            querySelectorForKeyboard(selector) {
                return selector === '.article-fluid-link:not([data-trashed])' ? articles.find((article) => !article.dataset.trashed)
                    : selector === '[data-reading-completion-tags] .chip-tag' ? tray.children[0]
                    : selector === '[data-reading-completion-reset]' ? fields[selector] : this.querySelector(selector);
            },
            querySelectorAll(selector) {
                if (selector === '.marquee .chip-tag[data-chip-id]') return tags;
                if (selector === '.article-fluid-link[data-slug]') return articles;
                if (selector === '[data-cleanup-keyboard]') return articles.filter((article) => article.dataset.cleanupKeyboard);
                if (selector === '[data-cleanup-discarded]') return [...articles, ...tags].filter((item) => item.dataset.cleanupDiscarded);
                throw new Error(`Unexpected selector: ${selector}`);
            },
        };
        const query = root.querySelector;
        root.querySelector = (selector) => ['.article-fluid-link:not([data-trashed])', '[data-reading-completion-tags] .chip-tag', '[data-reading-completion-reset]'].includes(selector)
            ? root.querySelectorForKeyboard(selector) : query(selector);
        return root;
    }
    let current = page(), retained = [];
    let snapshot = { completed: complete ? ['first', 'second'] : [], total: 2, allComplete: complete };
    const hooks = {};
    const window = {
        addEventListener: add,
        __engNav: {
            onSwap(fn) { const previous = hooks.mount; hooks.mount = () => { previous?.(); fn(); }; },
            onBeforeSwap(fn) { hooks.dispose = fn; },
        },
        __engReading: { snapshot: () => snapshot, reset() { snapshot = { ...snapshot, completed: [], allComplete: false }; emit('eng:readingprogress'); } },
        scrollTo(options) { this.scrolled = options; },
        matchMedia: () => ({ matches: false }),
    };
    const trash = node();
    const document = {
        prerendering: false, addEventListener: add, dispatchEvent(event) { emit(event.type, event); },
        body: node(), activeElement: null,
        querySelector: (selector) => selector === '[data-dvd-bouncer]' ? null : selector === '.trash-can' ? trash
            : selector === '[data-trash-count]' ? current.count : current,
        createElement: () => node(),
        querySelectorAll: (selector) => selector.startsWith('[data-chip-id="')
            ? [...current.tags, ...current.tray.children].filter((chip) => chip.dataset.chipId === selector.match(/"(.*)"/)[1])
            : [...retained, current].flatMap((root) => root.querySelectorAll(selector)),
    };
    const context = vm.createContext({ window, document,
        localStorage: {
            getItem(key) { if (blockedStorage) throw new Error('blocked'); return storage.get(key) || null; },
            setItem(key, value) { if (blockedStorage) throw new Error('blocked'); storage.set(key, value); },
        },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
        CSS: { escape: (value) => value },
    });
    vm.runInContext(source, context);
    return { window, document, storage, hooks, emit,
        api: window.__engReadingCompletion,
        get page() { return current; },
        leaveFeedRetained() {
            const feed = current;
            retained = [feed];
            current = { querySelector: () => null, querySelectorAll: () => [] };
            hooks.mount();
            return feed;
        },
        loadTrash() { vm.runInContext(trashSource, context); },
        holdNextDrop() { holdNextAnimation = true; },
        releaseDrop() { releaseAnimation(); },
        async key(target, key) {
            const event = { target, key, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
            await Promise.all((listeners.get('keydown') || []).map((fn) => fn(event)));
            return event;
        },
        finishReading() { snapshot = { ...snapshot, completed: ['first', 'second'], allComplete: true }; emit('eng:readingprogress'); },
        remount() { current = page(); hooks.mount(); return current; },
        publishAnotherEssay() {
            current = page(['first', 'second', 'assessment', 'new-essay']);
            snapshot = { completed: ['first', 'second'], total: 3, allComplete: false };
            hooks.mount();
            emit('eng:readingprogress');
            return current;
        },
    };
}

test('clicked visit history cannot unlock cleanup; all completed journeys unlock every public feed row', () => {
    const h = harness();
    assert.equal(h.page.panel.hidden, true);
    h.api.recordTrash('article', 'first');
    assert.equal(h.api.snapshot().articles.length, 0);
    h.finishReading();
    assert.equal(h.page.panel.hidden, false);
    assert.equal(h.api.snapshot().stage, 'articles');
    assert.equal(h.page.fields['[data-reading-completion-count]'].textContent, '3 articles left');
    assert(h.page.articles.every((article) => article.classList.values.has('is-visited')));
    assert.equal(h.api.canTrash('tag', 'tag-AI'), false);
});

test('cleanup advances only after every unique article, then every unique tag, and persists across remounts', () => {
    const h = harness({ complete: true });
    h.api.recordTrash('tag', 'tag-AI');
    h.api.recordTrash('article', 'unknown');
    assert.equal(h.api.snapshot().tags.length, 0);
    for (const slug of ['first', 'second']) h.api.recordTrash('article', slug);
    assert.equal(h.api.snapshot().stage, 'articles', 'public assessment introduction must also be discarded');
    h.api.recordTrash('article', 'assessment');
    assert.equal(h.api.snapshot().stage, 'tags');
    assert.equal(h.page.tray.children.length, 2, 'marquee clones do not count as distinct tags');
    assert(h.page.tray.children.every((tag) => tag.attrs.role === 'button' && tag.tabIndex === 0));
    h.api.recordTrash('tag', 'tag-Rust');
    h.api.recordTrash('tag', 'tag-Rust');
    const page = h.remount();
    assert.equal(page.fields['[data-reading-completion-count]'].textContent, '1 tag left');
    assert.equal(page.tray.children[0].dataset.chipId, 'tag-AI');
    assert(page.articles.every((article) => article.style.visibility === 'hidden'));
    assert(page.tags.filter((tag) => tag.dataset.chipId === 'tag-Rust').every((tag) => tag.style.visibility === 'hidden'));
    h.api.recordTrash('tag', 'tag-AI');
    assert.equal(h.api.snapshot().stage, 'finished');
    assert.equal(page.fields['[data-reading-completion-reset]'].hidden, false);
    const refreshed = harness({ complete: true, stored: h.storage.get(storageKey) });
    assert.equal(refreshed.api.snapshot().stage, 'finished');
    assert.equal(refreshed.page.count.textContent, '5');
});

test('restart restores link visibility and accessibility, clears both saved stages, and restarts reading', () => {
    const h = harness({ complete: true });
    for (const slug of ['first', 'second', 'assessment']) h.api.recordTrash('article', slug);
    for (const tag of ['tag-Rust', 'tag-AI']) h.api.recordTrash('tag', tag);
    h.api.reset();
    assert.equal(h.api.snapshot().active, false);
    assert.equal(h.api.snapshot().articles.length, 0);
    assert.equal(h.api.snapshot().tags.length, 0);
    assert.equal(h.page.panel.hidden, true);
    assert(h.page.articles.every((article) => !article.dataset.trashed && !article.attrs['aria-hidden'] && article.style.visibility === ''));
    assert(h.page.articles.every((article) => !article.attrs['aria-keyshortcuts'] && !article.attrs['aria-description']));
    assert.equal(h.window.scrolled.top, 0);
    assert.equal(h.page.count.textContent, '0');
    assert.equal(h.page.heading.tabIndex, -1);
});

test('stale, invalid, or disabled storage stays bounded and never blocks the last act', () => {
    const stale = harness({ complete: true, stored: JSON.stringify({ version: 1,
        articles: ['first', 'removed', {}, 'x'.repeat(161)], tags: ['tag-Rust', 'tag-removed'] }) });
    assert.equal(stale.api.snapshot().articles.join(','), 'first');
    assert.equal(stale.api.snapshot().tags.join(','), 'tag-Rust');
    const corrupt = harness({ complete: true, stored: '{bad json' });
    assert.equal(corrupt.api.snapshot().stage, 'articles');
    const oversized = harness({ complete: true, stored: JSON.stringify({ version: 1,
        articles: ['first'], tags: [], padding: 'x'.repeat(65_536) }) });
    assert.equal(oversized.api.snapshot().articles.length, 0);
    const blocked = harness({ complete: true, blockedStorage: true });
    for (const slug of ['first', 'second', 'assessment']) blocked.api.recordTrash('article', slug);
    assert.equal(blocked.api.snapshot().stage, 'tags');
});

test('another tab restarting reading restores cleanup DOM without reviving ordinary playful trash', () => {
    const h = harness({ complete: true });
    for (const slug of ['first', 'second', 'assessment']) h.api.recordTrash('article', slug);
    h.api.recordTrash('tag', 'tag-Rust');
    h.window.__engReading.reset();
    assert.equal(h.page.panel.hidden, true);
    assert(h.page.articles.every((article) => article.style.visibility === '' && !article.attrs['aria-hidden']));
    assert(h.page.articles.every((article) => !article.dataset.trashed && !article.dataset.cleanupDiscarded));
    assert(h.page.tags.every((tag) => tag.style.visibility === '' && !tag.dataset.trashed));
    const playful = h.page.articles[0];
    playful.dataset.trashed = 'true';
    playful.style.visibility = 'hidden';
    playful.setAttribute('aria-hidden', 'true');
    playful.tabIndex = -1;
    h.api.refresh();
    h.api.refresh();
    assert.equal(playful.style.visibility, 'hidden', 'incomplete-feed refresh preserves unrelated trash gestures');
    assert.equal(playful.attrs['aria-hidden'], 'true');
});

test('a newly published essay resumes reading before cleanup and preserves prior cleanup progress', () => {
    const h = harness({ complete: true });
    for (const slug of ['first', 'second', 'assessment']) h.api.recordTrash('article', slug);
    for (const tag of ['tag-Rust', 'tag-AI']) h.api.recordTrash('tag', tag);
    const page = h.publishAnotherEssay();
    assert.equal(page.panel.hidden, true);
    assert(page.articles.every((article) => !article.dataset.trashed && !article.attrs['aria-hidden']));
    assert.equal(h.api.snapshot().active, false);
    assert.equal(h.api.snapshot().articles.length, 3, 'progress remains saved while the new essay is being read');
    h.finishReading();
    assert.equal(h.api.snapshot().stage, 'articles');
    assert.equal(page.fields['[data-reading-completion-count]'].textContent, '1 article left');
    h.api.recordTrash('article', 'new-essay');
    assert.equal(h.api.snapshot().stage, 'finished');
});

test('external reading reset restores a retained feed even while another journey surface is active', () => {
    const h = harness({ complete: true });
    for (const slug of ['first', 'second', 'assessment']) h.api.recordTrash('article', slug);
    h.api.recordTrash('tag', 'tag-Rust');
    const feed = h.leaveFeedRetained();
    h.window.__engReading.reset();
    assert(feed.articles.every((article) => !article.dataset.trashed && !article.attrs['aria-hidden']));
    assert(feed.tags.every((tag) => !tag.dataset.trashed && tag.style.visibility === ''));
    assert(feed.articles.every((article) => !article.attrs['aria-keyshortcuts']));
});

test('clearing local storage in another tab discards cleanup memory and later mounts cannot resurrect it', () => {
    const h = harness({ complete: true });
    for (const slug of ['first', 'second', 'assessment']) h.api.recordTrash('article', slug);
    for (const tag of ['tag-Rust', 'tag-AI']) h.api.recordTrash('tag', tag);
    h.storage.clear();
    h.window.__engReading.reset();
    h.emit('storage', { key: null });
    assert.equal(h.api.snapshot().active, false);
    assert.equal(h.api.snapshot().articles.length, 0);
    assert.equal(h.api.snapshot().tags.length, 0);
    assert(h.page.articles.every((article) => !article.dataset.trashed && !article.attrs['aria-hidden']));
    assert(h.page.tags.every((tag) => tag.style.visibility === ''));
    h.hooks.mount();
    const saved = JSON.parse(h.storage.get(storageKey));
    assert.deepEqual(saved.articles, []);
    assert.deepEqual(saved.tags, []);
    h.finishReading();
    assert.equal(h.page.fields['[data-reading-completion-count]'].textContent, '3 articles left');
});

test('keyboard cleanup preserves focus on remaining controls and reaches the restart button without panning', async () => {
    const h = harness({ complete: true });
    h.loadTrash();
    h.page.articles[1].focus({ preventScroll: true });
    const deleted = await h.key(h.page.articles[1], 'Delete');
    assert.equal(deleted.prevented, true);
    assert.equal(h.api.snapshot().articles.join(','), 'second');
    assert.equal(h.document.activeElement, h.page.articles[0]);
    for (const index of [0, 2]) await h.key(h.page.articles[index], 'Backspace');
    assert.equal(h.api.snapshot().stage, 'tags');
    assert.equal(h.document.activeElement, h.page.tray.children[0]);
    const firstTag = h.page.tray.children[0];
    await h.key(firstTag, 'Enter');
    assert.equal(h.document.activeElement, h.page.tray.children[0]);
    assert.notEqual(h.document.activeElement, firstTag);
    await h.key(h.page.tray.children[0], ' ');
    assert.equal(h.api.snapshot().stage, 'finished');
    assert.equal(h.document.activeElement, h.page.fields['[data-reading-completion-reset]']);
    assert.equal(h.document.activeElement.focused.preventScroll, true);
});

test('an external reset during a keyboard drop cannot hide the restored article when animation finishes', async () => {
    const h = harness({ complete: true });
    h.loadTrash();
    h.holdNextDrop();
    const article = h.page.articles[0];
    const pending = h.key(article, 'Delete');
    h.window.__engReading.reset();
    h.releaseDrop();
    await pending;
    assert.equal(h.api.snapshot().active, false);
    assert.equal(h.api.snapshot().articles.length, 0);
    assert.equal(article.dataset.trashed, undefined);
    assert.equal(article.style.opacity, '');
    assert.equal(article.style.visibility, '');
});
