# Website Feature And Plugin Audit

Research pass: 2026-05-27

Scope: engmanager.xyz as a custom Rust/Axum content, Web API, comments, search, and shop site. This is not a migration recommendation. The goal is to use mature plugin ecosystems as evidence for which feature shapes repeatedly create value, then translate the strongest ideas into this codebase.

## Definition Of Best

"Best" in this audit means genuine service value, not popularity. I scored each idea against:

- Visitor value: does it help a reader, buyer, or prospect do something meaningful?
- Brand fit: does it strengthen the "engineering manager / systems thinker" surface instead of adding generic SaaS furniture?
- Compounding value: does every article, product, or comment make it better?
- Implementation fit: can it be built cleanly in the current Rust/Axum stack without adopting a CMS?
- Maintenance cost: can it stay useful without becoming an admin burden?
- Differentiation: would it feel like a deliberate site capability, not a plugin pasted onto a blog?

## Current Site Baseline

Observed locally:

- Rust nightly, Axum, Tokio, `eng-markup`, embedded assets, Cloudflare/Render deployment notes in `README.md` and `_docs/ARCHITECTURE.md`.
- Public article system with typed categories/tags, article metadata tools, share/read-aloud/fullscreen/recolor affordances, sitemap link, manifest, PWA shell, and Web API receipt in `website/src/pages/articles.rs`.
- In-memory Tantivy article/comment search with typeahead, facets, date filtering, and comment indexing in `website/src/search.rs`.
- Comment API with visible comments indexed into search in `website/src/pages/comments.rs`.
- Shop catalog with product cards, deep links, carousel, cart drawer, webp product assets, and preview metadata in `website/src/pages/shop.rs`.
- Service worker with offline fallback and cache-first hashed assets in `website/js/src/sw.js`.
- Planned Cloudflare Images transformations in `_docs/ARCHITECTURE.md`.

Conclusion: the site already has the raw ingredients most CMS/plugin stacks add by default. The highest-value next work should connect those ingredients into discovery, trust, measurement, and conversion loops.

## Cross-Stack Feature Matrix

Cells name the closest plugin, framework feature, or common implementation pattern. "Custom" means the stack generally supports it, but it is not a single dominant native plugin.

| Generic feature/plugin | WordPress | Rails | Joomla | Nuxt | Next/Vercel | TanStack | Laravel | Hugo | Astro | Drupal | Ghost | Shopify |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Webmentions / backlink reactions | [Webmention](https://wordpress.org/plugins/webmention/) | Custom endpoint around W3C Webmention | Custom / extension-light | Nuxt server route + content | Route handler + metadata | Router/Start custom route | Custom package/service | Static inbound via Bridgy/Indiekit | Endpoint integration | IndieWeb-style contributed modules | No strong native inbound | Not a fit except product reviews/social proof |
| Faceted search + typeahead | [Relevanssi](https://wordpress.org/plugins/relevanssi/) | [Searchkick](https://github.com/ankane/searchkick) | Smart Search | Nuxt Content + Pagefind | Pagefind/Algolia + app router | Router search params + Query/Table | [Scout](https://laravel.com/docs/12.x/scout) | [Pagefind](https://pagefind.app/) | Pagefind/Starlight search | [Search API](https://www.drupal.org/project/search_api) + [Facets](https://www.drupal.org/project/facets) | Content API/search | Search & Discovery app |
| Related content / topic graph | Taxonomies + related posts plugins | Custom model/query layer | Categories/tags | Nuxt Content navigation | Metadata + server components | Router + Query | Scout/tags/custom | Taxonomies | Content collections | Taxonomy + Views | Tags + routes | Collections/recommendations |
| Structured metadata, sitemap, feeds, OG | [Yoast SEO](https://wordpress.org/plugins/wordpress-seo/) | Custom helpers | Native metadata + sitemap extensions | [Nuxt SEO](https://nuxtseo.com/) | [Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) | Custom head management | [Spatie Sitemap](https://spatie.be/docs/laravel-sitemap/v7/introduction) | RSS/sitemap templates | [Sitemap integration](https://docs.astro.build/en/guides/integrations-guide/sitemap/) | [Metatag](https://www.drupal.org/project/metatag) | Built-in SEO/newsletters | Product/collection structured data in themes |
| Responsive media pipeline | Core images + [Performance Lab](https://wordpress.org/plugins/performance-lab/) | [Active Storage](https://guides.rubyonrails.org/active_storage_overview.html) variants | Media manager/extensions | [Nuxt Image](https://image.nuxt.com/) | [next/image](https://nextjs.org/docs/app/building-your-application/optimizing/images) | Custom component/CDN | [Spatie Media Library](https://spatie.be/docs/laravel-medialibrary/v11/introduction) | [Image processing](https://gohugo.io/content-management/image-processing/) | [Astro images](https://docs.astro.build/en/guides/images/) | Responsive Image module | Built-in image sizes | Shopify image CDN |
| Privacy-first analytics + RUM | [Koko Analytics](https://wordpress.org/plugins/koko-analytics/) | [Ahoy](https://github.com/ankane/ahoy) | Matomo-style extensions | [Nuxt Scripts](https://scripts.nuxt.com/) + Plausible/Umami | [Vercel Web Analytics](https://vercel.com/docs/analytics/web-analytics) + [Speed Insights](https://vercel.com/docs/speed-insights) | Router events + custom beacons | Pulse/Telescope/custom | Plausible/Umami script | Integrations/custom island | Matomo/contrib modules | Native audience metrics | Customer events/pixels |
| Newsletter, membership, feeds | MailPoet/Newsletter plugins | Action Mailer/custom | AcyMailing-style extensions | Nuxt Content + forms | Server actions/forms + provider | Start server functions | Mail + Cashier for paid memberships | RSS + forms | Content collections + forms | [Webform](https://www.drupal.org/project/webform) | [Members/newsletters](https://ghost.org/help/members-introduction/) | Shopify Email/customer accounts |
| Comment moderation + spam trust | [Akismet](https://wordpress.org/plugins/akismet/) | Custom moderation + Action Text | Akeeba Engage/comment extensions | Custom db route | Custom route/server action | Custom | Validation/moderation packages | Giscus/Staticman | Giscus/custom | Core comments + spam modules | [Comments](https://ghost.org/help/commenting/) | Reviews apps |
| Product/catalog + checkout polish | [WooCommerce](https://wordpress.org/plugins/woocommerce/) | Solidus/Spree/custom | HikaShop | Shopify/composable commerce | Commerce starters/Shopify | Router + Query custom cart | [Cashier](https://laravel.com/docs/12.x/cashier) / commerce packages | Buy buttons/static cart | Commerce integrations | Drupal Commerce | Limited native commerce | Native core strength |
| Forms, surveys, lead intake | Gravity Forms/WPForms | Rails forms | RSForm/Convert Forms | Server routes/forms | Server actions/forms | Start server functions | Validation + mail/queue | Static form backends | Forms integrations | [Webform](https://www.drupal.org/project/webform) | Members/forms integrations | Forms/customer accounts |
| Content authoring QA | Editorial plugins | Action Text + validations | Workflows | Nuxt Content Studio/content lint | Draft mode/CMS preview | Custom | Filament/Nova/custom | Build-time checks | [Content collections](https://docs.astro.build/en/guides/content-collections/) | Editorial workflows | Strong editor | Theme preview |
| View transitions / richer navigation | Theme/plugin JS | Turbo | Template JS | Nuxt transitions | App router transitions | Router transitions | Inertia/Livewire | Static JS | [View Transitions](https://docs.astro.build/en/guides/view-transitions/) | Theme JS | Theme JS | Hydrogen/theme JS |
| PWA/offline/installable | PWA plugins | Service worker custom | PWA plugins | PWA module | next-pwa/custom SW | Custom | Custom SW | Static SW | Static SW | PWA module | Limited | Hydrogen/PWA patterns |

## Stack-Ranked Implementation Priorities

### 1. Topic Graph And Related Journeys

What to build: a "related system" that uses existing categories, tags, article dates, search snippets, and manual editorial overrides to create next-article modules, topic landing pages, and "reading paths." This should be custom, not a generic related-post plugin.

5x whys:

1. Why implement it? Readers often land on one article and need a credible next step.
2. Why does that matter? The site already has typed categories and tags, but those signals are mostly passive.
3. Why does that matter? Active routing keeps readers inside your strongest material instead of sending them back to search/social.
4. Why does that matter? Repeated exposure to your judgment builds more trust than one isolated post.
5. Why does that matter? The site becomes a consultative product surface, not just an archive.

Success metric: related-module click-through rate, second-page article rate, and topic landing page entrances.

Implementation sketch: add a small `related.rs` service over article metadata; score by category, tag overlap, recency, and manual pins; render related blocks on article pages and topic pages; expose the same graph to search results.

Risk: too much automation can feel random. Allow editorial overrides and keep the module explainable.

### 2. Structured Metadata Pack

What to build: first-party structured data for `Article`, `BreadcrumbList`, `WebSite` SearchAction, `Product`, `Offer`, and `Organization`; RSS and JSON Feed; richer Open Graph/Twitter previews; product-page canonical rules.

5x whys:

1. Why implement it? Search engines, feed readers, social previews, and commerce surfaces need machine-readable context.
2. Why does that matter? The site has strong content and product objects, but not all of that structure is externally visible.
3. Why does that matter? Better previews increase qualified clicks and reduce ambiguity before a user lands.
4. Why does that matter? Qualified visitors are more likely to read, share, comment, or buy.
5. Why does that matter? This compounds across every article and product with low ongoing maintenance.

Success metric: indexed rich result eligibility, preview correctness, feed subscribers, and search landing page CTR.

Implementation sketch: add typed Rust render helpers for JSON-LD and feed generation; test generated JSON with snapshots; emit product schema only where product pages are intended to be indexed.

Sources: Google Search Central documents [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article) and [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product); Next.js and Nuxt ecosystems model this via [Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) and [Nuxt SEO](https://nuxtseo.com/).

Risk: wrong product availability/pricing metadata is worse than no metadata. Tie schema to the same catalog source used by the UI.

### 3. Webmentions And Backlink Reaction Inbox

What to build: a Webmention receiver/sender plus moderation inbox. Display accepted mentions as backlinks, quotes, reposts, and external discussion under relevant articles.

5x whys:

1. Why implement it? Your comments already make article discussion first-party; Webmentions let outside conversations come home.
2. Why does that matter? Engineering writing often circulates in Slack, Mastodon, blogs, Hacker News, and personal sites.
3. Why does that matter? Durable backlinks provide social proof without surrendering the conversation to a social platform.
4. Why does that matter? Visible peer references increase reader trust and improve discovery paths.
5. Why does that matter? The site becomes part of the open web instead of a disconnected portfolio.

Success metric: accepted mentions per article, outbound mention sends, backlink click-through rate, spam rejection rate.

Implementation sketch: implement `/webmention` endpoint per the W3C flow; verify source pages link to target pages; queue mentions as pending; show approved mentions in the existing comments/search surface.

Sources: [W3C Webmention Recommendation](https://www.w3.org/TR/webmention/) and the WordPress [Webmention plugin](https://wordpress.org/plugins/webmention/) show the mature CMS version of the same capability.

Risk: spam and spoofing. Build moderation before public rendering.

### 4. Privacy-First Analytics Event Receipt

What to build: a tiny first-party analytics/event pipeline that tracks only useful product decisions: article read depth, related clicks, search queries with result clicks, comment starts/submits, share actions, product views, cart adds, and checkout intent. Show the data in an internal "site receipt" dashboard.

5x whys:

1. Why implement it? You need to know which features create value without using invasive analytics.
2. Why does that matter? Popular analytics dashboards optimize for pageviews, not service quality.
3. Why does that matter? Your site has high-intent interactions: search, comments, Web API tools, products, shares.
4. Why does that matter? Measuring those events tells you what to build next and what to delete.
5. Why does that matter? A privacy-respecting measurement loop improves the service without weakening user trust.

Success metric: event coverage, weekly actionable insights, and decisions made from the dashboard.

Implementation sketch: add a no-cookie POST endpoint for coarse events; reject PII; sample aggressively; aggregate daily; expose a private route or local report. Keep raw events short-lived.

Sources: WordPress has privacy-focused examples like [Koko Analytics](https://wordpress.org/plugins/koko-analytics/), Rails has [Ahoy](https://github.com/ankane/ahoy), and Vercel offers [Web Analytics](https://vercel.com/docs/analytics/web-analytics).

Risk: analytics scope creep. Write an event allowlist and retention policy before collecting.

### 5. Moderation, Spam, And Trust Workflow

What to build: a proper comment state machine: pending, visible, hidden, spam, author-trusted; with rate limits, honeypot fields, bad-link heuristics, and a simple moderation UI.

5x whys:

1. Why implement it? The site already accepts comments, and public write surfaces attract abuse over time.
2. Why does that matter? One spam wave can make a serious site look neglected.
3. Why does that matter? Trust is especially important on articles about leadership, engineering, and services.
4. Why does that matter? Good moderation lets you safely expand comments, Webmentions, forms, and product reviews.
5. Why does that matter? The interaction layer can grow without creating operational drag.

Success metric: spam caught before publish, moderation time per week, false positive rate, visible high-quality comments.

Implementation sketch: store status transitions, add author/IP throttle keys, require moderation for link-heavy comments, add admin-only endpoints, and index only visible records.

Sources: WordPress commonly solves this with [Akismet](https://wordpress.org/plugins/akismet/); Ghost has a native [comments](https://ghost.org/help/commenting/) model.

Risk: too much friction kills comments. Start with invisible checks and moderation queue, not forced accounts.

### 6. Responsive Image And Asset Pipeline

What to build: a first-party image manifest that records width, height, format, blur placeholder, alt text, and product/article ownership; emit `srcset`, `sizes`, lazy loading, and Cloudflare Images transformation URLs.

5x whys:

1. Why implement it? Images are now central to the shop and could become central to article previews.
2. Why does that matter? Heavy or incorrectly sized images slow first impressions and product browsing.
3. Why does that matter? Slow product and article pages reduce trust before users read anything.
4. Why does that matter? A media pipeline makes future visual work repeatable instead of one-off.
5. Why does that matter? Visual polish can improve conversion without changing the content strategy.

Success metric: lower image transfer size, improved LCP, no layout shift from images, fewer manual image mistakes.

Implementation sketch: generate an asset manifest at build time or via a script; add Rust helpers for responsive image markup; connect future Cloudflare Images transformations from the architecture plan.

Sources: [Cloudflare Images transformations](https://developers.cloudflare.com/images/transform-images/), [next/image](https://nextjs.org/docs/app/building-your-application/optimizing/images), [Nuxt Image](https://image.nuxt.com/), Rails [Active Storage](https://guides.rubyonrails.org/active_storage_overview.html), Laravel [Media Library](https://spatie.be/docs/laravel-medialibrary/v11/introduction), and Hugo [image processing](https://gohugo.io/content-management/image-processing/) all converge on this.

Risk: overbuilding a DAM. Keep it to the metadata needed to render fast, correct images.

### 7. Subscription Loop: RSS, Email, And Lightweight Membership

What to build: RSS/JSON Feed first, then optional email subscription for new articles and product drops. Add per-topic subscribe links once topic pages exist.

5x whys:

1. Why implement it? Returning readers are higher value than one-time visitors.
2. Why does that matter? The site has content, products, and service signals that benefit from repeated contact.
3. Why does that matter? Search/social discovery is unpredictable; owned distribution stabilizes attention.
4. Why does that matter? Stable attention gives better feedback on what people actually want.
5. Why does that matter? It creates a path from reader to subscriber to buyer or client.

Success metric: feed subscribers, email signups, returning reader rate, click-through from updates.

Implementation sketch: generate feeds from the article registry; expose topic feeds; start with an external email provider or a small double-opt-in table; do not gate content initially.

Sources: Hugo supports [RSS templates](https://gohugo.io/templates/rss/), Ghost centers [members and newsletters](https://ghost.org/help/members-introduction/), and Drupal often uses [Webform](https://www.drupal.org/project/webform) for collection flows.

Risk: newsletter systems become content operations. Start with feed correctness and only add email once publishing cadence supports it.

### 8. Shop Discovery, Product Schema, And Checkout Hardening

What to build: make product pages first-class if the shop is meant to be discoverable: indexable canonical product pages, Product/Offer schema, variant URLs, share images, abandoned-local-cart recovery, and a real checkout integration when ready.

5x whys:

1. Why implement it? The shop now has polished product images but limited commerce semantics.
2. Why does that matter? Buyers need confidence in price, availability, fit, and checkout path.
3. Why does that matter? Search and social platforms need product metadata to show accurate previews.
4. Why does that matter? Accurate previews create higher-intent product visits.
5. Why does that matter? Product trust directly affects conversion and protects the brand.

Success metric: product page entrances, add-to-cart rate, checkout starts, product preview correctness.

Implementation sketch: decide whether shop pages should be indexed; if yes, remove `noindex` for intended product routes, add Product JSON-LD, emit stable product OG images, persist local cart state, and integrate checkout with a provider.

Sources: WordPress [WooCommerce](https://wordpress.org/plugins/woocommerce/), Joomla HikaShop, Laravel [Cashier](https://laravel.com/docs/12.x/cashier), Shopify [Search and Discovery](https://help.shopify.com/en/manual/online-store/search-and-discovery), and Google [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product) frame this space.

Risk: incomplete checkout creates frustration. Keep "cart" clearly local until payment, tax, shipping, and inventory are real.

### 9. Content Authoring QA And Preview Checks

What to build: a pre-publish quality gate for articles: broken links, missing metadata, duplicate tags, image alt checks, reading-time sanity, spelling on common technical words, structured data snapshots, and local preview diffs.

5x whys:

1. Why implement it? The site is custom, so plugin guardrails need to become repo guardrails.
2. Why does that matter? Content bugs are easy to ship when articles live close to code.
3. Why does that matter? Broken links and missing metadata quietly degrade trust and discoverability.
4. Why does that matter? Automated checks preserve quality without relying on memory.
5. Why does that matter? It lets the site scale while still feeling hand-built.

Success metric: failed checks caught pre-merge, missing metadata count, broken-link count, authoring time.

Implementation sketch: add a `just content-check` command that validates article registry consistency, fetches internal links locally, checks external links optionally, and snapshots generated metadata.

Sources: Astro [Content Collections](https://docs.astro.build/en/guides/content-collections/) and Nuxt [Content](https://content.nuxt.com/) are good reference shapes for typed content.

Risk: slow checks get ignored. Split fast local checks from optional network checks.

### 10. Performance, Web Vitals, And Error Receipts

What to build: combine local lab checks with privacy-preserving production RUM: Core Web Vitals, JS error counts, asset cache misses, service-worker failures, and slow route warnings.

5x whys:

1. Why implement it? The site has increasingly rich JS interactions and product images.
2. Why does that matter? Regressions can hide behind a fast local machine.
3. Why does that matter? Performance failures reduce trust before visitors reach the content.
4. Why does that matter? Measured regressions are easier to prioritize than subjective polish.
5. Why does that matter? A small site can stay fast as features accumulate.

Success metric: p75 LCP/INP/CLS, JS error rate, cache hit rate, service-worker fallback count.

Implementation sketch: add web-vitals collection to the privacy event pipeline; run Lighthouse/PageSpeed in CI or a scheduled local command; surface deltas in the dashboard.

Sources: Vercel [Speed Insights](https://vercel.com/docs/speed-insights), WordPress [Performance Lab](https://wordpress.org/plugins/performance-lab/), and the existing Cloudflare architecture all support this pattern.

Risk: chasing scores over experience. Tie alerts to user-visible pages and workflows.

### 11. Smart Forms And Research Intake

What to build: focused forms for consulting/service inquiries, article feedback, product requests, and "ask me about this" prompts. Each form should route to a structured record, not a generic email dump.

5x whys:

1. Why implement it? A service site needs a clean path from interest to conversation.
2. Why does that matter? Current interactions are mostly reading, commenting, searching, and shopping.
3. Why does that matter? High-intent visitors may leave if the next step is unclear.
4. Why does that matter? Structured intake lets you qualify opportunities and spot recurring needs.
5. Why does that matter? Better intake improves service quality without adding public complexity.

Success metric: qualified inquiries, completion rate, spam rate, response time.

Implementation sketch: add small form schemas, validation, rate limits, moderation/review state, and optional email notifications. Reuse the same anti-spam layer as comments.

Sources: Drupal [Webform](https://www.drupal.org/project/webform), Next server actions/forms, Rails forms, Laravel validation, and Joomla form extensions show the common pattern.

Risk: generic lead forms feel cheap. Keep each form contextual and short.

### 12. PWA Deepening Only After The Above

What to build: improve offline article reading, saved articles, share target support, and install prompts only after discovery, metadata, analytics, and moderation are stronger.

5x whys:

1. Why implement it later? The site already has a service worker and offline shell.
2. Why does that matter? More PWA surface will not matter until users have stronger reasons to return.
3. Why does that matter? Discovery and subscription loops create those reasons first.
4. Why does that matter? PWA work is most valuable when it supports repeated workflows.
5. Why does that matter? Prioritizing it later avoids polishing a low-frequency path too early.

Success metric: repeat visits using saved/offline features, install rate, offline article opens.

Implementation sketch: cache selected articles, add a saved-reading list in local storage, and make offline states explicit. Keep it progressive.

Risk: install prompts can feel pushy. Only show them after meaningful engagement.

## Recommended First Build Slice

If implementing in one focused pass, build these together:

1. Related graph service and article modules.
2. Article/Product JSON-LD plus RSS/JSON Feed.
3. Privacy event endpoint for related-clicks, search-clicks, share-clicks, and product-view/add-cart.
4. Comment moderation status model so future Webmentions have a safe landing zone.

This set is small enough to ship in the current stack and it creates the measurement loop for everything after it.

## Explicit Non-Recommendations

- Do not adopt WordPress/Joomla/Drupal just to access plugins. The current Rust stack already owns the interaction layer.
- Do not add a generic chat widget unless there is a staffed response loop.
- Do not add accounts before there is a clear member-only workflow.
- Do not expand PWA/install prompts before subscriptions and return paths exist.
- Do not add broad analytics tags before defining a privacy budget and event allowlist.

## Source Notes

WordPress:
[Webmention](https://wordpress.org/plugins/webmention/),
[Relevanssi](https://wordpress.org/plugins/relevanssi/),
[Performance Lab](https://wordpress.org/plugins/performance-lab/),
[Koko Analytics](https://wordpress.org/plugins/koko-analytics/),
[Akismet](https://wordpress.org/plugins/akismet/),
[WooCommerce](https://wordpress.org/plugins/woocommerce/),
[Yoast SEO](https://wordpress.org/plugins/wordpress-seo/).

Rails:
[Active Storage guide](https://guides.rubyonrails.org/active_storage_overview.html),
[Action Text guide](https://guides.rubyonrails.org/action_text_overview.html),
[Searchkick](https://github.com/ankane/searchkick),
[Ahoy](https://github.com/ankane/ahoy).

Joomla:
[Smart Search documentation](https://guide.joomla.org/user-manual/smart-search),
[OSMap](https://extensions.joomla.org/extension/structure-a-navigation/site-map/osmap/),
[Akeeba Engage](https://extensions.joomla.org/extension/contacts-and-feedback/articles-comments/akeeba-engage/),
[HikaShop](https://extensions.joomla.org/extension/e-commerce/shopping-cart/hikashop/).

Nuxt:
[Nuxt Image](https://image.nuxt.com/),
[Nuxt SEO](https://nuxtseo.com/),
[Nuxt Content](https://content.nuxt.com/),
[Nuxt Scripts](https://scripts.nuxt.com/).

Next/Vercel:
[Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images),
[Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
[Vercel Web Analytics](https://vercel.com/docs/analytics/web-analytics),
[Vercel Speed Insights](https://vercel.com/docs/speed-insights).

TanStack:
[TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview),
[TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview),
[TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview),
[TanStack Table](https://tanstack.com/table/latest/docs/introduction).

Laravel:
[Laravel Scout](https://laravel.com/docs/12.x/scout),
[Laravel Cashier](https://laravel.com/docs/12.x/cashier),
[Spatie Media Library](https://spatie.be/docs/laravel-medialibrary/v11/introduction),
[Spatie Sitemap](https://spatie.be/docs/laravel-sitemap/v7/introduction).

Hugo and static search:
[Hugo image processing](https://gohugo.io/content-management/image-processing/),
[Hugo taxonomies](https://gohugo.io/content-management/taxonomies/),
[Hugo RSS templates](https://gohugo.io/templates/rss/),
[Pagefind](https://pagefind.app/).

Astro:
[Content collections](https://docs.astro.build/en/guides/content-collections/),
[View transitions](https://docs.astro.build/en/guides/view-transitions/),
[Images](https://docs.astro.build/en/guides/images/),
[Sitemap integration](https://docs.astro.build/en/guides/integrations-guide/sitemap/).

Drupal:
[Search API](https://www.drupal.org/project/search_api),
[Metatag](https://www.drupal.org/project/metatag),
[Webform](https://www.drupal.org/project/webform),
[Facets](https://www.drupal.org/project/facets).

Ghost and Shopify:
[Ghost members](https://ghost.org/help/members-introduction/),
[Ghost comments](https://ghost.org/help/commenting/),
[Shopify Search and Discovery](https://help.shopify.com/en/manual/online-store/search-and-discovery),
[Shopify customer events/pixels](https://shopify.dev/docs/apps/build/marketing-analytics/pixels),
[Shopify Hydrogen](https://shopify.dev/docs/storefronts/headless/hydrogen).

Cross-cutting standards and services:
[W3C Webmention](https://www.w3.org/TR/webmention/),
[Google Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article),
[Google Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product),
[Cloudflare Images transformations](https://developers.cloudflare.com/images/transform-images/),
[Plausible data policy](https://plausible.io/data-policy),
[Umami privacy docs](https://umami.is/docs/privacy).
