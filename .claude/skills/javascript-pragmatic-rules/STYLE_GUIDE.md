# Browser-Native JavaScript Style Guide (ES2025)

**Environment:** Strictly Browser (DOM/Window). **No Node.js APIs.**
**Backend Alignment:** Rust (Snake\_case for **files only**).
**Module System:** Native ESM (Import Maps or explicit extensions).

### 0\. Philosophy & Constraints

* **No Node.js Globals:** Never use `process`, `Buffer`, or `require`.
* **Production Reality:** Code runs unbundled in dev, but use a minifier (esbuild/rollup) for production.
* **Override Rule:** Violate only if it improves performance/clarity **AND** is documented.

### 1\. Files & Formatting

* **Naming:** `snake_case` for files/directories **ONLY**.
    * ✅ `user_profile.js`
    * ❌ `userProfile.js`
* **Indentation:** 2 spaces. **No tabs.**
* **Line Length:** 80 chars.
* **Braces (1TBS):** Required for **all** blocks (even single-line `if`/`for`).
* **Semicolons:** Required.
* **Trailing Commas:** **Mandatory** in multi-line objects/arrays (cleaner git diffs).

### 2\. References & Naming

* **Declarations:** `const` by default. `let` only if reassignment is strict. **NO `var`**.
* **Variable Naming:** `lowerCamelCase`.
    * ✅ `const userProfile = ...`
    * ❌ `const user_profile = ...` (Reserved for Rust files/APIs).
* **Constants:** `UPPER_CASE` (only for exported, hard-coded static constants).
* **Classes:** `PascalCase`.
* **Booleans:** Prefix with `is`, `has`, or `can`.
* **Coercion:** Explicit `Number()`, `String()`, `Boolean()`. Never use `new`.

### 3\. Objects & Collections

* **Shorthand (Mandatory):**
    * Properties: `{ name }` (not `{ name: name }`).
    * Methods: `{ greet() {} }` (not `{ greet: function() {} }`).
    * Computed: `{ [key]: val }` (not `obj[key] = val`).
* **Copying:**
    * Deep: `structuredClone(obj)`.
    * Shallow: `{ ...obj }`.
* **Access & Safety:**
    * Check properties: `Object.hasOwn(obj, key)`.
    * Array Indexing: `items.at(-1)` (for last item).
    * Mutation: Use `.push()`. **Never** assign directly to index (`arr[i] = val`).
* **WeakMaps:** Use `WeakMap` for attaching metadata to DOM elements (auto-GC).
* **Sets (ES2024):** Use native methods (`.union`, `.intersection`, `.difference`).

### 4\. Destructuring

* **Mandatory** when accessing 2+ properties/elements.
* **Safe Defaults:** Use nullish coalescing for optional objects.
    * ✅ `const { results = [] } = responseData ?? {};`

### 5\. Functions

* **Type:** Arrow functions preferred. Mandatory for callbacks.
* **Parameters:**
    * Defaults last: `(a, b = 1)`.
    * Rest syntax: `(...args)`. **Never** `arguments`.
    * **No Mutation:** If you need to modify input, copy it first.
* **Guard Clauses:** Return early. Avoid `else` after a `return`.

### 6\. Classes & Components

* **Syntax:** `class` and `extends`.
* **Privacy:** Strictly use ES Private Fields (`#field`) and methods (`#method`).
* **Initialization:** Use `static { ... }` blocks for complex static setup.
* **Communication:** Use `CustomEvent` with `{ bubbles: true }` for loose coupling.

### 7\. Control Flow & Data

* **Immutable Ops (ES2023):** `.toSorted()`, `.toReversed()`, `.toSpliced()`, `.with()`.
* **Grouping (ES2024):**
    * String keys: `Object.groupBy()`.
    * Complex keys: `Map.groupBy()`.
* **Loops:** `for...of` only. **No** `forEach` (except in chains).
* **Iterators (ES2025):** Use `Iterator.from()` helpers for large datasets if supported.

### 8\. Async & Network

* **Async/Await:** Mandatory. No `.then()` chains.
* **Streams:** Use `await Array.fromAsync(iterable)` for async streams/pagination.
* **Fetch:**
    * Handle 4xx/5xx manually.
    * Use `AbortController` for cancellation.
* **Error Handling:**
    * **Must** use `{ cause: err }` when re-throwing.
    * `Promise.withResolvers()` for event bridges.
    * `Promise.allSettled()` for batching.

### 9\. Strings & RegExp

* **Quotes:** Single `'` for static, Backticks `` ` `` for dynamic.
* **Unicode:** `str.isWellFormed()` / `str.toWellFormed()`.
* **RegExp:**
    * Use `/v` flag (Unicode sets).
    * Use `str.replaceAll()` only.
* **Numbers:** Use underscores for 5+ digits (`1_000_000`).

### 10\. Web APIs & Performance

* **Workers:** Offload heavy math/sorting to `new Worker()`.
* **Observers:** `IntersectionObserver` (lazy load), `MutationObserver` (DOM changes).
* **Telemetry:** `fetch(url, { keepalive: true })`.
* **Timing:** `queueMicrotask()` over `setTimeout(0)`.

### 11\. Modules (ESM)

* **Imports:** Named imports only. **Explicit extensions required** (`.js`).
* **Import Maps:** Use `<script type="importmap">` for package resolution.
* **Exports:** Named exports only. No `default` exports.

### 12\. Security

* **XSS:** `elem.textContent = val`. **Never** `innerHTML` without `DOMPurify`.
* **CORS:** Explicit `credentials: 'same-origin'`.

---