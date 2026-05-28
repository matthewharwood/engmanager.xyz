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
            --watch website/css/src \
            --watch website/js/src \
            --watch website/assets \
            --watch website/articles \
            --watch Cargo.toml \
            --watch website/Cargo.toml \
            -- cargo run -p website --features dev

# Standard build / check / format.
check:
    cargo fmt --all --check
    cargo build --release

# Use `just shop-caps --help` for prompt and slug examples.
# Regenerate shop cap assets from imagegen PNG sources.
shop-caps *args:
    ./scripts/regenerate-shop-caps.sh {{args}}

# Expose the local dev server to the public internet via Tailscale Funnel.
#
# Prereqs (one-time, in the Tailscale admin console):
#   - https://login.tailscale.com/admin/acls — grant `funnel` on this
#     device's tag (or `autogroup:member`):
#         "nodeAttrs": [{ "target": ["autogroup:member"], "attr": ["funnel"] }]
#   - https://login.tailscale.com/admin/dns — turn on HTTPS certificates.
#
# Runtime: assumes the dev server is already listening on $PORT (default
# 3000). Run `just dev` in another tab first. Funnel persists across
# dev-server restarts since it only proxies the port.
tunnel:
    @command -v tailscale >/dev/null || { echo "tailscale CLI not found. brew install tailscale (or grab the .pkg)." >&2; exit 1; }
    tailscale funnel --bg --https=443 http://127.0.0.1:{{port}}
    @echo
    @echo "Public URL:"
    @tailscale funnel status | grep -E '^https://' | head -1
    @echo

# Tear down both funnel + serve, returning the device to private.
untunnel:
    -tailscale funnel --https=443 off
    tailscale serve reset
    @echo "Tunnel down."
