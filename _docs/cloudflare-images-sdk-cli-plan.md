# Cloudflare Images SDK/CLI Plan

## Summary

Update web.dev plan item 9 from "generate responsive image files" to a Cloudflare Images pipeline:

- Upload original images once to Cloudflare Images.
- Store non-secret image metadata in the repo.
- Render responsive `srcset`/`sizes` markup from Cloudflare transformation URLs.
- Keep explicit `width`, `height`, `aspect-ratio`, `loading`, `decoding`, and `fetchpriority` attributes in the site HTML.

This keeps the web.dev responsive-image goal while using the infrastructure already available on `engmanager.xyz`.

## Sources

- web.dev: serve responsive images with `srcset`, `sizes`, and explicit dimensions.
  https://web.dev/articles/serve-responsive-images
- Cloudflare: use HTML `srcset` with Cloudflare transformations; `format=auto` lets Cloudflare choose modern formats.
  https://developers.cloudflare.com/images/optimization/make-responsive-images/
- Cloudflare: transformation URLs use `/cdn-cgi/image/<OPTIONS>/<SOURCE-IMAGE>` for transformed source images.
  https://developers.cloudflare.com/images/optimization/features/
- Cloudflare: hosted Images API supports upload, update, delete, variants, and usage stats.
  https://developers.cloudflare.com/api/resources/images/
- Cloudflare: Direct Creator Upload creates one-time upload URLs for future browser/editor workflows.
  https://developers.cloudflare.com/images/storage/upload-images/direct-creator-upload/
- Cloudflare: flexible variants allow dynamic hosted-image options such as `w=400`.
  https://developers.cloudflare.com/images/optimization/hosted-images/enable-flexible-variants/

## Key Decision

Use Cloudflare Images as the source of truth for authored images.

Do not generate local resized image files in the repo. The repo should only track:

- the original source file when useful for editing or backup,
- a generated metadata manifest,
- Rust rendering helpers that produce Cloudflare responsive URLs.

## New Workspace Shape

Add a Rust SDK/CLI crate to the workspace:

```text
tools/cf-images/
  Cargo.toml
  src/
    lib.rs
    client.rs
    config.rs
    manifest.rs
    responsive.rs
    main.rs
```

Update root `Cargo.toml` workspace members:

```toml
members = ["website", "tools/cf-images"]
```

Add a `just` alias:

```just
images *args:
    cargo run -p cf-images -- {{args}}
```

## Configuration

Read credentials from environment variables:

```text
CF_ACCOUNT_ID
CF_IMAGES_API_TOKEN
CF_IMAGES_ACCOUNT_HASH
CF_IMAGES_DELIVERY_BASE=https://engmanager.xyz/cdn-cgi/imagedelivery
```

Never store API tokens in repo files.

Track public image metadata in:

```text
website/images.toml
```

Manifest shape:

```toml
[[image]]
key = "author-avatar"
cloudflare_id = "febf9573-0897-40b3-f687-a38a678b2300"
source = "website/assets/source/author-avatar.jpg"
alt = "Matthew Harwood"
width = 1024
height = 1024
role = "avatar"
sizes = "48px"
widths = [48, 96, 144]
fit = "cover"
loading = "eager"
fetchpriority = "high"

[[image]]
key = "auteurs-discord-qr"
cloudflare_id = "..."
source = "website/assets/source/auteurs-discord-qr.png"
alt = "Scan to join the Auteurs Discord"
width = 280
height = 280
role = "article-inline"
sizes = "(max-width: 640px) 70vw, 280px"
widths = [280, 560]
fit = "contain"
loading = "lazy"
fetchpriority = "auto"
```

## SDK API

Expose a small Rust SDK used by both the CLI and future site/build tooling:

```rust
pub struct CloudflareImagesClient {
    account_id: String,
    account_hash: String,
    api_token: String,
    delivery_base: String,
}

pub struct ImageUpload {
    pub key: String,
    pub path: PathBuf,
    pub id: Option<String>,
    pub metadata: BTreeMap<String, String>,
    pub require_signed_urls: bool,
}

pub struct ResponsiveImage {
    pub key: String,
    pub cloudflare_id: String,
    pub alt: String,
    pub width: u32,
    pub height: u32,
    pub widths: Vec<u32>,
    pub sizes: String,
    pub fit: ImageFit,
    pub loading: Loading,
    pub fetchpriority: FetchPriority,
}
```

Required SDK methods:

- `upload_file(ImageUpload) -> UploadedImage`
- `upload_url(key, source_url, metadata) -> UploadedImage`
- `get_image(id) -> CloudflareImage`
- `delete_image(id)`
- `create_direct_upload(metadata) -> DirectUpload`
- `delivery_url(id, variant_or_options) -> String`
- `srcset(image: &ResponsiveImage) -> String`
- `img_attrs(image: &ResponsiveImage) -> RenderedImageAttrs`

## CLI Commands

MVP commands:

```bash
just images upload website/assets/source/author-avatar.jpg \
  --key author-avatar \
  --id author-avatar \
  --role avatar \
  --alt "Matthew Harwood" \
  --width 1024 \
  --height 1024
```

```bash
just images sync website/assets/source --manifest website/images.toml
```

```bash
just images render author-avatar
```

```bash
just images check
```

Command behavior:

- `upload`: uploads one local file through `POST /accounts/{account_id}/images/v1`.
- `sync`: uploads new source files and updates existing manifest entries.
- `render`: prints the exact `<img>` markup for Markdown/raw HTML use.
- `check`: validates manifest entries, required dimensions, duplicate keys, and reachable Cloudflare delivery URLs.
- `direct-upload`: creates a one-time upload URL for future browser/editor flows, but is not used by the static article workflow in v1.

## Responsive URL Rules

Hosted Cloudflare Images should render with flexible variant options when enabled:

```text
https://engmanager.xyz/cdn-cgi/imagedelivery/{account_hash}/{image_id}/w={width},fit={fit},format=auto
```

For source images that remain on the origin, use Cloudflare transformation URLs:

```text
/cdn-cgi/image/width={width},fit={fit},format=auto/{origin_path}
```

Default to explicit `srcset` widths because Cloudflare documents that HTML `srcset` is the most reliable responsive-image approach. Do not make `width=auto` the default because Cloudflare currently limits that path to Chromium-based browsers.

## Website Integration

Add `website/src/images.rs`:

- Embed `website/images.toml` at compile time.
- Expose `image("author-avatar") -> ResponsiveImage`.
- Expose `render_img(key, class_name) -> HtmlFragment`.
- Preserve existing direct constants only as compatibility wrappers.

Replace current hardcoded image markup:

- `AVATAR_SRC` becomes an image manifest lookup.
- Homepage avatar uses responsive fixed-size `srcset` with `sizes="48px"`.
- Article meta avatar uses responsive fixed-size `srcset` with `sizes="40px"`.
- `auteurs` QR image becomes manifest-backed or gets generated raw HTML from `just images render auteurs-discord-qr`.

Every rendered image must include:

- `src`
- `srcset`
- `sizes`
- `alt`
- `width`
- `height`
- `loading`
- `decoding="async"`
- `fetchpriority` when meaningful
- stable CSS `aspect-ratio`

## Quality Defaults

Role presets:

```text
avatar: widths 40,48,80,96,120,144; fit cover; quality 85; eager only when above the fold
article-inline: widths 320,480,640,960,1280; fit contain; quality 85; lazy
article-hero: widths 640,960,1280,1600; fit cover; quality 85; high fetchpriority only when LCP
opengraph: width 1200; height 630; fit cover
qr: widths 280,560; fit contain; quality 100; lazy
```

Use `format=auto` by default so Cloudflare can serve modern formats where supported.

## Testing

SDK tests:

- Mock Cloudflare API upload success and failure responses.
- Validate multipart upload fields, metadata, and optional custom ID.
- Validate `srcset` generation order and URL escaping.
- Validate manifest duplicate-key and missing-dimension errors.

CLI tests:

- `--dry-run` performs no upload and prints intended manifest changes.
- `render <key>` prints stable HTML.
- `check` fails on missing source files, invalid dimensions, or duplicate keys.

Website tests:

- `cargo test -p website` confirms image manifest loads.
- Rendered homepage and article HTML include `srcset`, `sizes`, `width`, `height`, and `decoding`.
- No article image uses `loading="lazy"` when it is configured as the LCP candidate.

Manual verification:

- Cloudflare delivery URL returns 200.
- Chrome Network panel shows an appropriately sized transformed image.
- Lighthouse no longer reports "Properly size images" for avatar or article images.

## Rollout

1. Add SDK/CLI crate, manifest parser, and dry-run upload flow.
2. Upload the current author avatar and QR image through the CLI.
3. Commit `website/images.toml` with Cloudflare IDs and dimensions.
4. Add website rendering helpers and migrate avatar markup.
5. Migrate article raw images, starting with the Auteurs QR code.
6. Add `just images check` to the normal preflight path.
7. Later: add browser/editor Direct Creator Upload using Cloudflare one-time upload URLs.

## Acceptance Criteria

- A new image can be uploaded with one command.
- The command records Cloudflare ID, dimensions, alt text, role, sizes, and responsive widths.
- The site renders Cloudflare-backed `srcset`/`sizes` images without hand-writing URLs.
- All image markup reserves layout space and avoids CLS.
- No Cloudflare secret is committed.
