# Optional local language-model runtime

This directory contains the real LiteRT-LM browser engine. It is independent of the established questionnaire/scoring release. It does not contain model weights and must not join the default assessment offline installation.

## Sources and pinning

- `@litert-lm/core` **0.17.1**, Apache-2.0, fetched from its official npm tarball. The npm SHA-512 integrity was checked before extraction. The SDK's `Engine`, `createConversation`, streaming, `cancel`, and `delete` APIs match the [official Web documentation](https://developers.google.com/edge/litert-lm/js), checked 2026-09-19.
- `@litertjs/wasm-utils` **2.0.0**, Apache-2.0; official npm integrity verified.
- `@noble/hashes` **2.4.0**, MIT; official npm integrity verified. Incremental SHA-256 verifies a large imported file without a two-gigabyte ArrayBuffer.
- Every dependency retains its package metadata, license and provenance. The only SDK source changes make the wasm-utils import relative and replace its default CDN URL with the local portable WASM path. No tool orchestration API is used.
- Model: **Gemma 4 E2B Web**, `gemma-4-E2B-it-web.litertlm`, from `litert-community/gemma-4-E2B-it-litert-lm` at commit `b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1`. The publisher's model card declares Apache-2.0. The pinned artifact is exactly **2,008,432,640 bytes** with SHA-256 `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5`. A local smoke-test download independently matched that digest. The Web artifact is required; similarly named non-Web files are incompatible.

## API

```js
const {createLocalAI, PINNED_MODEL} = await import('../ai/v1/runtime.mjs');
const ai = createLocalAI({onStatus: ({phase, message}) => showStatus(message)});
// Only after an explicit setup action and storage/download disclosure:
await ai.installRuntime({signal, onProgress});
await ai.importModel(userSelectedFile, {signal, onProgress});
const result = await ai.generate({
  system: reviewedSystemInstruction,
  prompt: JSON.stringify({facts, action}),
  validate: parsed => validateAgainstAvailableFacts(parsed),
}, {signal});
await ai.unload();
```

`PINNED_MODEL.downloadUrl` is a fixed external publisher link for the user to open. The application does not download weights from a third party and never sends a prompt, answer, report or note to it. The user imports the downloaded file, and the complete size and SHA-256 are verified before committing installation. An invalid, cancelled or quota-failed import preserves an earlier complete installation. Public model bytes use Cache Storage; no model weights enter the Rust binary, a share URL, an assessment backup, or IndexedDB.

`modelStatus()` describes the installed model; `load()` initializes the engine; `cancel()` hard-terminates the worker; `unload()` first deletes engine resources when idle, then terminates the worker; `removeModel()` removes only model-owned caches. A new request after cancellation must reload the engine. All failures leave the deterministic report available. `generate()` returns the validated object, never an unchecked HTML fragment. A caller-supplied validator must check the current report's evidence IDs and claim constraints. The default validator only enforces structural/string bounds; it cannot establish scientific truth.

## Browser, resource and offline boundaries

The upstream SDK is an early preview supporting text input/output with WebGPU. The browser must support a secure context, WebGPU, dedicated workers, WebAssembly and Cache Storage. The UI's capability check is preliminary; actual engine initialization may still fail because of GPU limits, storage restrictions, an unsupported driver, or memory pressure. There is no CPU fallback for this supported language-model artifact.

The portable compat/asyncify WASM build is self-hosted, approximately 32 MiB. A classic dedicated worker is necessary because the upstream loader uses `importScripts`. It uses a fixed same-origin `locateFile` path; there are no CDN scripts. The assessment CSP needs `worker-src 'self'` and `script-src 'self' 'wasm-unsafe-eval'`; it does not need `unsafe-eval`, `blob:` scripts, or remote connections. Normal browser execution does not request experimental command-line flags.

Runtime installation uses its own generated manifest and cache. Every file is checked against its SHA-256; the manifest source is reconstructed and compared before committing a ready marker. The app's service worker must serve only manifest-allowlisted AI URLs from the expected ready cache. The marker path is `/assets/personality/ai/v1/__runtime-ready` and its body is `AI_MANIFEST_DIGEST`. An incomplete cache is never announced as installed. Cache Storage by itself does not intercept network requests; the service-worker integration is required for an offline reload.

Input is limited to 14,000 prompt characters and 5,000 system-instruction characters; output to 6,000 characters and 1,536 generated tokens. Engine context is capped at 8,192 tokens. Character limits are not exact token estimates: an oversized tokenized prompt can still fail visibly. Load and generation timeouts are 240 and 120 seconds. Every request uses a fresh conversation with thinking disabled. User inputs remain untrusted data; no tools, file access, network actions or arbitrary generated markup are available to the model. The worker is a cancellation boundary, not protection from compromised same-origin application code.

The default result schema accepts one to four sections, each with an 80-character title, 700-character body and up to eight bounded evidence IDs. It accepts one complete JSON object, optionally enclosed by one JSON code fence. It rejects surrounding prose, invalid JSON, unexpected fields, oversized strings and invalid evidence IDs. Scores and original questionnaire state remain outside this runtime.

Saved accepted prose must be reused for display, PDF and explicit sharing. Re-running the model, even with a fixed seed, is not a guarantee of identical output on another device. Numerical validation and user review remain necessary; local inference does not make a narrative psychometrically validated.

## Verification

Run `node --test scripts/personality-ai-runtime.test.mjs` from the repository root. These tests check bounded streaming hashes, rejection of corrupt files, cancellation and commit failure, cache isolation, schema/evidence validation, lifecycle/timeouts, every shipped asset digest, and optional runtime installation/tamper rejection. Worker mocks test lifecycle behavior; they do not stand in for a real inference benchmark.

A separate real-model integration smoke ran in Chrome **153.0.8010.53** on this host: full model import, WebGPU engine creation, JSON reflection generation with an evidence ID, and clean unload all succeeded. The first run used isolated headless Chrome with Metal and explicit WebGPU/blocklist flags; approximately 49 seconds covered local file transfer, verification, storage and engine initialization, and approximately 25 more seconds produced the reflection. These are a single development observation, not mobile/browser support or performance guarantees. Additional full-product prompt checks are recorded in the project's implementation notes.
