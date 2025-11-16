# Architecture

## Internet & Traffic

```mermaid
sequenceDiagram
    actor User
    participant CF as Cloudflare CDN<br/>(Edge Cache)
    participant Render as Render.com<br/>(Axum Server)
    participant Images as Cloudflare Images<br/>(w/ Transformations)

    %% Homepage Request - Cache Miss
    User->>CF: GET engmanager.xyz
    CF->>CF: Check edge cache
    Note over CF: Cache MISS
    CF->>Render: Forward request
    Render->>Render: Generate HTML response
    Render-->>CF: 200 OK (HTML)
    CF->>CF: Cache at edge
    CF-->>User: 200 OK (HTML)

    %% Homepage Request - Cache Hit
    User->>CF: GET engmanager.xyz
    CF->>CF: Check edge cache
    Note over CF: Cache HIT
    CF-->>User: 200 OK (HTML)<br/>(served from edge)

    %% Health Check (uncached)
    User->>CF: GET /health
    CF->>Render: Forward request
    Render-->>CF: 200 OK
    CF-->>User: 200 OK

    %% Future: Image with transformations
    Note over User,Images: Future: Optimized Images
    User->>CF: GET /img/logo.png?w=300
    CF->>Images: Request transformed image
    Images->>Images: Resize, optimize, cache
    Images-->>CF: Optimized image
    CF-->>User: Optimized image<br/>(cached at edge)
```

### Traffic Flow Details

**Current Setup:**
- **Cloudflare CDN** acts as reverse proxy in front of Render.com
- **Homepage caching**: HTML responses cached at Cloudflare edge nodes globally
- **Origin**: Axum server on Render.com serves all dynamic content
- **SSL/TLS**: Full (strict) encryption end-to-end

**Planned Enhancements:**
- **Cloudflare Images**: Host and transform images with automatic optimization
- **Image transformations**: Resize, format conversion, quality optimization on-the-fly
- **Edge caching**: All static assets served from CF edge (sub-10ms globally)
