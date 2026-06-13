# syntax=docker/dockerfile:1
#
# Build the `website` binary on a beefy machine (GitHub Actions, 16 GB) and ship
# a small runtime image to Render. Render then "deploys an existing image"
# instead of compiling — which is what was OOM-ing its build instance, since the
# release profile uses thin-LTO + codegen-units=1 over heavy deps (tantivy, oxc,
# surrealdb, lightningcss).
#
# cargo-chef caches the dependency build as its own layer, so app-only changes
# rebuild in a couple of minutes instead of recompiling the whole graph.

# --- cargo-chef base ---------------------------------------------------------
FROM rust:bookworm AS chef
# Installed on stable (no rust-toolchain.toml in scope yet); cargo-chef just
# shells out to cargo, so the toolchain it was compiled with doesn't matter.
RUN cargo install cargo-chef --locked
WORKDIR /app

# --- plan the dependency graph ----------------------------------------------
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# --- build -------------------------------------------------------------------
FROM chef AS builder
# rust-toolchain.toml first so rustup installs the pinned nightly before the
# (cached) dependency cook, keeping the cook and the final build on one
# toolchain. Cooking from just the recipe means app-source edits don't bust the
# dependency layer.
COPY rust-toolchain.toml ./
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
# Full source; only the workspace crate(s) recompile from here.
COPY . .
RUN cargo build --release -p website

# --- runtime -----------------------------------------------------------------
# Slim Debian matches the glibc the gnu-target binary links against. Assets,
# articles, CSS, and JS are all embedded into the binary at compile time
# (rust-embed + build.rs), so the runtime image needs nothing but the binary
# and CA certificates.
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 10001 --create-home app
COPY --from=builder /app/target/release/website /usr/local/bin/website
USER app
ENV RUST_LOG=info,tower_http=warn
# Render injects PORT and routes to it; config.rs binds 0.0.0.0:$PORT whenever
# PORT is present. EXPOSE is documentation only.
EXPOSE 3000
CMD ["website"]
