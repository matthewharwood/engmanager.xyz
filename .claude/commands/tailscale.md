---
allowed-tools: Bash(tailscale:*), Bash(lsof:*), Bash(cargo:*), Bash(curl:*), Bash(xargs kill -9), Bash(sleep:*), Bash(until:*), Bash(grep:*), Bash(echo:*)
description: Start the dev server (if needed) and expose it publicly via Tailscale Funnel
---

# Tailscale

Bring the local site up at a public `*.ts.net` URL so I can preview from my phone or share with someone. One step, no thinking.

## Current state

Dev server on port 3000:
!`lsof -ti:3000 2>/dev/null && echo "(running)" || echo "(not running)"`

Tailscale funnel status:
!`tailscale funnel status 2>&1 | head -8 || true`

## Action

1. **If port 3000 is empty**, start the dev server in the background:
   ```bash
   cargo run -p website
   ```
   Run via the Bash tool with `run_in_background: true`. Then wait for `/health` to return 200 with:
   ```bash
   until curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>/dev/null | grep -q 200; do sleep 1; done
   ```

2. **Enable funnel** pointing at port 3000:
   ```bash
   tailscale funnel --bg --https=443 http://127.0.0.1:3000
   ```
   Idempotent — re-running it is fine.

3. **Confirm + report**. Curl the public URL once to warm it (first hit can take ~10s for TLS cert provisioning):
   ```bash
   curl -sS -o /dev/null -w "%{http_code} in %{time_total}s\n" -m 30 https://laptop.tail24d353.ts.net/
   ```
   Then print the public URL to the user in a single short line: `Live at https://laptop.tail24d353.ts.net/`.

4. **Mention the off-switch** in one sentence: `just untunnel` (or `tailscale funnel --https=443 off`) when done sharing. Don't expand on it.

Keep the response under five lines total. The user wants the URL, not a status report.
