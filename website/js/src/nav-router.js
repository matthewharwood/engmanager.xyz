// Continuous, same-origin navigation. The only retained page documents are the
// current surface, its staged next surface, and one ephemeral previous surface.
// Published personality/checkout documents remain hard navigation boundaries.
(() => {
    const nav = window.__engNav;
    const initialPage = document.querySelector('[data-eng-page]');
    if (!nav || nav.ready || !initialPage) return;

    const CONFIGS = ['__shopProducts', '__checkout', '__coach', '__engUrls', '__engSfxUrls'];
    const META = 'meta[name="description"],meta[name="robots"],meta[property^="og:"],meta[property^="article:"],meta[name^="twitter:"],link[rel="canonical"],link[rel="alternate"],script[type="application/ld+json"]';
    const privatePath = (p) => p === '/articles/big-personality' || /^\/personality(?:\/|$)/.test(p);
    const eligible = (url) => url.origin === location.origin && !privatePath(url.pathname)
        && /^(?:\/|\/feed|\/shop|\/coach|\/search|\/articles\/|\/articles\/[a-z0-9-]+|\/products\/[a-z0-9-]+)$/.test(url.pathname);
    const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = () => navigator.connection?.saveData === true;
    const logicalName = (url) => url.origin === location.origin && url.pathname.startsWith('/assets/')
        ? url.pathname.replace(/\.[0-9a-f]{8}(\.[a-z0-9]+)$/i, '$1') : url.href;
    const assetTags = (root) => [...root.querySelectorAll('link[rel="stylesheet"][href],script[src]')].filter((el) => !el.closest('noscript'));
    const assetUrl = (el) => new URL(el.getAttribute('src') || el.getAttribute('href'), location.href);
    const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    let current, previous = null, next = null, stagedPromise = null;
    let request = null, preload = null, observer = null, runway = null, stage = null, previousCard = null;
    let generation = 0, committing = false, queuedNavigation = null, scrollFrame = 0, scrollTimer = 0;
    let lastScroll = scrollY, inputAt = -Infinity, allowPromotionAt = Infinity;
    const pendingStyles = new Map();
    const pendingScripts = new Map();

    const runtime = document.createElement('div');
    runtime.className = 'journey-runtime';
    runtime.dataset.journeyRuntime = '';
    const status = document.createElement('p');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    runtime.append(status);
    document.body.append(runtime);

    function record(doc, url) {
        const page = doc.querySelector('[data-eng-page]');
        if (!page || privatePath(new URL(url).pathname)) throw new Error('document boundary');
        const configs = new Map();
        for (const name of CONFIGS) {
            const node = doc.querySelector(`script[type="application/json"][data-eng-config="${name}"]`);
            if (node) configs.set(name, { node: node.cloneNode(true), value: JSON.parse(node.textContent) });
        }
        return {
            id: uid(), url, page, kind: page.dataset.engPage, title: doc.title,
            bodyClass: doc.body.className, nextUrl: page.dataset.engNext,
            assets: assetTags(doc).map((tag) => tag.cloneNode(true)),
            inlineStyles: [...doc.head.querySelectorAll('style')].map((tag) => tag.cloneNode(true)),
            metadata: [...doc.head.querySelectorAll(META)].map((tag) => tag.cloneNode(true)),
            configs, scroll: 0, width: innerWidth, height: innerHeight, focus: null,
        };
    }

    current = record(document, location.href);
    current.page.dataset.journeyCurrent = current.kind;
    const originalState = history.state?.__engJourney;
    if (originalState?.id) current.id = originalState.id;
    history.scrollRestoration = 'manual';

    function writeState(replace, rec) {
        const state = { ...(replace ? history.state : {}), __engJourney: { id: rec.id, url: rec.url, scroll: rec.scroll } };
        history[replace ? 'replaceState' : 'pushState'](state, '', rec.url);
    }

    function remember() {
        current.scroll = scrollY;
        current.url = location.href;
        current.width = innerWidth;
        current.height = innerHeight;
        current.focus = current.page.contains(document.activeElement) ? document.activeElement : null;
        writeState(true, current);
    }
    remember();

    function overlayOpen() {
        return document.body.matches('.shop-panel-open,.shop-cart-open')
            || !!document.querySelector('dialog[open],[popover]:popover-open:not([data-cursor-overlay])');
    }

    function syncOverlay() {
        const open = overlayOpen();
        if (previousCard) previousCard.hidden = open || committing;
        if (stage) stage.hidden = open;
        if (open) inputAt = -Infinity;
    }
    new MutationObserver(syncOverlay).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('eng:overlaychange', syncOverlay);
    document.addEventListener('toggle', syncOverlay, true);

    function assertAssets(rec) {
        const live = new Map(assetTags(document).map((el) => { const u = assetUrl(el); return [logicalName(u), u.href]; }));
        for (const tag of rec.assets) {
            const url = assetUrl(tag), old = live.get(logicalName(url));
            if (old && old !== url.href) throw new Error(`asset version changed: ${url.pathname}`);
        }
    }

    function loadTag(tag, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => finish(new Error('asset timeout')), timeout);
            function finish(error) {
                clearTimeout(timer);
                tag.onload = tag.onerror = null;
                if (error) { tag.remove(); reject(error); } else resolve();
            }
            tag.onload = () => finish();
            tag.onerror = () => finish(new Error('asset failed'));
            document.head.append(tag);
        });
    }

    async function styles(rec) {
        assertAssets(rec);
        const loaded = new Set(assetTags(document).map((tag) => assetUrl(tag).href));
        await Promise.all(rec.assets.filter((tag) => tag.tagName === 'LINK').map((tag) => {
            const href = assetUrl(tag).href;
            if (pendingStyles.has(href)) return pendingStyles.get(href);
            if (loaded.has(href)) return Promise.resolve();
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            const promise = loadTag(link).finally(() => pendingStyles.delete(href));
            pendingStyles.set(href, promise);
            return promise;
        }));
    }

    async function scripts(rec) {
        const loaded = new Set(assetTags(document).filter((tag) => tag.tagName === 'SCRIPT').map((tag) => assetUrl(tag).href));
        let optional = Promise.resolve();
        for (const tag of rec.assets) {
            if (tag.tagName !== 'SCRIPT') continue;
            const pending = pendingScripts.get(assetUrl(tag).href);
            if (pending) {
                optional = optional.then(() => pending);
                continue;
            }
            if (loaded.has(assetUrl(tag).href)) continue;
            const script = document.createElement('script');
            script.src = assetUrl(tag).href;
            // Local bundles are awaited in order. Optional third-party tools
            // load in their own ordered lane so an unavailable payment/CDN
            // provider cannot freeze navigation or the working product grid.
            script.async = true;
            if (tag.type) script.type = tag.type;
            loaded.add(script.src);
            if (assetUrl(tag).origin !== location.origin) {
                optional = optional.then(() => loadTag(script)).then(() => {
                    window.dispatchEvent(new CustomEvent('eng:optionalasset', { detail: { url: script.src } }));
                }).catch(() => {}).finally(() => pendingScripts.delete(script.src));
                pendingScripts.set(script.src, optional);
            } else {
                await loadTag(script);
            }
        }
    }

    function syncHead(rec) {
        document.title = rec.title;
        document.head.querySelectorAll(META).forEach((node) => node.remove());
        document.head.append(...rec.metadata.map((node) => node.cloneNode(true)));
        for (const name of CONFIGS) {
            document.querySelectorAll(`script[data-eng-config="${name}"]`).forEach((node) => node.remove());
            const config = rec.configs.get(name);
            if (config) {
                document.head.append(config.node.cloneNode(true));
                window[name] = config.value;
            } else if (['__coach', '__shopProducts', '__checkout'].includes(name)) delete window[name];
        }
    }

    async function fetchPage(url, signal) {
        const response = await fetch(url, { signal });
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error(`HTTP ${response.status}`);
        const finalUrl = new URL(response.url);
        if (!eligible(finalUrl)) throw new Error('redirect outside journey');
        finalUrl.hash = new URL(url).hash;
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const rec = record(doc, finalUrl.href);
        assertAssets(rec);
        return rec;
    }

    // Sandboxed, script-free documents keep preview IDs, page styles and form
    // controls completely outside the active document. They cannot hydrate or pay.
    function preview(rec, scroll = 0) {
        const doc = document.implementation.createHTMLDocument(rec.title);
        const base = doc.createElement('base');
        base.href = rec.url;
        doc.head.append(base);
        doc.head.append(...rec.inlineStyles.map((tag) => tag.cloneNode(true)));
        for (const tag of rec.assets) if (tag.tagName === 'LINK') {
            const link = tag.cloneNode(true);
            link.media = 'all'; link.removeAttribute('onload');
            doc.head.append(link);
        }
        doc.body.className = rec.bodyClass;
        doc.body.append(rec.page.cloneNode(true));
        doc.querySelectorAll('script,iframe,object,embed,audio,video,[data-journey-fallback]').forEach((node) => node.remove());
        for (const node of doc.querySelectorAll('*')) {
            for (const attr of [...node.attributes]) if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
            node.removeAttribute('autofocus');
        }
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme) doc.documentElement.setAttribute('data-theme', theme);
        const css = doc.createElement('style');
        css.textContent = 'html{scroll-behavior:auto!important}body{pointer-events:none!important}*{animation:none!important;transition:none!important;caret-color:transparent!important}::-webkit-scrollbar{display:none}.shop-card-meta{opacity:1!important;transform:none!important}[data-journey-current]{box-shadow:none!important}';
        doc.head.append(css);
        const iframe = document.createElement('iframe');
        iframe.className = 'journey-preview';
        iframe.setAttribute('sandbox', 'allow-same-origin');
        iframe.setAttribute('tabindex', '-1');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.title = `Preview of ${rec.title}`;
        iframe.addEventListener('load', () => {
            try {
                iframe.contentWindow.scrollTo(0, scroll);
                iframe.contentDocument.fonts?.ready.then(() => {
                    if (iframe.isConnected) iframe.contentWindow.scrollTo(0, scroll);
                });
            } catch {}
        }, { once: true });
        iframe.srcdoc = `<!doctype html>${doc.documentElement.outerHTML}`;
        return iframe;
    }

    // Decode only images occupying the destination's first viewport. The
    // preview stays covered until they are ready, then covers the real page
    // while its own images hydrate. A timeout keeps a broken image from
    // blocking navigation indefinitely.
    async function visibleImagesReady(doc, timeout = 2000) {
        const viewport = doc.defaultView;
        const images = [...doc.querySelectorAll('img')].filter((img) => {
            const rect = img.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.bottom > 0
                && rect.top < viewport.innerHeight && rect.right > 0 && rect.left < viewport.innerWidth;
        });
        if (!images.length) return;
        let timer;
        try {
            await Promise.race([
                Promise.all(images.map((img) => {
                    img.loading = 'eager';
                    return img.decode?.().catch(() => {}) || Promise.resolve();
                })),
                new Promise((resolve) => { timer = setTimeout(resolve, timeout); }),
            ]);
        } finally { clearTimeout(timer); }
    }

    function clearNext() {
        observer?.disconnect(); observer = null;
        preload?.abort(); preload = null;
        next = null; stagedPromise = null;
        runway?.remove(); runway = null;
        stage?.remove(); stage = null;
        document.body.classList.remove('journey-revealing');
    }

    function label(kind) {
        return ({ shop: 'the store', coach: 'coaching', feed: 'the feed', article: 'your article', articles: 'articles' })[kind] || 'the next page';
    }

    async function prepareNext() {
        if (!current.nextUrl) return null;
        if (next) return next;
        if (stagedPromise) return stagedPromise;
        const owner = current, controller = new AbortController();
        preload = controller;
        stagedPromise = (async () => {
            try {
                const rec = await fetchPage(new URL(owner.nextUrl, owner.url).href, controller.signal);
                if (controller.signal.aborted || current !== owner) return null;
                next = rec;
                stage = document.createElement('section');
                stage.className = 'journey-stage';
                stage.dataset.journeyNext = rec.kind;
                stage.setAttribute('aria-label', `Continue to ${label(rec.kind)}`);
                const viewport = document.createElement('div');
                viewport.className = 'journey-stage-viewport';
                viewport.inert = true;
                const thumbnail = preview(rec);
                viewport.append(thumbnail);
                const promote = document.createElement('a');
                promote.className = 'journey-promote';
                promote.href = rec.url;
                promote.dataset.journeyPromote = '';
                promote.textContent = `Continue to ${label(rec.kind)} ↗`;
                promote.addEventListener('click', (event) => {
                    if (modified(event)) return;
                    event.preventDefault();
                    navigate(rec.url, { source: 'reveal' });
                });
                stage.append(viewport, promote);
                runtime.append(stage);
                thumbnail.addEventListener('load', async () => {
                    try {
                        const doc = thumbnail.contentDocument;
                        await Promise.all([doc.fonts?.ready, visibleImagesReady(doc)]);
                    } catch {}
                    if (current !== owner || !stage?.contains(thumbnail)) return;
                    stage.dataset.previewReady = 'true';
                    runway.dataset.ready = 'true';
                    runway.querySelector('a').textContent = `Continue to ${label(rec.kind)} ↗`;
                    syncOverlay(); updateScroll(true);
                }, { once: true });
                syncOverlay(); updateScroll(false);
                return rec;
            } catch (error) {
                if (!controller.signal.aborted && current === owner) {
                    runway?.setAttribute('data-failed', 'true');
                    status.textContent = 'The next page is not ready. Use the link to continue.';
                }
                return null;
            } finally {
                if (preload === controller) { preload = null; stagedPromise = null; }
            }
        })();
        return stagedPromise;
    }

    function setupNext() {
        clearNext();
        if (!current.nextUrl) return;
        runway = document.createElement('section');
        runway.className = 'journey-runway';
        runway.dataset.journeyRunway = '';
        runway.setAttribute('aria-label', 'Continue exploring');
        const link = document.createElement('a');
        link.href = current.nextUrl;
        link.className = 'journey-runway-link';
        link.textContent = current.page.querySelector('[data-journey-fallback] a')?.textContent || 'Continue exploring ↗';
        link.addEventListener('click', (event) => {
            if (modified(event)) return;
            event.preventDefault();
            navigate(link.href, { source: 'reveal' });
        });
        runway.append(link);
        runtime.append(runway);
        if ('IntersectionObserver' in window && !saveData()) {
            observer = new IntersectionObserver((entries) => {
                if (entries.some((entry) => entry.isIntersecting)) prepareNext();
            }, { rootMargin: '1200px 0px' });
            observer.observe(runway);
        }
        allowPromotionAt = performance.now() + 800;
        inputAt = -Infinity;
        lastScroll = scrollY;
    }

    function dismissPrevious() {
        previousCard?._resize?.disconnect();
        previous = null;
        previousCard?.remove(); previousCard = null;
        status.textContent = 'Previous page dismissed.';
    }

    function showPrevious() {
        previousCard?._resize?.disconnect();
        previousCard?.remove(); previousCard = null;
        if (!previous) return;
        const rec = previous;
        const card = document.createElement('aside');
        card.className = 'journey-previous';
        card.dataset.journeyPrevious = rec.kind;
        card.setAttribute('aria-label', `Previous page: ${rec.title}`);
        const resume = document.createElement('button');
        resume.type = 'button'; resume.className = 'journey-resume'; resume.dataset.journeyResume = '';
        resume.setAttribute('aria-label', `Resume ${rec.title} where you left off`);
        const viewport = document.createElement('span'); viewport.className = 'journey-previous-viewport'; viewport.inert = true;
        const thumbnail = preview(rec, rec.scroll);
        thumbnail.style.width = `${rec.width}px`; thumbnail.style.height = `${rec.height}px`;
        viewport.append(thumbnail);
        const caption = document.createElement('span'); caption.className = 'journey-previous-caption';
        const name = document.createElement('strong'); name.textContent = rec.title.replace(/\s*[·|]\s*ENGMANAGER\.XYZ.*$/i, '');
        const hint = document.createElement('span'); hint.textContent = '↖ Resume where you left off';
        caption.append(name, hint); resume.append(viewport, caption);
        resume.addEventListener('click', () => { if (!card.dataset.swiped) navigate(rec.url, { source: 'resume', record: rec }); });
        const close = document.createElement('button'); close.type = 'button'; close.className = 'journey-dismiss'; close.dataset.journeyDismiss = '';
        close.setAttribute('aria-label', 'Dismiss previous page'); close.textContent = '×';
        close.addEventListener('click', dismissPrevious);
        card.append(resume, close);
        let drag = null;
        card.addEventListener('pointerdown', (event) => {
            if (event.target.closest('[data-journey-dismiss]') || event.button !== 0) return;
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
            delete card.dataset.swiped;
        });
        card.addEventListener('pointermove', (event) => {
            if (!drag || event.pointerId !== drag.id) return;
            const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
            if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
                card.setPointerCapture(event.pointerId);
                card.style.transform = `translateX(${dx}px)`;
                card.style.opacity = String(Math.max(.2, 1 - Math.abs(dx) / 240));
                card.dataset.swiped = 'true';
            }
        });
        function end(event) {
            if (!drag || event.pointerId !== drag.id) return;
            const dismissed = Math.abs(event.clientX - drag.x) > 70 && card.dataset.swiped;
            drag = null;
            if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
            if (dismissed && event.type !== 'pointercancel') dismissPrevious();
            else { card.style.transform = ''; card.style.opacity = ''; }
        }
        card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
        previousCard = card; runtime.append(card);
        const resize = new ResizeObserver(() => thumbnail.style.transform = `scale(${viewport.clientWidth / rec.width})`);
        resize.observe(viewport);
        card._resize = resize;
        syncOverlay();
    }

    function updateScroll(userScrolled) {
        if (!runway || committing) return;
        const top = runway.getBoundingClientRect().top;
        const progress = Math.max(0, Math.min(1, (innerHeight - top) / innerHeight));
        document.body.classList.toggle('journey-revealing', progress > 0 && !!next && !overlayOpen());
        if (stage) {
            stage.style.setProperty('--journey-progress', reducedMotion() ? '1' : String(progress));
            stage.style.setProperty('--journey-scale', reducedMotion() ? '1' : String(.82 + .18 * progress));
            stage.style.setProperty('--journey-corner', `${1 - progress}rem`);
            stage.inert = progress < .08 || overlayOpen();
        }
        if (userScrolled && top <= 2 && next && stage?.dataset.previewReady && !saveData() && !nav.busy && !overlayOpen()
            && performance.now() > allowPromotionAt && performance.now() - inputAt < 1800) {
            inputAt = -Infinity;
            navigate(next.url, { source: 'reveal' });
        }
    }

    function focusPage(rec, resume) {
        const modal = [...rec.page.querySelectorAll('[role="dialog"][aria-modal="true"]')].find((node) => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
        const target = modal?.querySelector('button,a[href],input:not([disabled]),[tabindex]') || modal
            || ((resume || new URL(rec.url).hash) && rec.focus?.isConnected && rec.focus) || rec.page.querySelector('h1') || rec.page.querySelector('main') || rec.page;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
    }

    async function animatePage(rec, source) {
        if (reducedMotion() || !rec.page.animate) return;
        const keyframes = source === 'reveal'
            ? [{ transform: 'scale(.82)', opacity: .6 }, { transform: 'scale(1.012)', opacity: 1, offset: .78 }, { transform: 'scale(1)', opacity: 1 }]
            : [{ transform: source === 'resume' ? 'scale(1.025)' : 'translateY(8px)', opacity: .6 }, { transform: 'none', opacity: 1 }];
        const animation = rec.page.animate(keyframes, { duration: source === 'reveal' ? 520 : 240, easing: 'cubic-bezier(.2,.75,.3,1)' });
        await animation.finished.catch(() => {});
    }

    async function navigate(value, options = {}) {
        const dest = new URL(value, location.href);
        if (!eligible(dest)) { location.assign(dest.href); return false; }
        if (committing) {
            return new Promise((resolve) => {
                queuedNavigation?.resolve(false);
                queuedNavigation = { value: dest.href, options, resolve };
            });
        }
        const source = options.source || 'link';
        request?.abort();
        const controller = new AbortController(), version = ++generation;
        request = controller; nav.busy = true;
        document.documentElement.dataset.journeyLoading = 'true';
        try {
            let rec = options.record;
            if (!rec && source === 'reveal') {
                if (!next && stagedPromise) await stagedPromise;
                if (next?.url === dest.href) rec = next;
            }
            rec ||= await fetchPage(dest.href, controller.signal);
            if (controller.signal.aborted || version !== generation) return false;
            await styles(rec);
            if (controller.signal.aborted || version !== generation) return false;
            committing = true;
            if (!options.history) remember();
            const outgoing = current;
            if (source === 'reveal') {
                // The viewport immediately before the foreground disappears is
                // useful to resume; the empty reveal runway is not article text.
                outgoing.scroll = Math.min(outgoing.scroll, Math.max(0, outgoing.page.offsetTop + outgoing.page.offsetHeight - innerHeight));
                writeState(true, outgoing);
            }
            // Keep the fully revealed preview above the live swap until the
            // destination's visible images have decoded. The scroll already
            // supplied the entrance motion, so no second scale-in is needed.
            const handoff = source === 'reveal' && stage?.dataset.previewReady ? stage : null;
            if (handoff) {
                handoff.dataset.committing = '';
                handoff.inert = true;
                handoff.style.setProperty('--journey-progress', '1');
                handoff.style.setProperty('--journey-scale', '1');
                handoff.style.setProperty('--journey-corner', '0rem');
                stage = null;
            }
            nav._before?.(document.body);
            document.querySelectorAll('[popover]:popover-open:not([data-cursor-overlay])').forEach((node) => node.hidePopover());
            clearNext();
            previousCard?._resize?.disconnect();
            previousCard?.remove(); previousCard = null;
            outgoing.page.inert = true;
            outgoing.page.removeAttribute('data-journey-current');
            outgoing.page.replaceWith(rec.page);
            // Runtime nodes belong to the outgoing page. The shared runtime and
            // skip link are the only body siblings carried between surfaces.
            [...document.body.children].forEach((el) => {
                if (el !== rec.page && el !== runtime && !el.matches('.skip-link')) el.remove();
            });
            current = rec;
            previous = source === 'reveal' ? outgoing : null;
            current.page.dataset.journeyCurrent = current.kind;
            current.page.inert = true;
            document.body.className = rec.bodyClass;
            document.body.style.cssText = '';
            delete document.documentElement.dataset.articleReveal;
            syncHead(rec);
            if (options.history) {
                current.url = dest.href;
                current.id = options.state?.id || current.id;
                current.scroll = options.state?.scroll || 0;
            } else if (source !== 'resume') current.scroll = 0;
            if (!options.history) writeState(false, current);
            scrollTo({ top: current.scroll, left: 0, behavior: 'instant' });
            await scripts(rec);
            nav._fire?.(document.body);
            await frame();
            if (!options.history && source !== 'resume' && new URL(rec.url).hash) {
                let id;
                try { id = decodeURIComponent(new URL(rec.url).hash.slice(1)); } catch {}
                const target = id && document.getElementById(id);
                if (target && rec.page.contains(target)) {
                    target.scrollIntoView({ behavior: 'instant' });
                    current.scroll = scrollY;
                    current.focus = target;
                }
            }
            scrollTo({ top: current.scroll, left: 0, behavior: 'instant' });
            if (handoff) {
                await visibleImagesReady(document);
                await frame();
                if (!reducedMotion()) {
                    const fade = handoff.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' });
                    await fade.finished.catch(() => {});
                }
                handoff.remove();
            } else if (source !== 'reveal') {
                await animatePage(rec, source);
            }
            current.page.inert = false;
            nav.busy = false; committing = false;
            setupNext();
            showPrevious();
            focusPage(rec, source === 'resume');
            // The scroll debounce may have fired while animation held busy.
            // Persist the settled anchor/viewport without rewriting a newer
            // entry if Back/Forward was queued while this page hydrated.
            if (location.href === current.url) remember();
            status.textContent = `${rec.title}. ${source === 'reveal' ? 'Previous page available in the corner.' : ''}`;
            window.dispatchEvent(new CustomEvent('eng:journeysettled', { detail: { source, kind: rec.kind } }));
            lastScroll = scrollY;
            return true;
        } catch (error) {
            if (controller.signal.aborted || version !== generation) return false;
            window.dispatchEvent(new CustomEvent('eng:journeyerror', { detail: { message: error.message } }));
            // A real load preserves normal offline/service-worker behavior and
            // avoids executing mixed assets after a deployment or load failure.
            location.assign(dest.href);
            return false;
        } finally {
            if (version === generation) {
                request = null; nav.busy = false; committing = false;
                delete document.documentElement.dataset.journeyLoading;
                current.page.inert = false;
                if (queuedNavigation) {
                    const queued = queuedNavigation;
                    queuedNavigation = null;
                    navigate(queued.value, queued.options).then(queued.resolve);
                }
            }
        }
    }

    function modified(event) {
        return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    }

    function sameSurface(url) {
        if (current.kind === 'shop') return /^\/(?:shop|products\/[a-z0-9-]+)$/.test(url.pathname)
            || (url.pathname === '/' && new URL(current.url).pathname === '/');
        if (current.kind === 'coach') return url.pathname === new URL(current.url).pathname
            && url.searchParams.get('group') === new URL(current.url).searchParams.get('group');
        return url.pathname === location.pathname && url.search === location.search;
    }

    // Window bubbling runs after page-owned product, reader and reveal-card
    // handlers. Respect their preventDefault and modifier/new-tab semantics.
    window.addEventListener('click', (event) => {
        if (event.defaultPrevented || modified(event)) return;
        const link = event.target.closest?.('a[href]');
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.hasAttribute('data-hard-nav')) return;
        const dest = new URL(link.href);
        if (!eligible(dest)) return;
        if (sameSurface(dest)) {
            if (dest.hash && dest.hash !== location.hash) remember();
            return;
        }
        event.preventDefault();
        navigate(dest.href);
    });

    window.addEventListener('popstate', (event) => {
        const dest = new URL(location.href);
        if (!eligible(dest)) return;
        const state = event.state?.__engJourney;
        if (state?.id === current.id || (!state && sameSurface(dest))) {
            // Back followed by Forward while hydration settles must cancel the
            // older queued traversal when the latest entry is already current.
            if (queuedNavigation?.options.history) {
                queuedNavigation.resolve(false);
                queuedNavigation = null;
            }
            if (!committing) {
                current.url = dest.href;
                if (typeof state?.scroll === 'number') {
                    current.scroll = state.scroll;
                    scrollTo({ top: state.scroll, left: 0, behavior: 'instant' });
                }
            }
            return;
        }
        navigate(dest.href, { source: 'history', history: true, state });
    });

    window.addEventListener('wheel', (event) => { if (event.deltaY > 0 && !event.ctrlKey) inputAt = performance.now(); }, { passive: true });
    let touchY = 0;
    window.addEventListener('touchstart', (event) => { touchY = event.touches[0]?.clientY || 0; }, { passive: true });
    window.addEventListener('touchmove', (event) => { if ((event.touches[0]?.clientY || 0) < touchY) inputAt = performance.now(); }, { passive: true });
    window.addEventListener('keydown', (event) => {
        if (['PageDown', 'End', 'ArrowDown', ' '].includes(event.key) && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) inputAt = performance.now();
    });
    window.addEventListener('scroll', () => {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
            scrollFrame = 0;
            const down = scrollY > lastScroll;
            lastScroll = scrollY;
            updateScroll(down);
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => { if (!nav.busy) remember(); }, 150);
        });
    }, { passive: true });
    window.addEventListener('resize', () => updateScroll(false), { passive: true });
    window.addEventListener('engmanager:themechange', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        runtime.querySelectorAll('iframe').forEach((iframe) => {
            try {
                const html = iframe.contentDocument?.documentElement;
                if (theme) html?.setAttribute('data-theme', theme); else html?.removeAttribute('data-theme');
            } catch {}
        });
    });
    window.addEventListener('pagehide', () => { if (!nav.busy) remember(); });

    nav.navigate = navigate;
    nav.prepareNext = prepareNext;
    nav.dismissPrevious = dismissPrevious;
    nav.busy = false;
    nav.ready = true;
    document.documentElement.dataset.journey = 'ready';
    setupNext();
})();
