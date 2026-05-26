# Runbook: `shop.engmanager.xyz`

This runbook covers how to put `shop.engmanager.xyz` behind the current
Render + Cloudflare setup, how Render MCP fits in, and how to add Cloudflare
edge caching without accidentally caching cart, checkout, account, or API
responses.

## Current State

- The site is one Rust/Axum web service.
- `shop.engmanager.xyz/` is routed by the `Host` header to a static
  "Hello world" shop index page in the same Rust service.
- The shop index emits:
  `Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800`.
- Production runs on Render with `PORT` set by Render, so the binary binds
  `0.0.0.0:$PORT`.
- Cloudflare is the DNS/proxy layer for `engmanager.xyz`.
- `scripts/cloudflare-bootstrap.sh` creates proxied CNAMEs for:
  - `engmanager.xyz -> engmanager-xyz.onrender.com`
  - `www.engmanager.xyz -> engmanager-xyz.onrender.com`
  - `shop.engmanager.xyz -> engmanager-xyz.onrender.com`
- The Cloudflare cache rules are:
  - Apex HTML cache: `engmanager.xyz` at `/` plus `/articles*`
  - Shop full-host cache: `shop.engmanager.xyz`
- The Rust app already emits cache-friendly HTML headers through
  `HTML_CACHE_CONTROL`:
  `public, max-age=60, s-maxage=3600, stale-while-revalidate=86400`.

## One-Command API Setup

After deploying the code, run the Render and Cloudflare API scripts from the
repo root:

```bash
RENDER_API_KEY=... RENDER_SERVICE_ID=srv_... ./scripts/render-shop-domain.sh
CF_API_TOKEN=... ./scripts/cloudflare-bootstrap.sh
```

The Render script attaches `shop.engmanager.xyz` to the existing service. The
Cloudflare script upserts the proxied CNAME and both cache rules.

## Decision Point

Choose one path before creating DNS:

1. Same Render service, host-aware Rust routes.
   Use this if shop is a small catalog or static shop experience inside the
   existing Rust app.

2. Separate Render service.
   Use this if shop has its own app, runtime, release cadence, or datastore.

3. Third-party commerce platform.
   Use this if checkout/cart/account are handled by Shopify, Stripe-hosted
   payment links, Lemon Squeezy, etc. In that case, point `shop` at that
   provider's required CNAME target, not at Render.

For real commerce, prefer option 2 or 3. Do not edge-cache personalized shop
HTML, checkout, account, auth, or cart pages.

## Render MCP

Yes, Render has an official hosted MCP server:

```txt
https://mcp.render.com/mcp
```

For Codex, Render's docs show this local config in `~/.codex/config.toml`:

```toml
[mcp_servers.render]
url = "https://mcp.render.com/mcp"
http_headers = { Authorization = "Bearer <YOUR_RENDER_API_KEY>" }
```

Important notes:

- Keep the API key out of the repo.
- Render API keys are broadly scoped to resources your account can access.
- The MCP is useful for listing services, inspecting logs/metrics, and some
  service creation tasks.
- As of the current Render docs, the MCP does not replace all custom-domain
  work. Use the Render Dashboard or REST API for adding/verifying
  `shop.engmanager.xyz` if the MCP tool list does not expose custom-domain
  operations.

## Path A: Same Render Service

Use this if `shop.engmanager.xyz` should hit the existing
`engmanager-xyz.onrender.com` service.

### 1. Add the Custom Domain in Render

Dashboard:

1. Open the existing `engmanager-xyz` web service.
2. Go to `Settings -> Custom Domains`.
3. Add:

```txt
shop.engmanager.xyz
```

REST API equivalent:

```bash
export RENDER_API_KEY="..."
export RENDER_SERVICE_ID="srv_..."

curl -fsS -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"shop.engmanager.xyz"}' \
  "https://api.render.com/v1/services/$RENDER_SERVICE_ID/custom-domains"
```

Render will issue/renew TLS for the custom domain after DNS verifies.

### 2. Add Cloudflare DNS

Dashboard:

1. Cloudflare -> `engmanager.xyz` zone -> `DNS -> Records`.
2. Add record:

```txt
Type: CNAME
Name: shop
Target: engmanager-xyz.onrender.com
Proxy status: Proxied
TTL: Auto
```

API:

```bash
export CF_API_TOKEN="..."
export CF_ZONE_ID="..."
export RENDER_HOSTNAME="engmanager-xyz.onrender.com"

curl -fsS -X POST \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc \
    --arg name "shop.engmanager.xyz" \
    --arg target "$RENDER_HOSTNAME" \
    '{type:"CNAME", name:$name, content:$target, ttl:1, proxied:true}')" \
  "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records"
```

The existing `scripts/cloudflare-bootstrap.sh` could also be extended with:

```bash
upsert_cname "shop.$ZONE_NAME" "$RENDER_HOSTNAME" true
```

### 3. Add Host-Aware Routing in Rust

Right now the Axum router is path-only. If `shop.engmanager.xyz/` points at
the existing service before host-aware routing exists, it will render the
normal homepage.

Sketch:

```rust
use axum::extract::Host;
use axum::response::{IntoResponse, Response};

async fn root(Host(host): Host) -> Response {
    let host = host.split(':').next().unwrap_or(&host);
    if host == "shop.engmanager.xyz" {
        return pages::shop::index().await.into_response();
    }
    pages::homepage::index().await.into_response()
}
```

Then wire:

```rust
.route("/", get(root))
```

You will also want explicit shop routes, for example:

```rust
.route("/products/", get(pages::shop::products))
.route("/products/{slug}", get(pages::shop::product_detail))
```

### 4. Update SEO Surfaces

If shop is indexable:

- Add `https://shop.engmanager.xyz/` and shop product URLs to a sitemap.
- Add canonical links on shop pages using the `shop` host.
- Keep main-site canonical links on `engmanager.xyz`.

If shop is not ready:

- Add `noindex,nofollow` to shop pages until launch.
- Do not include shop URLs in the sitemap.

## Path B: Separate Render Service

Use this if shop should be a different app.

1. Create a new Render web service, e.g. `engmanager-shop`.
2. Give it its own build/start commands.
3. Add `shop.engmanager.xyz` as a custom domain to that service.
4. In Cloudflare, set:

```txt
Type: CNAME
Name: shop
Target: <new-shop-service>.onrender.com
Proxy status: Proxied
TTL: Auto
```

This avoids host-routing complexity in the existing binary.

## Path C: Third-Party Shop

Use the provider's exact DNS instructions. Examples:

- Shopify usually provides a CNAME target.
- Stripe Payment Links may not need a whole subdomain.
- A hosted storefront may need TXT verification records.

Do not point `shop.engmanager.xyz` to Render if a third-party provider owns
the storefront.

## Cloudflare Dynamic Edge Caching

Yes, you need Cloudflare configuration if you want dynamic HTML cached at the
edge. DNS proxying alone is not enough. Cloudflare will cache normal static
assets easily, but HTML/dynamic pages need an explicit Cache Rule.

### Safe Default

For a shop, start conservative:

- Cache static assets normally.
- Cache static/catalog HTML only.
- Do not cache cart, checkout, account, auth, API, webhook, or admin paths.
- Do not cache any response that sets personalized cookies or contains
  user-specific data.

### Recommended Shop Cache Rules

Create two rules in this order.

#### Rule 1: Bypass Shop Dynamic Paths

Expression:

```txt
(http.host eq "shop.engmanager.xyz" and (
  starts_with(http.request.uri.path, "/cart") or
  starts_with(http.request.uri.path, "/checkout") or
  starts_with(http.request.uri.path, "/account") or
  starts_with(http.request.uri.path, "/auth") or
  starts_with(http.request.uri.path, "/api") or
  starts_with(http.request.uri.path, "/admin") or
  starts_with(http.request.uri.path, "/webhooks")
))
```

Action:

```json
{
  "cache": false
}
```

#### Rule 2: Cache Shop Public HTML

Expression:

```txt
(http.host eq "shop.engmanager.xyz" and
 http.request.method in {"GET" "HEAD"} and
 (http.request.uri.path eq "/" or
  starts_with(http.request.uri.path, "/products") or
  starts_with(http.request.uri.path, "/collections")))
```

Action parameters:

```json
{
  "cache": true,
  "edge_ttl": { "mode": "respect_origin" },
  "browser_ttl": { "mode": "respect_origin" }
}
```

This pairs with the app's existing HTML header:

```txt
Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=86400
```

If shop catalog pages need a different TTL, add a separate Rust header layer
or route wrapper for shop pages rather than hard-coding Cloudflare to ignore
origin headers.

### Cloudflare API Pattern

Cloudflare Cache Rules are managed through the Rulesets API in the
`http_request_cache_settings` phase.

The existing bootstrap script already does the right high-level thing:

1. Fetch the zone.
2. Upsert DNS.
3. Fetch/create the `http_request_cache_settings` entrypoint ruleset.
4. Put a rule with action `set_cache_settings`.

For shop, either extend `scripts/cloudflare-bootstrap.sh` or create a separate
script. Keep the shop rules separate from the existing apex rule so you can
disable shop caching without affecting the blog.

## Verification

### DNS

```bash
dig +short shop.engmanager.xyz
```

With Cloudflare proxying enabled, this should resolve to Cloudflare IPs, not
directly to Render.

### Render Domain Verification

In the Render dashboard, `shop.engmanager.xyz` should show verified and TLS
issued. You can also sanity check:

```bash
curl -sI https://shop.engmanager.xyz/ | sed -n '1,20p'
```

Expected:

- `HTTP/2 200` or a deliberate redirect.
- Valid TLS in the browser.
- No Render custom-domain warning page.

### Cache HIT Test

Run twice:

```bash
curl -sI https://shop.engmanager.xyz/ \
  | grep -iE 'cf-cache-status|cache-control|age|server|location'

curl -sI https://shop.engmanager.xyz/ \
  | grep -iE 'cf-cache-status|cache-control|age|server|location'
```

Expected for cacheable shop catalog/home pages:

- First request: often `CF-Cache-Status: MISS` or `EXPIRED`.
- Second request: `CF-Cache-Status: HIT`.
- `Age` should appear/increase on HIT.
- `Cache-Control` should match the origin policy.

### Bypass Test

```bash
curl -sI https://shop.engmanager.xyz/cart \
  | grep -iE 'cf-cache-status|cache-control|set-cookie|age'
```

Expected:

- Not `HIT`.
- Ideally `BYPASS` or `DYNAMIC`.
- No shared-cache behavior for personalized pages.

### Three Common Failure Modes

1. Render says domain is not verified.
   Check that the Cloudflare CNAME name is `shop`, target is the exact Render
   hostname, and the custom domain was added to the correct Render service.

2. Cloudflare shows `DYNAMIC` for public shop HTML.
   DNS proxy might be off, the cache rule expression might not match the
   hostname/path, or the origin response might be uncacheable.

3. Cart or checkout shows `HIT`.
   Immediately disable the shop cache rule or add a higher-priority bypass
   rule, then purge affected URLs.

## Purging

For targeted purges:

```bash
CF_API_TOKEN=... CF_ZONE_ID=... \
  ./scripts/purge-cache.sh \
  https://shop.engmanager.xyz/ \
  https://shop.engmanager.xyz/products/
```

For emergency purge:

```bash
CF_API_TOKEN=... CF_ZONE_ID=... ./scripts/purge-cache.sh
```

That purges the whole Cloudflare zone.

## Recommendation for This Repo

For a first pass, use the same Render service only if the shop is a static
catalog or a landing page. Add host-aware routing in Rust and cache only:

- `https://shop.engmanager.xyz/`
- `https://shop.engmanager.xyz/products*`
- `https://shop.engmanager.xyz/collections*`

If the shop includes real checkout, accounts, inventory state, or admin
surfaces, create a separate Render service or use a commerce provider and keep
Cloudflare HTML caching conservative.

## References

- Render MCP Server:
  <https://render.com/docs/mcp-server>
- Render Custom Domains:
  <https://render.com/docs/custom-domains>
- Render REST API: Add custom domain:
  <https://api-docs.render.com/reference/create-custom-domain>
- Cloudflare DNS record types:
  <https://developers.cloudflare.com/dns/manage-dns-records/reference/dns-record-types/>
- Cloudflare Cache Rules via API:
  <https://developers.cloudflare.com/cache/how-to/cache-rules/create-api/>
