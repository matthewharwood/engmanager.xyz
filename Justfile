set shell := ["bash", "-cu"]

port := env_var_or_default("PORT", "3000")

default:
    @just --list

# One-time install of the dev-loop toolchain.
bootstrap-tools:
    cargo install systemfd watchexec-cli --locked

# Live-reload dev server.
#   systemfd holds the TCP socket open across restarts (so the port doesn't
#   flap and in-flight requests aren't dropped).
#   watchexec watches the tree and restarts the child on .rs/.toml/.css/.js/.svg
#   changes — assets are embedded into the binary via rust-embed, so they
#   require a rebuild to take effect.
dev:
    @command -v systemfd >/dev/null || { echo "systemfd is required. Run 'just bootstrap-tools' or 'cargo install systemfd --locked'." >&2; exit 1; }
    @command -v watchexec >/dev/null || { echo "watchexec is required. Run 'just bootstrap-tools' or 'cargo install watchexec-cli --locked'." >&2; exit 1; }
    systemfd --no-pid -s http::{{port}} -- \
        watchexec --restart \
            --exts rs,toml,css,js,svg \
            --watch website/src \
            --watch website/assets \
            --watch Cargo.toml \
            --watch website/Cargo.toml \
            -- cargo run

# Standard build / check / format.
check:
    cargo fmt --all --check
    cargo build --release
