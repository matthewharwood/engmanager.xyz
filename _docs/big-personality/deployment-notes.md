# Big Six-Seven deployment investigation

Read-only observations made 19 September 2026 Pacific / 20 September 2026 UTC. This document records the release path; it does not record a completed deployment. No credentials, deploy-hook URLs, source-report contents, or personal assessment links are included.

## Verified repository and host

| Item | Observation |
| --- | --- |
| Repository | Public `matthewharwood/engmanager.xyz`; origin uses GitHub HTTPS |
| Default branch | `main`; observed remote commit `4e9b283adc3c3e9f21918977e0f8cd17f8114bc2` before this release |
| GitHub authorization | Existing `gh` keychain session is the repository owner's account with ADMIN/push access |
| Merge policy | Squash, merge commit, and rebase enabled; auto-merge disabled; branch protection false; no repository rulesets |
| Checks | Existing main commit has a successful GitHub Actions check named `fmt · clippy · test (unit + integration + browser)` |
| Deployment records | No repository webhooks, GitHub deployments, Render commit checks, repository secret names, or repository variable names were returned |
| Local deployment tools | `gh`, `git`, and `curl` available; Render CLI absent; no callable Render connector found |
| Local deployment configuration | `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `RENDER_HOSTNAME`, `CF_API_TOKEN`, and `CF_ZONE_ID` absent from the process environment; values were never requested |
| Render public origin | `https://engmanager-xyz.onrender.com`, documented by `scripts/cloudflare-bootstrap.sh:23` and `:37`, and verified to answer `/health` |
| Public site | `https://engmanager.xyz`, behind Cloudflare; public A records are Cloudflare addresses, not a Render service ID |

An absent repository webhook does not establish that Render automatic deployment is off: Render can use a GitHub App connection. The service ID, linked branch, actual build/start settings, automatic-deploy mode, and Render post-deploy settings remain unverified because no Render credentials or connected dashboard browser were available. The repository's stated build is `cargo build --release`, start is `./target/release/website`, and Render supplies `PORT` (`README.md:131`).

The current CI file runs JavaScript tests and the deterministic release-manifest drift check, then Rust formatting, Clippy, unit/integration/browser tests. It contains no deployment or purge invocation (`.github/workflows/ci.yml:1`). A passing CI run therefore verifies this repository's checks, not Render deployment completion.

Render supports automatic deployment on each linked-branch commit, after checks pass, or disabled. These are service settings that must be observed, not inferred. A public-repository URL connection can require manual deployment. [Render deploy documentation](https://render.com/docs/deploys).

## Live baseline before this release

Observed around `2026-09-20 00:07 UTC`:

| URL | Status/body | Relevant headers |
| --- | --- | --- |
| `https://engmanager.xyz/health` | 200, `OK` | `cf-cache-status: DYNAMIC`, `x-render-origin-server: Render` |
| `https://engmanager-xyz.onrender.com/health` | 200 | `cf-cache-status: DYNAMIC`, `x-render-origin-server: Render` |
| `https://engmanager.xyz/articles/big-personality` | 404 | `cache-control: no-store`, `cf-cache-status: BYPASS` |
| `https://engmanager.xyz/` | 200 | `public, max-age=60, s-maxage=3600, stale-while-revalidate=86400`; Cloudflare served an expired/revalidated cache entry |

The old production responses have the general site CSP in report-only mode. The new assessment release must be verified for its enforced route-specific CSP and `Referrer-Policy: no-referrer` after deployment; a 200 response alone is insufficient.

## Release commands for the implementing agent

The user authorized the complete implementation, pull request, merge, and live deployment. The following are intended commands, not a claim that they have run. Replace placeholders with inspected branch/PR/commit values. Keep the existing working tree's user changes intact.

1. Finish implementation and regenerate every relevant manifest before running the committed checks. Inspect staged paths and file sizes. The personal `_docs/big5.pdf` is a source report and must remain outside the public commit. Model weights must also remain outside Git. Check that necessary vendor files were not silently ignored: at investigation time `.gitignore:74` (`dist/`) excluded `website/assets/personality/ai/v1/vendor/litert-lm/dist/index.js` and its required sibling modules; add an explicit exception or deliberately stage those vetted files.
2. Use a `codex/` feature branch and push the reviewed commit. Write the exact PR description to a temporary UTF-8 file, then run:

```sh
gh pr create --repo matthewharwood/engmanager.xyz --base main --head codex/CHOSEN-BRANCH --title 'CHOSEN TITLE' --body-file /private/tmp/big-six-seven-pr.md
```

3. Attach the resulting pull request URL to the current Codex task. Inspect the PR head and checks:

```sh
gh pr view PR_NUMBER --repo matthewharwood/engmanager.xyz --json url,headRefOid,mergeStateStatus,statusCheckRollup
gh pr checks PR_NUMBER --repo matthewharwood/engmanager.xyz --json name,state,bucket,link
```

4. After the actual PR head passes the required checks, merge that exact inspected head. Do not use `--auto` because repository auto-merge is disabled. Do not bypass a failing check merely because the branch is unprotected.

```sh
gh pr merge PR_NUMBER --repo matthewharwood/engmanager.xyz --squash --match-head-commit VERIFIED_PR_HEAD_SHA
gh pr view PR_NUMBER --repo matthewharwood/engmanager.xyz --json mergedAt,mergeCommit,url
```

5. Observe the Render deploy associated with the merged commit if dashboard/API access becomes available. If a connected service automatically deploys the linked branch, a merge can be sufficient to trigger it. Otherwise, an authorized manual deploy requires a verified service ID and authenticated Render context. The CLI's explicit-commit command is:

```sh
render deploys create VERIFIED_SERVICE_ID --commit VERIFIED_MERGE_SHA --wait --confirm --output json
render deploys list VERIFIED_SERVICE_ID --output json
```

The documented `--wait` exits unsuccessfully when deployment fails. Do not trigger a guessed service or invent a deploy-hook URL. If only a dashboard hook is available, treat its entire URL as a secret and never put it in this document, a PR, logs, or task output. [Render CLI reference](https://render.com/docs/cli-reference), [Render hook documentation](https://render.com/docs/deploy-hooks).

6. Verify the public origin and custom domain separately. Fetch the final `/assets/personality/v1/release.mjs` bytes from each origin and compare them against the generated file from the merged commit. Verify 200 responses for `/articles/big-personality` and all six `/personality/{prepare,test,review,report,share,library}` paths. Verify `/personality/sw.js` JavaScript MIME, `no-cache` behavior, and `Service-Worker-Allowed: /personality/`. Repeat the browser flow with synthetic responses, PDF export, refresh, exact fragment link, and installed offline shell. Do not send real answers through diagnostic request URLs.

```sh
curl -fsS https://engmanager-xyz.onrender.com/health
curl -fsS https://engmanager-xyz.onrender.com/assets/personality/v1/release.mjs -o /private/tmp/big-six-seven-origin-release.mjs
curl -fsS https://engmanager.xyz/assets/personality/v1/release.mjs -o /private/tmp/big-six-seven-live-release.mjs
cmp website/assets/personality/v1/release.mjs /private/tmp/big-six-seven-origin-release.mjs
cmp website/assets/personality/v1/release.mjs /private/tmp/big-six-seven-live-release.mjs
```

Use bounded polling while a deploy is building, with status updates. Matching public assets and healthy routes establish the observed deployed release; they do not reveal a Render deploy ID. A final response should distinguish those kinds of evidence.

## Cloudflare cache path

`scripts/cloudflare-bootstrap.sh:105` configures HTML caching for `/` and `/articles*`, and separate existing shop/coaching rules. It does not opt `/personality/*` into that HTML rule. `website/src/http.rs:29` documents one-hour edge caching and its stale window. The source is evidence of intended configuration, not a fresh Cloudflare dashboard audit.

`scripts/purge-cache.sh:9` accepts `CF_API_TOKEN` and `CF_ZONE_ID`; explicit positional URL arguments purge only those URLs, whereas no arguments purge the entire zone. No repository invocation ties that script to the deployment. Credentials may exist only in Render configuration, which was not inspected. If the origin is current but the custom domain is stale, use the configured narrow purge path rather than redeploying the application repeatedly:

```sh
./scripts/purge-cache.sh https://engmanager.xyz/ https://engmanager.xyz/articles/ https://engmanager.xyz/articles/big-personality
```

Run that only with existing authorized credentials and only when necessary. Keep response comparisons against both the origin and custom domain. The old article 404 is explicitly `no-store`, which reduces the likelihood of an old cached 404 blocking this first release.

## Optional LiteRT-LM distribution boundary

The selected implementation is local model-file import: the application offers a pinned external model download link; the user downloads the public file separately and chooses it through a file picker. The app itself does not fetch model weights from Hugging Face or upload responses/prompts. This avoids adding any external model origin to `connect-src` or any Rust model-download proxy.

The implemented runtime is pinned `@litert-lm/core@0.17.1` under `/assets/personality/ai/v1/`, separate from the base `/assets/personality/v1/` release/offline graph. This is LiteRT-LM's language-model API, distinct from generic `@litertjs/core` tensor inference. The upstream browser API is an early preview using WebGPU and supports the specific web-compatible Gemma E2B/E4B packs; `Engine.create` accepts a Blob, so verified local file import fits its API. [Official LiteRT-LM JavaScript source documentation](https://github.com/google-ai-edge/LiteRT-LM/blob/main/js/packages/core/README.md).

The pinned local metadata names `gemma-4-E2B-it-web.litertlm`, revision `b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1`, 2,008,432,640 bytes. The distributor identifies the model as Apache-2.0 and includes distinct web, GPU, and other packs; selecting the exact web file matters. Verify its immutable revision, complete byte count, license, and digest against the final implementation provenance. [Distributor file listing](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/tree/b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1).

Deployment and acceptance implications:

- `website/src/assets.rs:22` embeds all `website/assets/` bytes into the Rust binary. The approximately 34 MB portable runtime can intentionally be embedded and downloaded only on opt-in; the 2 GB model must never be placed anywhere below that folder. There is no backend weight storage or inference service.
- `scripts/personality-release.mjs:9` walks only the base v1 directory. Keep optional runtime assets in their separate directory/manifest and out of the standard offline install. `website/assets/personality/v1/sw.js:11` caps each base file at 8 MiB; it is deliberately unsuitable for the optional runtime's large WASM file or model weights.
- Preserve exact same-origin worker/runtime URLs, JavaScript and WASM MIME types, all vendored transitive dependencies/licenses, and an independently generated runtime integrity manifest. A fresh checkout and release build must contain required `vendor/litert-lm/dist/` files, not merely files present in a developer's ignored working tree.
- Scope the required `wasm-unsafe-eval` permission to the inference worker response. Keep assessment scripts restricted to self and remote connections blocked. `unsafe-eval` is broader and unnecessary merely to compile WebAssembly. Test the actual worker under production response headers; do not infer worker permission from the document's CSP. [MDN CSP WebAssembly policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_webassembly_execution).
- Validate file length before import and use incremental SHA-256 over bounded slices before publishing the model's local ready record. Native `crypto.subtle.digest` requires a complete in-memory input, making one 2 GB buffer an unsuitable import strategy. The implemented vendored incremental hash avoids that requirement. [MDN digest contract](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest).
- Store the verified model separately from assessment IndexedDB, with explicit progress, cancellation, removal, and missing/evicted-model recovery. Cache Storage supports storing a local Blob behind a synthetic same-origin key; it does not require uploading the Blob or a network fetch for that key. [Chrome browser-model storage guidance](https://developer.chrome.com/docs/ai/cache-models).
- Require actual WebGPU initialization and one real generation on supported hardware before claiming the optional AI path was verified. A `navigator.gpu` property check, mocked engine, or successful WASM download is insufficient. Handle quota failure, denied/absent GPU adapter, memory allocation failure, and context loss while preserving the deterministic standard report. Browser storage estimates are approximate and stored files can be evicted. [MDN storage limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

No Render service changes are required solely to perform local inference: it serves the versioned optional runtime as public bytes, while model storage and generation remain in the browser. The larger runtime increases the compiled application/artifact size, so the release build and deployed WASM response still need to be checked.
