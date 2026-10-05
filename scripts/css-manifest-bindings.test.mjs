import assert from 'node:assert/strict';
import test from 'node:test';
import { cssManifestBindings } from './css-manifest-bindings.mjs';

const project = { manifest: { schema_version: 1, generation: 'fixture-generation', identities: { observed: 'o', preserved: 'preserved' }, classes: { observed: ['o', 'a'], static: ['a', 'b'], preserved: ['preserved'] } } };

test('ordinary baseline selectors and explicit class lists are preserved', () => {
    const css = cssManifestBindings();
    assert.equal(css.token('observed'), 'observed');
    assert.equal(css.selector('observed'), '.observed');
    assert.equal(css.className('static observed static'), 'static observed');
    css.assertHtmlGeneration('<html></html>');
});
test('observed identity selectors do not acquire inseparable declaration atoms', () => {
    const css = cssManifestBindings(project);
    assert.equal(css.token('observed'), 'o');
    assert.equal(css.selector('observed'), '.o');
    assert.equal(css.selector('preserved'), '.preserved');
    assert.equal(css.className('static observed'), 'a b o');
});
test('an elided static identity cannot be used as an observed selector', () => {
    const css = cssManifestBindings(project);
    assert.throws(() => css.token('static'), /was elided/);
    assert.throws(() => css.selector('static'), /was elided/);
    assert.equal(css.className('static'), 'a b');
});
test('unknown authored names and malformed mappings fail before native capture', () => {
    const css = cssManifestBindings(project);
    assert.throws(() => css.selector('unknown'), /no authored binding/);
    assert.throws(() => css.className('unknown'), /no expanded binding/);
    assert.throws(() => css.token('observed another'), /one CSS class token/);
    assert.throws(() => cssManifestBindings({ manifest: { ...project.manifest, identities: { observed: 'missing' } } }).token('observed'), /absent from/);
    assert.throws(() => cssManifestBindings({ manifest: { ...project.manifest, classes: { observed: ['o', 'two tokens'] } } }).className('observed'), /one CSS class token/);
});
test('selector escaping applies to the explicit identity only', () => {
    const css = cssManifestBindings({ manifest: { schema_version: 1, generation: 'test', identities: { observed: '1:token' }, classes: { observed: ['1:token'] } } });
    assert.equal(css.selector('observed'), '.\\31 \\:token');
});
test('schema and document generation are checked without changing markup', () => {
    assert.throws(() => cssManifestBindings({ schema_version: 2, generation: 'test' }), /Unsupported/);
    assert.throws(() => cssManifestBindings({ schema_version: 1 }), /no generation/);
    const css = cssManifestBindings(project);
    css.assertHtmlGeneration('<meta content="fixture-generation" name="eng-css-generation">');
    assert.throws(() => css.assertHtmlGeneration('<meta name="eng-css-generation" content="stale">'), /differs/);
    assert.throws(() => css.assertHtmlGeneration('<html></html>'), /differs/);
});
