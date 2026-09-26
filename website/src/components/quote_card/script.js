// Native HTML layout is the source of both the readable preview and its PNG.
// The compatibility path snapshots this text-only card through SVG; it does
// not patch browser prototypes or emulate the experimental paint lifecycle.
(() => {
    const LIMIT = 480;
    const supported = () => typeof CanvasRenderingContext2D !== 'undefined'
        && typeof CanvasRenderingContext2D.prototype.drawElementImage === 'function'
        && typeof HTMLCanvasElement.prototype.requestPaint === 'function';
    let dispose = () => {};
    const unmount = () => { dispose(); dispose = () => {}; };

    function passage(node) {
        const clone = node?.cloneNode(true);
        clone?.querySelectorAll('button, script, style').forEach(control => control.remove());
        return clone?.textContent?.replace(/\s+/g, ' ').trim() || '';
    }

    async function prepareFonts(signal) {
        signal.throwIfAborted();
        await new Promise((resolve, reject) => {
            const finish = error => {
                clearTimeout(timer);
                signal.removeEventListener('abort', abort);
                if (error) reject(error); else resolve();
            };
            const abort = () => finish(new DOMException('Export cancelled', 'AbortError'));
            const timer = setTimeout(() => finish(new Error('Font loading timed out')), 5000);
            signal.addEventListener('abort', abort, { once: true });
            (async () => {
                let current;
                do {
                    // Theme faces load outside FontFaceSet until decoded, and
                    // its transition can temporarily substitute Redacted bars.
                    current = window.__engTypography?.ready;
                    await current;
                    await window.__engTypography?.displayReady;
                    await document.fonts.ready;
                    signal.throwIfAborted();
                } while (current !== window.__engTypography?.ready);
            })().then(() => finish(), finish);
        });
        signal.throwIfAborted();
    }

    // Paint snapshots are only valid in the native paint event. Keep the card
    // laid out and restore the same DOM node on every exit.
    function captureNative(artwork, signal) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            // Opt into subtree layout before creating the drawing context.
            // Both attributes cover the trial and evolving API shapes.
            canvas.setAttribute('layoutsubtree', '');
            canvas.setAttribute('content', 'drawable');
            const context = canvas.getContext('2d');
            const parent = artwork.parentNode;
            const oldStyle = artwork.getAttribute('style');
            const rect = artwork.getBoundingClientRect();
            let finished = false, encoding = false;
            const restore = () => {
                canvas.removeEventListener('paint', paint);
                signal.removeEventListener('abort', abort);
                clearTimeout(timeout);
                parent.replaceChildren(artwork);
                artwork.removeAttribute('drawable');
                if (oldStyle === null) artwork.removeAttribute('style');
                else artwork.setAttribute('style', oldStyle);
                canvas.width = canvas.height = 0;
            };
            const finish = (error, blob) => {
                if (finished) return;
                finished = true;
                restore();
                if (error) reject(error); else resolve(blob);
            };
            const abort = () => finish(new DOMException('Export cancelled', 'AbortError'));
            const paint = () => {
                if (finished || encoding) return;
                try {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    // Explicit destination pixels avoid double-applying DPR.
                    const transform = context.drawElementImage(artwork, 0, 0, canvas.width, canvas.height);
                    // The origin-trial API returns a matrix; the newer proposal
                    // updates geometry itself and returns undefined.
                    if (transform) artwork.style.transform = transform.toString();
                    encoding = true;
                    canvas.toBlob(blob => {
                        finish(blob?.size ? null : new Error('Empty PNG'), blob);
                    }, 'image/png');
                } catch (error) { finish(error); }
            };
            const timeout = setTimeout(() => finish(new Error('Canvas paint timed out')), 5000);
            signal.addEventListener('abort', abort, { once: true });
            try {
                if (!context || rect.width <= 0 || rect.height <= 0) throw new Error('No drawable preview');
                canvas.dataset.quoteCardCanvas = '';
                artwork.setAttribute('drawable', '');
                artwork.style.inlineSize = `${rect.width}px`;
                canvas.style.cssText = `display:block;width:${rect.width}px;height:${rect.height}px;max-width:100%`;
                // Fixed 2x export is sharp and bounds memory independently of
                // devicePixelRatio. The preview itself stays responsive HTML.
                canvas.width = Math.ceil(rect.width * 2);
                canvas.height = Math.ceil(rect.height * 2);
                canvas.addEventListener('paint', paint);
                parent.replaceChild(canvas, artwork);
                canvas.appendChild(artwork);
                canvas.requestPaint();
            } catch (error) { finish(error); }
        });
    }

    // SVG images cannot fetch external resources. Snapshot computed styles and
    // embed only the fonts this card uses, including the dynamically loaded
    // theme face (which has no @font-face rule in a stylesheet).
    async function snapshotFonts(families, signal) {
        const faces = Object.values(window.__engThemeFonts || {})
            .filter(face => families.includes(face.family))
            .map(face => ({ ...face, weight: '400' }));
        const shared = document.querySelector('[data-theme-font-faces]')?.sheet;
        for (const rule of shared?.cssRules || []) {
            if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
            const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '');
            const url = rule.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/)?.[1];
            if (url && families.includes(family)) faces.push({ family, url, weight: rule.style.fontWeight });
        }
        return (await Promise.all(faces.map(async face => {
            const url = new URL(face.url, location.href);
            if (url.origin !== location.origin) throw new Error('Unexpected font origin');
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error('Font snapshot unavailable');
            const bytes = new Uint8Array(await response.arrayBuffer());
            signal.throwIfAborted();
            let binary = '';
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return `@font-face{font-family:"${face.family}";font-weight:${face.weight};font-style:normal;src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2")}`;
        }))).join('');
    }

    function captureSvg(artwork, signal) {
        return new Promise((resolve, reject) => {
            const operation = new AbortController();
            const canvas = document.createElement('canvas');
            const picture = new Image();
            let finished = false;
            const finish = (error, blob) => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                signal.removeEventListener('abort', abort);
                operation.abort();
                picture.onload = picture.onerror = null;
                picture.removeAttribute('src');
                canvas.width = canvas.height = 0;
                if (error) reject(error); else resolve(blob);
            };
            const abort = () => finish(new DOMException('Export cancelled', 'AbortError'));
            const timer = setTimeout(() => finish(new Error('PNG snapshot timed out')), 8000);
            signal.addEventListener('abort', abort, { once: true });
            (async () => {
                signal.throwIfAborted();
                const rect = artwork.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) throw new Error('No drawable preview');
                const clone = artwork.cloneNode(true);
                const originals = [artwork, ...artwork.querySelectorAll('*')];
                const copies = [clone, ...clone.querySelectorAll('*')];
                const families = [];
                originals.forEach((node, index) => {
                    const style = getComputedStyle(node);
                    families.push(style.fontFamily);
                    for (const property of style) {
                        // All standard computed properties have resolved lengths
                        // and colors; custom properties are no longer needed.
                        if (!property.startsWith('--')) copies[index].style.setProperty(property, style.getPropertyValue(property));
                    }
                    copies[index].style.animation = 'none';
                    copies[index].style.transition = 'none';
                });
                clone.style.margin = '0';
                clone.style.transform = 'none';
                clone.style.width = `${rect.width}px`;
                clone.style.height = `${rect.height}px`;
                const fontCss = await snapshotFonts(families.join(','), operation.signal);
                operation.signal.throwIfAborted();
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', String(rect.width));
                svg.setAttribute('height', String(rect.height));
                const foreign = document.createElementNS(svg.namespaceURI, 'foreignObject');
                foreign.setAttribute('width', '100%');
                foreign.setAttribute('height', '100%');
                const fonts = document.createElement('style');
                fonts.textContent = fontCss;
                clone.prepend(fonts);
                foreign.append(clone);
                svg.append(foreign);
                picture.onload = async () => {
                    try {
                        await picture.decode();
                        operation.signal.throwIfAborted();
                        canvas.width = Math.ceil(rect.width * 2);
                        canvas.height = Math.ceil(rect.height * 2);
                        canvas.dataset.quoteCardCanvas = '';
                        const context = canvas.getContext('2d');
                        if (!context) throw new Error('Canvas unavailable');
                        context.drawImage(picture, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob(blob => finish(blob?.size ? null : new Error('Empty PNG'), blob), 'image/png');
                    } catch (error) { finish(error); }
                };
                picture.onerror = () => finish(new Error('SVG snapshot unavailable'));
                // A data URL preserves origin-clean canvas readback for SVG
                // foreignObject content and fits the site's image CSP.
                picture.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
            })().catch(error => finish(error));
        });
    }

    async function capture(artwork, signal) {
        await prepareFonts(signal);
        if (supported()) {
            try {
                return { blob: await captureNative(artwork, signal), renderer: 'html-in-canvas' };
            } catch (error) {
                // Experimental support can exist without a working paint path.
                // Its cleanup restores the card before the compatibility retry.
                signal.throwIfAborted();
            }
        }
        return { blob: await captureSvg(artwork, signal), renderer: 'svg' };
    }

    function mount(root = document) {
        unmount();
        const article = root.querySelector('.article[data-article-slug]');
        const dialog = root.querySelector('[data-quote-card-dialog]');
        const opener = root.querySelector('[data-quote-card-open]');
        if (!article || !dialog || !opener || typeof dialog.showModal !== 'function') return;
        const lifetime = new AbortController();
        const { signal } = lifetime;
        const artwork = dialog.querySelector('[data-quote-card-artwork]');
        const quote = dialog.querySelector('[data-quote-card-quote]');
        const text = dialog.querySelector('[data-quote-card-text]');
        const status = dialog.querySelector('[data-quote-card-status]');
        const download = dialog.querySelector('[data-quote-card-download]');
        const source = artwork.querySelector('a');
        const generated = [];
        const urls = new Map();
        let exporting = null, copyText = '', returnFocus = null;
        const cancel = () => { exporting?.abort(); exporting = null; download.disabled = false; };

        function selection() {
            const selected = window.getSelection();
            if (!selected?.rangeCount || selected.isCollapsed) return '';
            const range = selected.getRangeAt(0);
            if (!article.contains(range.startContainer) || !article.contains(range.endContainer)) return '';
            const fragment = range.cloneContents();
            fragment.querySelectorAll('button, script, style').forEach(control => control.remove());
            return fragment.textContent.replace(/\s+/g, ' ').trim();
        }

        function open(raw, trigger) {
            if (!raw) return;
            cancel();
            const characters = Array.from(raw);
            const shortened = characters.length > LIMIT;
            const excerpt = shortened
                ? characters.slice(0, LIMIT).join('').replace(/\s+\S*$/, '').trimEnd() + '…'
                : raw;
            quote.textContent = excerpt;
            copyText = `“${excerpt}”\n— Matthew Harwood, ${artwork.querySelector('.quote-card-article').textContent}\n${source.href}`;
            text.value = copyText;
            download.hidden = false;
            status.textContent = (shortened ? 'Long passage shortened for this card. ' : '')
                + 'Download the card or copy the quote with its source.';
            returnFocus = trigger;
            dialog.showModal();
        }

        opener.hidden = false;
        opener.addEventListener('click', () => {
            open(selection() || passage(article.querySelector('blockquote')
                || article.querySelector('.article-reveal-section p, :scope > p')), opener);
        }, { signal });
        article.querySelectorAll('blockquote').forEach(block => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'share-quote';
            button.dataset.quoteCardFromQuote = '';
            button.textContent = 'Make quote card';
            button.addEventListener('click', () => open(passage(block), button), { signal });
            block.appendChild(button);
            generated.push(button);
        });
        dialog.querySelector('[data-quote-card-close]').addEventListener('click', () => dialog.close(), { signal });
        dialog.addEventListener('close', () => {
            cancel();
            if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
        }, { signal });
        dialog.addEventListener('cancel', cancel, { signal });
        dialog.querySelector('[data-quote-card-copy]').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(copyText);
                if (!signal.aborted && dialog.open) status.textContent = 'Quote and source link copied.';
            } catch {
                if (signal.aborted || !dialog.open) return;
                text.focus();
                text.select();
                status.textContent = 'Copy is unavailable. The quote and source are selected above; use your browser’s Copy command.';
            }
        }, { signal });
        download.addEventListener('click', async () => {
            if (exporting) return;
            const operation = new AbortController();
            exporting = operation;
            download.disabled = true;
            status.textContent = 'Preparing PNG…';
            try {
                const { blob, renderer } = await capture(artwork, operation.signal);
                operation.signal.throwIfAborted();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${article.dataset.articleSlug}-quote.png`;
                dialog.appendChild(link);
                link.click();
                link.remove();
                urls.set(url, setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 60000));
                status.textContent = 'PNG ready. The source link is included on the card.';
                document.dispatchEvent(new CustomEvent('engmanager:quote-card-export', { detail: { renderer } }));
            } catch (error) {
                if (error.name !== 'AbortError' && dialog.open) {
                    status.textContent = 'PNG export could not finish. Your quote is intact; copy the quote and link or try again.';
                }
            } finally {
                if (exporting === operation) { exporting = null; download.disabled = false; }
            }
        }, { signal });

        dispose = () => {
            lifetime.abort();
            cancel();
            if (dialog.open) dialog.close();
            generated.forEach(button => button.remove());
            opener.hidden = true;
            for (const [url, timer] of urls) { clearTimeout(timer); URL.revokeObjectURL(url); }
            urls.clear();
        };
    }

    mount();
    window.__engNav?.onBeforeSwap?.(unmount);
    window.__engNav?.onSwap?.(mount);
})();
