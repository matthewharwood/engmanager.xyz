import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../website/js/src/article-diagrams.js', import.meta.url), 'utf8');
// Isolate palette conversion; use a source-over canvas fixture so this catches
// discarded alpha without loading Mermaid or depending on a network CDN.
function palette(tokens, canvasAvailable = true) {
    let pixel = [0, 0, 0, 0];
    const context = {
        fillStyle: '#000000',
        clearRect() { pixel = [0, 0, 0, 0]; },
        fillRect() {
            const rgba = this.fillStyle.startsWith('#')
                ? [1, 3, 5].map(i => parseInt(this.fillStyle.slice(i, i + 2), 16)).concat(1)
                : this.fillStyle.match(/[\d.]+/g).map(Number);
            const alpha = rgba[3] ?? 1;
            const outAlpha = alpha + pixel[3] * (1 - alpha);
            pixel = rgba.slice(0, 3).map((v, i) => (v * alpha + pixel[i] * pixel[3] * (1 - alpha)) / outAlpha).concat(outAlpha);
        },
        getImageData() { return { data: [...pixel.slice(0, 3).map(Math.round), Math.round(pixel[3] * 255)] }; },
    };
    const sandbox = {
        document: { documentElement: {}, createElement: () => ({ getContext: () => canvasAvailable ? context : null }) },
        getComputedStyle: () => ({ getPropertyValue: name => tokens[name] || '' }),
        window: {},
    };
    vm.runInNewContext(source.replace('    mount();', '    globalThis.palette = themeVariables();'), sandbox);
    return sandbox.palette;
}

for (const [name, base, text, expectedSurface] of [
    ['light', '#ffffff', '#000000', '#d1d1d1'],
    ['dark', '#000000', '#ffffff', '#2e2e2e'],
]) {
    test(`${name} diagram keeps translucent node backgrounds distinct from their text`, () => {
        const textRgb = name === 'light' ? '0, 0, 0' : '255, 255, 255';
        const colors = palette({
            '--ctp-base': base, '--ctp-text': text,
            '--ctp-surface0': `rgba(${textRgb}, 0.18)`,
            '--ctp-subtext0': `rgba(${textRgb}, 0.70)`,
        });
        assert.equal(colors.primaryColor, expectedSurface);
        assert.equal(colors.mainBkg, expectedSurface);
        assert.equal(colors.nodeTextColor, text);
        assert.notEqual(colors.lineColor, text);
        assert.equal(colors.edgeLabelBackground, base);
        assert.equal(colors.noteTextColor, text);
        assert.equal(colors.actorTextColor, text);
    });
}

test('missing canvas keeps a readable fallback palette', () => {
    const colors = palette({}, false);
    assert.equal(colors.primaryColor, '#313244');
    assert.equal(colors.nodeTextColor, '#cdd6f4');
    assert.equal(colors.edgeLabelBackground, '#1e1e2e');
});
