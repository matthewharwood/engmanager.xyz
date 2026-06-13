# Deploy: build on GitHub Actions, run on Render

Render's build instance OOMs compiling the release binary (thin-LTO +
`codegen-units = 1` over tantivy / oxc / surrealdb / lightningcss). So we don't
build on Render anymore. GitHub Actions (16 GB runners) builds a Docker image,
pushes it to GHCR, and Render just **pulls and runs** the prebuilt image.

```
push to main ─▶ GitHub Actions ─▶ build image (cargo-chef, 16 GB)
                                  └▶ push ghcr.io/matthewharwood/engmanager.xyz:latest
                                  └▶ POST Render deploy hook ─▶ Render pulls & runs
```

## Files

- `Dockerfile` — multi-stage, cargo-chef for dependency-layer caching. Builder
  is `rust:bookworm` (the pinned nightly from `rust-toolchain.toml` is installed
  automatically); runtime is `debian:bookworm-slim` + `ca-certificates`. Assets,
  articles, CSS, and JS are embedded into the binary at compile time, so the
  runtime image carries nothing but the binary.
- `.dockerignore` — keeps `target/`, `.git/`, docs, etc. out of the build context.
- `.github/workflows/deploy.yml` — builds + pushes to GHCR on push to `main`
  (and `workflow_dispatch`), then triggers the Render deploy hook.

## One-time setup

### 1. GitHub
Nothing required to push the image — the workflow authenticates to GHCR with the
built-in `GITHUB_TOKEN` (it has `packages: write`). After the **first** run:

- Open the package at `https://github.com/users/matthewharwood/packages/container/engmanager.xyz/settings`.
- Either **make it public** (simplest — Render pulls with no credentials), or
  keep it private and create a PAT with `read:packages` for Render (step 2).

Add one repository **secret** (Settings → Secrets and variables → Actions):

- `RENDER_DEPLOY_HOOK` — the deploy hook URL from the Render service (step 3).
  Until it's set, the workflow still builds and pushes the image; it just prints
  a warning instead of pinging Render.

### 2. Render — create the image-backed service
Render can't switch an existing source-built service to an image, so create a
**new** Web Service → **"Deploy an existing image from a registry"**:

- **Image URL:** `ghcr.io/matthewharwood/engmanager.xyz:latest`
- **Credentials:** none if the package is public; otherwise add a GHCR
  credential (username = your GitHub username, password = a `read:packages` PAT).
- **Health check path:** `/health`
- **Env vars:** copy everything from the old service (`COMMENTS_DB_*`,
  `STRIPE_*`, Discord, etc.). Render injects `PORT` itself, and the app binds
  `0.0.0.0:$PORT` whenever `PORT` is set (see `website/src/config.rs`).
- Turn **off** any repo auto-deploy — deploys now come from the hook.

When the new service is healthy, move the custom domain(s) over from the old
service and delete or suspend the old one.

### 3. Wire the deploy hook
- Render service → **Settings → Deploy Hook** → copy the URL.
- Paste it into the GitHub `RENDER_DEPLOY_HOOK` secret (step 1).

## Day-to-day

- Merge to `main` → image builds, pushes `:latest` (and a `sha-<commit>` tag),
  and Render redeploys automatically.
- Manual run: Actions → **Build & Deploy** → **Run workflow**.
- Roll back: in Render, deploy a specific `sha-<commit>` tag, or re-run an older
  workflow run.

## Notes

- First CI build is ~15–20 min (full dependency compile). Subsequent builds
  reuse the cargo-chef dependency layer via the GitHub Actions cache and finish
  in a few minutes unless `Cargo.lock` changes.
- The `auteur-rs` git dependency is public, so no extra git credentials are
  needed in CI.
- Build it locally the same way Render will run it:
  `docker build -t engmanager . && docker run -p 3000:3000 -e PORT=3000 engmanager`.
