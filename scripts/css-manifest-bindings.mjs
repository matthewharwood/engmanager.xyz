// Native test tooling only. Bind explicit owned names; never rewrite source.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const has = (object, name) => Object.hasOwn(object, name);
function classToken(value) {
    if (typeof value !== 'string' || !value || /[\s"'<>/=]/u.test(value)) throw Error(`Expected one CSS class token: ${JSON.stringify(value)}`);
    return value;
}
function identifier(value) {
    return [...value].map((character, index) => {
        const code = character.codePointAt(0);
        if (code === 0) return '\ufffd';
        if (code < 32 || code === 127 || /\d/.test(character) && (index === 0 || index === 1 && value[0] === '-')) return `\\${code.toString(16)} `;
        if (character === '-' && value.length === 1) return '\\-';
        return code >= 128 || /[\w-]/.test(character) ? character : `\\${character}`;
    }).join('');
}

export function cssManifestBindings(project = null, provenance = null) {
    const manifest = project?.manifest ?? project;
    if (manifest && manifest.schema_version !== 1) throw Error(`Unsupported CSS manifest schema: ${manifest.schema_version}`);
    if (manifest && (typeof manifest.generation !== 'string' || !manifest.generation)) throw Error('CSS manifest has no generation');
    function token(name) {
        classToken(name);
        if (!manifest) return name;
        if (!has(manifest.classes ?? {}, name)) throw Error(`CSS manifest has no authored binding for ${name}`);
        if (!has(manifest.identities ?? {}, name)) throw Error(`Observed CSS identity ${name} was elided; use a stable data selector or retain its identity in the build inventory`);
        const value = classToken(manifest.identities[name]);
        if (!manifest.classes[name]?.includes(value)) throw Error(`CSS identity ${name} is absent from its expanded class binding`);
        return value;
    }
    function className(literal) {
        if (typeof literal !== 'string' || !literal.trim()) throw Error('Expected an explicit authored class list');
        const values = literal.trim().split(/\s+/u).flatMap(name => {
            classToken(name);
            if (!manifest) return [name];
            const expanded = manifest.classes?.[name];
            if (!Array.isArray(expanded) || !expanded.length) throw Error(`CSS manifest has no expanded binding for ${name}`);
            return expanded.map(classToken);
        });
        return [...new Set(values)].join(' ');
    }
    return Object.freeze({
        token,
        className,
        selector: name => `.${identifier(token(name))}`,
        generation: manifest?.generation ?? null,
        provenance,
        assertHtmlGeneration(html) {
            if (!manifest) return;
            const tags = [...html.matchAll(/<meta\b[^>]*>/gi)];
            const tag = tags.find(([value]) => /\bname\s*=\s*["']eng-css-generation["']/i.test(value))?.[0];
            const actual = tag?.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? null;
            if (actual !== manifest.generation) throw Error(`Served CSS generation ${actual} differs from manifest ${manifest.generation}`);
        },
    });
}

export async function loadCssManifestBindings(path) {
    if (!path) return cssManifestBindings();
    const file = resolve(path), raw = await readFile(file, 'utf8'), project = JSON.parse(raw);
    const manifest = project.manifest ?? project;
    return cssManifestBindings(project, { path: file, sha256: createHash('sha256').update(raw).digest('hex'), schemaVersion: manifest.schema_version, generation: manifest.generation, compilerVersion: manifest.compiler_version ?? null });
}
