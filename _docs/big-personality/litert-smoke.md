# Manual real-model LiteRT smoke test

The regular test suite checks lifecycle, storage, scoring, report validation and offline installation without downloading a language model. This separate opt-in command runs the actual browser engine and approved Gemma model. It uses Node's built-in HTTP/WebSocket APIs and an installed Chrome; no Playwright, driver package or runtime CDN is required.

Requirements: Node 22 or newer, Google Chrome/Chromium with working WebGPU, enough memory to run the model, and several gigabytes of temporary disk space. The script uses a fresh temporary browser profile and removes it afterward. It does not modify a personal browser profile or the application's saved assessments.

Download the supported `gemma-4-E2B-it-web.litertlm` yourself using the pinned publisher link in the app's local-AI setup or `PINNED_MODEL.downloadUrl` in `website/assets/personality/ai/v1/model-manager.mjs`. The harness never downloads weights. Other model files are rejected by size and SHA-256 before the browser starts.

From the repository root, run:

```bash
node scripts/personality-litert-smoke.mjs \
  --model=/absolute/path/gemma-4-E2B-it-web.litertlm \
  --tasks=focused \
  --output=/absolute/path/litert-smoke-audit.json
```

`focused` runs values trade-offs, dated experiment notes, and report Q&A. Use `--tasks=all` for all ten actions, or a comma-separated list such as `--tasks=synthesis,visibility`. The default is `focused`.

`PERSONALITY_MODEL_FILE` can supply the model path. Chrome is discovered in its usual macOS/Windows location or on Linux's `PATH`; override it with `CHROME_BIN` or `--chrome=/absolute/path/to/chrome`. The default overall test timeout is ten minutes; `--timeout=600000` makes that explicit. Run `--help` for the option summary. No experimental WebGPU or GPU-blocklist flags are injected. A device without working WebGPU will fail the optional test; the standard report remains independent of that capability.

The harness:

1. Verifies the real model's size and SHA-256, then serves it only on an ephemeral localhost port.
2. Reads the production assessment CSP from `website/src/http.rs` and applies it to the page, worker, scripts and WASM responses. The boot script is external; there is no inline-script or JavaScript-eval exception.
3. Runs the actual local import, model loading, `generateReflection`, report validation, bounded correction when applicable, and unload flow using synthetic questionnaire answers and fictional notes.
4. Records accepted output, rejected drafts, attempt counts, timings, browser version, CSP and observed requests. It asserts that requests use static local GET endpoints; no prompt or answer is sent to an inference service.
5. Closes Chrome, stops the local server and deletes the isolated profile even if the test fails.

The audit intentionally contains fictional generated text so it can be reviewed for quality. Passing means the runtime and report contracts worked on that device. It does **not** establish psychometric validity, factual correctness of every sentence, useful task completion, or better reports than the reviewed baseline. Review the actual output, especially whether it answers the chosen task and keeps uncertainty visible. Model generation can be variable; report-contract rejection is a useful result, not a reason to weaken validation.

This command is deliberately excluded from default CI: CI must not silently download two gigabytes or require a WebGPU device. After editing the runtime, regenerate its manifest and the parent assessment release before running the normal tests; see the runtime README for those authoring commands.
