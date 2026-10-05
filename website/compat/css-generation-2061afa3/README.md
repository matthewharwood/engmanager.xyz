# Initial class-generation compatibility archive

These CSS and JavaScript bodies were retrieved from the frozen release binary built at commit `2061afa3aad1577e56f95cf665b49a3462f5d890` before introducing generated class names. `manifest.json` records the binary SHA-256, exact public asset URLs, complete body hashes, and byte lengths.

The first deployment must let previously cached documents retrieve their own exact assets. Their existing router rejects changed destination asset versions before promotion and performs ordinary navigation. The archive is served only through its explicit manifest entries after verifying the content hash, and does not participate in class generation or current-page asset selection. Unknown obsolete hashes remain errors.

These are previously published project assets, retained with their existing notices and licenses. Published personality releases and unversioned assets remain in their ordinary immutable locations. Retain this archive until all supported old-document caches have expired; this initial bridge avoids requiring a coordinated CDN purge.

`legacy-feed.html` is the exact `/feed` document captured from the same frozen
binary by the baseline inventory. It is a native regression fixture, not a
public asset alias; the compatibility handler only serves manifest-listed
CSS and JavaScript. Its source inventory is
`/tmp/engmanager-css-baseline-full-inventory/report.json`.

Document SHA-256: `2e63e43fc78982ba51e949d1fff26708db013be832a7bbf7b90fdf9c2dabded3`.
