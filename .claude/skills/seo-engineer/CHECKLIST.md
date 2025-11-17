# SEO Audit & Quality Gate Checklists

Comprehensive checklists for SEO audits, quality gates, and ongoing monitoring.

## Pre-Deployment Quality Gate

### Technical SEO (MUST PASS)

- [ ] robots.txt accessible at /robots.txt and valid
- [ ] XML sitemap present and referenced in robots.txt
- [ ] All pages have canonical tags
- [ ] Hreflang tags valid (if international site)
- [ ] Zero server errors (500, 503)
- [ ] Zero 404 errors on linked pages
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Valid SSL certificate (not expired)
- [ ] No mixed content warnings
- [ ] Proper redirect chains (max 1 redirect per URL)

### On-Page Optimization (MUST PASS)

- [ ] Every page has unique title tag (50-60 characters)
- [ ] Every page has unique meta description (150-160 characters)
- [ ] Every page has exactly one H1 tag
- [ ] All images have descriptive alt text
- [ ] Internal links use descriptive anchor text (no "click here")
- [ ] No broken internal links
- [ ] Breadcrumbs implemented on all pages (except homepage)
- [ ] No orphaned pages (every page has incoming internal link)

### Performance & UX (MUST PASS)

- [ ] Lighthouse Performance score > 85
- [ ] Lighthouse SEO score > 95
- [ ] Mobile-friendly test passing (Google's tool)
- [ ] Core Web Vitals in "Good" range (75th percentile):
  - [ ] LCP < 2.5 seconds
  - [ ] INP < 200 milliseconds
  - [ ] CLS < 0.1
- [ ] Page weight < 1.5MB (compressed)
- [ ] JavaScript bundle < 300KB (compressed)
- [ ] Images optimized (WebP format, responsive srcset)

### Structured Data (MUST PASS if applicable)

- [ ] JSON-LD validates in Google's Rich Results Test
- [ ] No structured data errors
- [ ] Required properties present for all schema types
- [ ] Schema matches actual page content
- [ ] Images in schema meet requirements (1200x675+ pixels)
- [ ] Dates in ISO 8601 format

### Content Quality (SHOULD PASS)

- [ ] No thin content (pages < 300 words need justification)
- [ ] No duplicate content (check with Copyscape or Siteliner)
- [ ] Readability score appropriate for audience (Flesch 60-70)
- [ ] Keyword optimization balanced (1-2% density)
- [ ] Author information present (for E-E-A-T)
- [ ] Publish/update dates visible
- [ ] Clear value proposition above the fold

---

## Comprehensive SEO Audit

### 1. Crawlability & Indexability

- [ ] robots.txt properly configured
  - [ ] Allows important pages
  - [ ] Blocks admin/private areas
  - [ ] Blocks duplicate content URLs
  - [ ] References XML sitemap
- [ ] XML sitemap complete and valid
  - [ ] Contains all important pages
  - [ ] Accurate lastmod dates
  - [ ] Proper priority values
  - [ ] Under 50MB / 50,000 URLs per sitemap
- [ ] No crawl errors in Search Console
- [ ] Proper use of meta robots tags
- [ ] JavaScript rendering working correctly
- [ ] Pagination implemented correctly (rel="next"/rel="prev" or canonical)
- [ ] Infinite scroll SEO-friendly (or avoided)

### 2. Site Architecture

- [ ] Logical URL structure (max 3-4 levels deep)
- [ ] Descriptive, keyword-rich URLs
- [ ] No dynamic parameters in URLs (or properly canonicalized)
- [ ] Consistent URL format (trailing slash or not)
- [ ] Proper subdomain/subfolder structure
- [ ] Logical site hierarchy
- [ ] No more than 3-4 clicks from homepage to any page
- [ ] HTML sitemap for users (if site > 100 pages)

### 3. Mobile Optimization

- [ ] Responsive design (Google's recommended approach)
- [ ] Mobile-friendly test passing
- [ ] Touch elements properly sized (48x48 CSS pixels minimum)
- [ ] Text readable without zooming (16px minimum)
- [ ] No horizontal scrolling
- [ ] Adequate spacing between interactive elements
- [ ] Fast mobile load times (LCP < 2.5s on 3G)
- [ ] No mobile-specific errors in Search Console

### 4. Page Speed & Core Web Vitals

- [ ] LCP < 2.5 seconds (target < 2.0s)
- [ ] INP < 200 milliseconds (target < 150ms)
- [ ] CLS < 0.1 (target < 0.05)
- [ ] First Contentful Paint < 1.8s
- [ ] Time to Interactive < 3.8s
- [ ] Images optimized:
  - [ ] WebP format
  - [ ] Responsive srcset
  - [ ] Lazy loading below fold
  - [ ] Proper dimensions specified
- [ ] CSS optimized:
  - [ ] Critical CSS inlined
  - [ ] Non-critical CSS deferred
  - [ ] Minified
- [ ] JavaScript optimized:
  - [ ] Code splitting
  - [ ] Minified and compressed
  - [ ] Defer/async loading
  - [ ] No render-blocking scripts

### 5. On-Page SEO Elements

- [ ] Title tags:
  - [ ] Unique on every page
  - [ ] 50-60 characters
  - [ ] Primary keyword included (front-loaded)
  - [ ] Compelling and clickable
- [ ] Meta descriptions:
  - [ ] Unique on every page
  - [ ] 150-160 characters
  - [ ] Include call-to-action
  - [ ] Accurately describe content
- [ ] Headings:
  - [ ] One H1 per page
  - [ ] Logical hierarchy (H1→H2→H3)
  - [ ] Include target keywords naturally
- [ ] Content:
  - [ ] High quality and original
  - [ ] Minimum 300 words (more for competitive keywords)
  - [ ] Properly formatted (headings, lists, paragraphs)
  - [ ] Internal links to related content
  - [ ] Answers user intent
- [ ] Images:
  - [ ] Descriptive alt text (10-125 characters)
  - [ ] Descriptive file names
  - [ ] Optimized file size
  - [ ] Proper format (WebP preferred)

### 6. Structured Data

- [ ] Appropriate schema types implemented
- [ ] Organization schema on homepage
- [ ] WebSite schema with SearchAction
- [ ] BreadcrumbList on all pages
- [ ] Article schema on blog posts
- [ ] Product schema on product pages
- [ ] LocalBusiness schema (if applicable)
- [ ] All schema validates without errors
- [ ] Rich results appearing in SERPs

### 7. Internal Linking

- [ ] Descriptive anchor text
- [ ] Links to important pages from homepage
- [ ] Topic clusters linking properly
- [ ] No orphaned pages
- [ ] Breadcrumbs on all pages
- [ ] Related content sections
- [ ] Footer navigation to important pages
- [ ] Reasonable link depth (max 3-4 clicks)
- [ ] No excessive links per page (keep under 150)

### 8. Content Quality & E-E-A-T

- [ ] Demonstrates Experience (first-hand knowledge)
- [ ] Shows Expertise (depth of knowledge)
- [ ] Establishes Authoritativeness (industry recognition)
- [ ] Builds Trustworthiness (accuracy, sources, security)
- [ ] Author bios with credentials
- [ ] Publish and update dates visible
- [ ] Sources cited for claims
- [ ] Contact information easily accessible
- [ ] Clear privacy policy and terms
- [ ] About page with company info

### 9. Security

- [ ] HTTPS on all pages
- [ ] Valid SSL certificate
- [ ] No mixed content
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header implemented
- [ ] Secure cookies
- [ ] No malware or security issues
- [ ] Safe Browsing status clean

### 10. International SEO (if applicable)

- [ ] Proper hreflang implementation
- [ ] Correct language/region codes
- [ ] Bidirectional hreflang tags
- [ ] Self-referential hreflang
- [ ] x-default tag for fallback
- [ ] Appropriate domain structure (ccTLD/subdomain/subfolder)
- [ ] Localized content (not just translated)
- [ ] Local currency and measurements

---

## Monthly Monitoring Checklist

### Performance Monitoring

- [ ] Review Search Console Performance report
- [ ] Track keyword rankings (top 50-100 keywords)
- [ ] Monitor organic traffic trends
- [ ] Check Core Web Vitals status
- [ ] Review page speed metrics
- [ ] Track conversion rates from organic

### Technical Health

- [ ] Check Search Console Coverage report
- [ ] Review and fix any crawl errors
- [ ] Monitor indexing status
- [ ] Check for manual actions
- [ ] Review security issues
- [ ] Verify mobile usability

### Content Performance

- [ ] Identify top-performing pages
- [ ] Identify declining pages
- [ ] Update outdated content
- [ ] Check for duplicate content
- [ ] Review thin content pages
- [ ] Audit content gaps

### Backlink Profile

- [ ] Review new backlinks
- [ ] Check for lost backlinks
- [ ] Monitor referring domains
- [ ] Assess backlink quality
- [ ] Disavow toxic links (if needed)
- [ ] Track competitor backlinks

### Competitive Analysis

- [ ] Track competitor rankings
- [ ] Review competitor content
- [ ] Analyze SERP features
- [ ] Identify new opportunities
- [ ] Monitor competitor backlinks

---

## Quarterly SEO Tasks

### Content Refresh

- [ ] Audit all content (traffic, rankings, quality)
- [ ] Update high-traffic pages with new information
- [ ] Consolidate or remove thin content
- [ ] Add internal links to new content
- [ ] Refresh meta tags on key pages
- [ ] Update images and media

### Technical Audit

- [ ] Run full site crawl (Screaming Frog, Sitebulb)
- [ ] Check for broken links
- [ ] Review redirect chains
- [ ] Audit XML sitemap
- [ ] Test structured data
- [ ] Review robots.txt

### Strategy Review

- [ ] Analyze keyword opportunities
- [ ] Review content strategy
- [ ] Assess link building progress
- [ ] Evaluate Core Web Vitals trends
- [ ] Review conversion funnel
- [ ] Update SEO documentation

---

## Post-Algorithm Update Checklist

### Immediate Actions (0-7 days)

- [ ] Check Search Console for traffic changes
- [ ] Review rankings for target keywords
- [ ] Compare to historical baseline
- [ ] Confirm update is rolled out (check SEO news)
- [ ] Identify which pages were affected
- [ ] Analyze patterns (content type, quality, topic)

### Analysis (7-14 days)

- [ ] Review competitor changes
- [ ] Identify common factors in affected pages
- [ ] Check for technical issues
- [ ] Review backlink changes
- [ ] Analyze SERP feature changes
- [ ] Assess content quality issues

### Recovery Actions (14+ days)

- [ ] Improve content quality on affected pages
- [ ] Strengthen E-E-A-T signals
- [ ] Fix technical SEO issues
- [ ] Build high-quality backlinks
- [ ] Optimize for user intent
- [ ] Update outdated content
- [ ] Remove thin or low-quality content

---

## Troubleshooting Guide

### Pages Not Indexing

1. [ ] Check robots.txt - Is page blocked?
2. [ ] Check meta robots tag - Is it noindex?
3. [ ] Check canonical tag - Does it point elsewhere?
4. [ ] Check Search Console Coverage - What's the exclusion reason?
5. [ ] Check internal links - Is page orphaned?
6. [ ] Check content quality - Is it thin or duplicate?
7. [ ] Check for manual actions - Any penalties?
8. [ ] Request indexing via Search Console
9. [ ] Submit in XML sitemap
10. [ ] Wait 1-2 weeks and recheck

### Dropped Rankings

1. [ ] When did drop occur? (correlate with algorithm updates)
2. [ ] Which pages affected? (pattern analysis)
3. [ ] What changed on site? (content, technical, links)
4. [ ] What changed in SERPs? (new competitors, features)
5. [ ] Are backlinks lost? (check backlink reports)
6. [ ] Are technical issues present? (crawl errors, speed)
7. [ ] Update content to match current intent
8. [ ] Improve content quality and depth
9. [ ] Strengthen E-E-A-T signals
10. [ ] Build high-quality backlinks

### Low Click-Through Rate

1. [ ] Check Search Console Performance report
2. [ ] Analyze title tag and meta description
3. [ ] Check SERP appearance (test with real search)
4. [ ] Compare to competitors' listings
5. [ ] Implement structured data for rich snippets
6. [ ] Rewrite titles with power words, numbers
7. [ ] Improve meta descriptions with CTAs
8. [ ] Add FAQ schema for People Also Ask
9. [ ] Monitor and iterate

### High Bounce Rate from Organic

1. [ ] Check landing page relevance to query
2. [ ] Analyze page load speed (target LCP < 2.5s)
3. [ ] Review content quality and readability
4. [ ] Check mobile usability
5. [ ] Improve content-query match
6. [ ] Optimize page speed
7. [ ] Enhance content formatting
8. [ ] Add clear calls-to-action
9. [ ] Improve internal linking
10. [ ] A/B test different layouts

---

## Tools Checklist

### Required (Free)

- [ ] Google Search Console
- [ ] Google Analytics 4
- [ ] Google PageSpeed Insights
- [ ] Google Rich Results Test
- [ ] Google Mobile-Friendly Test
- [ ] Bing Webmaster Tools

### Recommended (Free/Freemium)

- [ ] Screaming Frog (free up to 500 URLs)
- [ ] Google Lighthouse
- [ ] Chrome DevTools
- [ ] Schema.org Validator

### Paid (Choose Based on Budget)

- [ ] All-in-One: Ahrefs, SEMrush, or Moz Pro
- [ ] Rank Tracking: SERanking or AccuRanker
- [ ] Technical SEO: Sitebulb, Oncrawl, or DeepCrawl
- [ ] Content: Clearscope, Surfer SEO, or MarketMuse

---

This checklist should be customized based on your specific site, industry, and goals. Use it as a starting point and add site-specific items as needed.
