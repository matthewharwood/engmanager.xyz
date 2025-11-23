<objective>
Consolidate and revise the `javascript-pragmatic-rules` and `web-components-architecture` skills to remove ALL React/Node.js references, replace with vanilla web components, and aggressively reduce token count while preserving 100% of the technical context and value.

This is a critical optimization task where EVERY token matters. Be ruthless in consolidation but do NOT lose any substantive technical content.
</objective>

<context>
Current state:
- `.claude/skills/javascript-pragmatic-rules/` contains 5 files (SKILL.md, SKILL_PART2.md, QUICK_REFERENCE.md, README.md, V8_OPTIMIZATION.md)
- `.claude/skills/web-components-architecture/` contains 5 files (SKILL.md, PATTERNS.md, EXAMPLES.md, README.md, TROUBLESHOOTING.md)

Problems to fix:
1. **React contamination**: javascript-pragmatic-rules has React examples (useEffect, React components, JSX)
2. **Node.js contamination**: References to MSW, fast-check, and other server-side libraries
3. **Token bloat**: Verbose explanations, duplicate concepts, redundant examples
4. **Inconsistent patterns**: React patterns don't align with web-components-architecture philosophy

Reference for correct patterns:
- Use `.claude/skills/web-components-architecture/SKILL.md` as the source of truth for web component patterns
- Use `.claude/skills/javascript-pragmatic-rules/V8_OPTIMIZATION.md` as reference (it's already clean)
</context>

<requirements>
## Phase 1: Identify and Replace React References

In `javascript-pragmatic-rules/` files, find and replace ALL:

### React Hooks → Web Component Lifecycle
- `useEffect(() => { ... }, [])` → `connectedCallback() { ... }`
- `useEffect(() => { return cleanup }, [])` → `disconnectedCallback() { cleanup }`
- `useState()` → attribute-driven state with `observedAttributes`
- `useCallback()`, `useMemo()` → vanilla JS patterns or remove

### React Components → Web Components
- `class ErrorBoundary extends React.Component` → `class ErrorBoundary extends HTMLElement`
- `<Profiler>` → Performance API (`performance.mark()`, `performance.measure()`)
- JSX examples → HTML with Declarative Shadow DOM
- `this.setState()` → `this.setAttribute()`
- `this.props` → `this.getAttribute()`

### React-Specific Patterns → Web Platform APIs
- Error boundaries → `window.addEventListener('error')` + `window.addEventListener('unhandledrejection')`
- Context API → CustomEvents with `bubbles: true, composed: true`
- Refs → Direct element references (no querySelector!)

## Phase 2: Remove Node.js/Server-Side Libraries

### Remove Completely
- **MSW (Mock Service Worker)**: Replace with browser-native `fetch` mocking or manual mock implementations
- **fast-check**: Replace with browser-based property testing examples using manual random generation
- Any `import` statements referencing npm packages

### Replace With Browser APIs
- Testing examples should use browser's test infrastructure or plain JavaScript
- Mock examples should use native `fetch` override patterns
- Validation examples should use browser Constraint Validation API

## Phase 3: Aggressive Consolidation

Apply these consolidation rules to EVERY file:

### Writing Rules
1. **Eliminate filler words**: "very", "really", "basically", "essentially", "simply", "just"
2. **Use shortest forms**: "don't" not "do not", "can't" not "cannot"
3. **Remove redundant examples**: If pattern shown once, don't repeat with minor variations
4. **Compress explanations**: Every sentence must add unique value or be deleted
5. **Merge duplicate concepts**: If concept explained in multiple files, consolidate to ONE location
6. **Use shorthand**: Code comments over prose, examples over explanations
7. **Remove meta-commentary**: No "Note:", "Important:", "Remember:", "Keep in mind:" - just state facts
8. **Eliminate intro/outro**: No "In summary", "To conclude", "Let's look at", "Here's how"

### Structural Consolidation
1. **Merge SKILL.md + SKILL_PART2.md**: Single file with Rules 1-30
2. **Inline QUICK_REFERENCE.md**: Merge into main SKILL.md as compact reference section
3. **Keep V8_OPTIMIZATION.md separate**: Already clean, leave as-is
4. **Compress README.md**: 50% reduction minimum, focus on skill invocation triggers only

### Code Example Consolidation
1. **Show each pattern exactly once**: No "here's another way" variations unless critically different
2. **Inline comments over external explanation**: Let code speak
3. **Remove "wrong vs right" comparisons where obvious**: Show only correct pattern
4. **Combine related examples**: Merge multiple small examples into one comprehensive example
5. **Remove boilerplate**: No `console.log()` unless demonstrating logging pattern
6. **Use shortest syntax**: Arrow functions, destructuring, modern operators

## Phase 4: Web Component Pattern Alignment

Replace ALL component examples with patterns from `web-components-architecture/`:

### Required Patterns
- ✅ **Zero DOM Selection**: Never `querySelector`
- ✅ **Attribute-Driven State**: `setAttribute()` / `getAttribute()` / `observedAttributes`
- ✅ **HandleEvent Pattern**: `this.addEventListener(type, this)` + `handleEvent(e)`
- ✅ **Event-Based Output**: `this.dispatchEvent(new CustomEvent(...))`
- ✅ **Declarative Shadow DOM**: `<template shadowrootmode="open">`

### Specific Replacements
- Cleanup examples (Rule 4) → Use web component `disconnectedCallback()` pattern from SKILL.md:544-569
- Error boundary (Rule 7) → Use pattern from SKILL.md:1386-1480
- State management (Rule 5) → Use attribute pattern from PATTERNS.md:6-38
- Event delegation (Rule 4) → Use handleEvent pattern from SKILL.md:211-257

## Phase 5: Token Reduction Targets

Target reductions (measure by character count):

| File | Current Estimate | Target Reduction | New Target |
|------|------------------|------------------|------------|
| SKILL.md + SKILL_PART2.md | ~80,000 chars | 40% | ~48,000 chars |
| QUICK_REFERENCE.md | ~15,000 chars | MERGE | 0 (merged) |
| README.md | ~10,000 chars | 50% | ~5,000 chars |
| V8_OPTIMIZATION.md | ~25,000 chars | 0% | ~25,000 chars |

**Total target: Reduce from ~130,000 to ~78,000 chars (40% reduction)**
</requirements>

<implementation>
## Execution Order

Execute in this EXACT order:

### Step 1: Create Consolidated SKILL.md
1. Read both SKILL.md and SKILL_PART2.md
2. Identify ALL React references and mark for replacement
3. For EACH React pattern:
   - Find equivalent web component pattern in web-components-architecture/
   - Replace with concise version
   - Remove React imports/references completely
4. Merge Rules 1-30 into single file
5. Apply aggressive consolidation rules
6. Inline QUICK_REFERENCE.md content as compact reference
7. Write to `javascript-pragmatic-rules/SKILL.md`

### Step 2: Revise README.md
1. Read current README.md
2. Remove ALL React references
3. Update examples to use web components
4. Cut token count by 50%
5. Focus only on: skill description, when to invoke, and example triggers
6. Write to `javascript-pragmatic-rules/README.md`

### Step 3: Verify V8_OPTIMIZATION.md
1. Read file
2. Confirm no React/Node.js references (should be clean)
3. If found, replace with browser-based alternatives
4. Apply minor consolidation (10-15% reduction max)
5. Write to `javascript-pragmatic-rules/V8_OPTIMIZATION.md`

### Step 4: Create STYLE_GUIDE.md Reference
1. Extract common vanilla JS patterns
2. Document browser-only testing approaches
3. Create compact reference (<5,000 chars)
4. Write to `javascript-pragmatic-rules/STYLE_GUIDE.md`

### Step 5: Delete OBSOLETE Files
- Delete `javascript-pragmatic-rules/QUICK_REFERENCE.md` (merged into SKILL.md)
- Delete `javascript-pragmatic-rules/SKILL_PART2.md` (merged into SKILL.md)
</implementation>

<validation>
## Success Criteria

After completion, verify:

### Zero Contamination
- [ ] ZERO occurrences of "React" in any file
- [ ] ZERO occurrences of "useEffect", "useState", "useMemo", "useCallback"
- [ ] ZERO occurrences of "MSW", "fast-check", or other npm packages
- [ ] ZERO `import` statements for external libraries
- [ ] ZERO `npm`, `node`, `package.json` references

### Web Component Alignment
- [ ] ALL cleanup examples use `disconnectedCallback()`
- [ ] ALL state examples use `setAttribute()` / `getAttribute()`
- [ ] ALL event examples use `CustomEvent` with `bubbles: true`
- [ ] ALL component examples use `handleEvent` pattern
- [ ] ALL DOM examples avoid `querySelector`

### Token Reduction
- [ ] Combined SKILL.md ≤ 48,000 characters
- [ ] README.md ≤ 5,000 characters
- [ ] QUICK_REFERENCE.md deleted
- [ ] SKILL_PART2.md deleted
- [ ] Total skill directory ≤ 80,000 characters

### Technical Completeness
- [ ] All 30 rules present and explained
- [ ] All V8 optimization patterns intact
- [ ] All error handling patterns preserved
- [ ] All async patterns preserved
- [ ] NO loss of substantive technical content
</validation>

<output>
## Files to Modify

1. **OVERWRITE** `.claude/skills/javascript-pragmatic-rules/SKILL.md`
   - Merged content from SKILL.md + SKILL_PART2.md + QUICK_REFERENCE.md
   - Rules 1-30 consolidated
   - ALL React → Web Components
   - Target: ≤48,000 chars

2. **OVERWRITE** `.claude/skills/javascript-pragmatic-rules/README.md`
   - Skill description only
   - Web component examples
   - Target: ≤5,000 chars

3. **OVERWRITE** `.claude/skills/javascript-pragmatic-rules/V8_OPTIMIZATION.md`
   - Minor cleanup only if needed
   - Target: ~25,000 chars (minimal change)

4. **CREATE** `.claude/skills/javascript-pragmatic-rules/STYLE_GUIDE.md`
   - Browser-based testing patterns
   - Vanilla JS style guide
   - Target: ≤5,000 chars

5. **DELETE** `.claude/skills/javascript-pragmatic-rules/QUICK_REFERENCE.md`

6. **DELETE** `.claude/skills/javascript-pragmatic-rules/SKILL_PART2.md`

## Execution Approach

- Work file-by-file in the order specified
- Show character count after each file
- Confirm zero React/Node.js references after each file
- Be RUTHLESS with consolidation - every token counts
- Preserve ALL technical substance - zero information loss
</output>

<constraints>
## Hard Constraints

1. **NO React**: Zero tolerance for React references
2. **NO Node.js**: Only browser runtime APIs
3. **NO external libraries**: Vanilla JS only (except Web Platform APIs)
4. **NO information loss**: Every technical concept must be preserved
5. **NO vague consolidation**: Must achieve 40% token reduction
6. **NO new concepts**: Only reorganize existing content
7. **MUST use web-components-architecture patterns**: This is the canonical reference

## Soft Preferences

- Prefer code examples over prose explanations
- Prefer inline comments over separate explanations
- Prefer combining examples over showing variations
- Prefer brevity over clarity ONLY when technical meaning preserved
- Prefer modern syntax (ES2023+) for token efficiency
</constraints>

<examples>
## Before/After Examples

### Example 1: Cleanup Pattern

**BEFORE (React):**
```javascript
// ❌ WRONG
useEffect(() => {
  const interval = setInterval(() => {
    console.log('tick');
  }, 1000);

  return () => clearInterval(interval);
}, []);
```

**AFTER (Web Component):**
```javascript
// ✅ Web Component
class Timer extends HTMLElement {
  connectedCallback() {
    this.intervalId = setInterval(() => console.log('tick'), 1000);
  }

  disconnectedCallback() {
    clearInterval(this.intervalId);
  }
}
```

### Example 2: State Management

**BEFORE (React):**
```javascript
// ❌ WRONG
const [count, setCount] = useState(0);

function increment() {
  setCount(count + 1);
}
```

**AFTER (Web Component):**
```javascript
// ✅ Attribute-driven state
class Counter extends HTMLElement {
  static observedAttributes = ['count'];

  increment() {
    const count = parseInt(this.getAttribute('count') || '0', 10);
    this.setAttribute('count', String(count + 1));
  }

  attributeChangedCallback(name, old, val) {
    if (name === 'count') this.render();
  }
}
```

### Example 3: Error Boundaries

**BEFORE (React):**
```javascript
// ❌ WRONG
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

**AFTER (Web Component):**
```javascript
// ✅ Browser error handling
class ErrorBoundary extends HTMLElement {
  connectedCallback() {
    window.addEventListener('error', this);
    window.addEventListener('unhandledrejection', this);
  }

  handleEvent(e) {
    this.setAttribute('error', 'true');
    if (window.errorTracker) {
      window.errorTracker.captureException(e.error || e.reason);
    }
    e.preventDefault();
  }

  disconnectedCallback() {
    window.removeEventListener('error', this);
    window.removeEventListener('unhandledrejection', this);
  }
}
```

### Example 4: Token Consolidation

**BEFORE (Verbose):**
```
**Why It Matters**: This pattern is very important because it helps you avoid memory leaks that can really slow down your application over time. Remember that when you create event listeners, timers, or observers, you need to clean them up properly. Keep in mind that forgetting to do this can cause serious performance issues. Let's look at how to do this correctly.
```

**AFTER (Concise):**
```
**Why**: Prevents memory leaks from orphaned listeners/timers/observers.
```

(Reduction: 280 chars → 70 chars = 75% reduction)
</examples>

<success_criteria>
When complete, this prompt has succeeded if:

1. **Zero contamination**: No React, Node.js, or external library references
2. **40% token reduction**: From ~130k to ~80k characters
3. **100% content preservation**: All technical concepts intact
4. **Pattern alignment**: All examples use web-components-architecture patterns
5. **File consolidation**: 5 files → 3 files (SKILL.md, README.md, V8_OPTIMIZATION.md, STYLE_GUIDE.md)
6. **Skill quality**: Remains production-ready reference for vanilla JS + web components
</success_criteria>
