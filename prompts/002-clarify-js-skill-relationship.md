<objective>
Clarify the relationship between two JavaScript skills to enable intelligent agent decision-making about which skill(s) to reference when writing JavaScript code.

**Current Problem:**
- `javascript-pragmatic-rules` and `web-components-architecture` both cover JavaScript
- Unclear when agents should use one vs both
- GRAYSON.md doesn't explain their complementary relationship

**Desired Outcome:**
Agents automatically know:
- Use `javascript-pragmatic-rules` for ALL JavaScript (it's the HOW - best practices)
- Use `web-components-architecture` when building UI components (it's the WHAT - architectural choice)
- Use BOTH when building interactive web components (architecture + best practices)
</objective>

<context>
**Current Skill Structure:**

1. **`javascript-pragmatic-rules`**: 30 rules covering async operations, V8 optimization, memory management, testing, error handling, performance. Applies to ALL JavaScript code.

2. **`web-components-architecture`**: Custom Elements v1 API patterns - Shadow DOM, lifecycle callbacks, handleEvent pattern, attribute-driven state. Specific architectural choice for UI components.

**Key Insight:** These are complementary, not competing:
- `javascript-pragmatic-rules` = HOW to write JavaScript correctly
- `web-components-architecture` = WHAT pattern to use for interactive components
- Web components should be written using pragmatic rules
- Not all JavaScript needs web components (utilities, data processing, etc.)

**Files to Update:**
- `.claude/commands/GRAYSON.md` - Agent instruction document
- `.claude/skills/javascript-pragmatic-rules/SKILL.md` - Add cross-reference
- `.claude/skills/javascript-pragmatic-rules/README.md` - Update description
- `.claude/skills/web-components-architecture/SKILL.md` - Add cross-reference
- `.claude/skills/web-components-architecture/README.md` - Update description
</context>

<requirements>

## 1. Update GRAYSON.md Skill Descriptions

In the "Available Skills" section, replace entries 15-16 with:

```markdown
**JavaScript & Component Architecture:**

15. **web-components-architecture** - Custom Elements v1 architecture for building interactive UI components. Covers Shadow DOM, lifecycle callbacks, handleEvent pattern, attribute-driven state, and zero DOM selection principle. **Use when:** Building client-side interactive components, form controls, or reusable UI elements. **Always combine with** `javascript-pragmatic-rules` for implementation best practices.

16. **javascript-pragmatic-rules** - 30 production rules for ALL JavaScript code covering async operations, V8 optimization, memory management, testing, error handling, and performance. **Use when:** Writing any JavaScript code (utilities, components, data processing, event handlers). **Foundation for:** All JavaScript implementations including web components.
```

Add a new subsection after entry 16:

```markdown
**Skill Relationship - JavaScript:**
- **All JavaScript code** → Reference `javascript-pragmatic-rules` (HOW to write it correctly)
- **UI components specifically** → ALSO reference `web-components-architecture` (WHAT pattern to use)
- **Non-UI JavaScript** (utilities, data processing) → ONLY `javascript-pragmatic-rules`

Example: When building a custom `<async-button>` web component, reference BOTH skills:
- Use `web-components-architecture` for component structure (HTMLElement, connectedCallback, handleEvent)
- Use `javascript-pragmatic-rules` for async handling (Rule 2: timeout operations, Rule 4: cleanup resources)
```

## 2. Add Cross-Reference to javascript-pragmatic-rules/SKILL.md

After the frontmatter (after line 5), add:

```markdown
## Relationship with Web Components

This skill provides best practices for **all JavaScript code**, including web components. When building interactive UI components with the Custom Elements API, combine this skill with `web-components-architecture`:

- **This skill (`javascript-pragmatic-rules`)**: HOW to write JavaScript correctly
  - Async patterns (Rules 1-4)
  - Error handling (Rules 7-10)
  - Performance optimization (Rules 16-22)
  - Testing strategies (Rules 12-15)

- **`web-components-architecture` skill**: WHAT pattern to use for components
  - Component lifecycle (connectedCallback, disconnectedCallback)
  - Shadow DOM and encapsulation
  - Attribute-driven state
  - HandleEvent pattern

**Example:** A custom `<data-table>` component should:
- Use `web-components-architecture` for structure (extends HTMLElement, uses Shadow DOM)
- Use `javascript-pragmatic-rules` Rule 4 for cleanup (disconnectedCallback removes listeners)
- Use `javascript-pragmatic-rules` Rule 17 for memory leak prevention
- Use `javascript-pragmatic-rules` Rule 2 for timeout on async data fetching

See `web-components-architecture` skill for component-specific patterns.

---
```

## 3. Update javascript-pragmatic-rules/README.md

Replace the "When Claude Uses This Skill" section with:

```markdown
## When to Use This Skill

**This skill applies to ALL JavaScript code.** Reference it when:
- Writing utility functions
- Handling async operations (fetch, promises, timers)
- Implementing error handling
- Writing tests
- Optimizing performance
- Building ANY JavaScript feature

**For UI Components:** If you're building interactive client-side components (Custom Elements), ALSO reference the `web-components-architecture` skill for architectural patterns. This skill provides the HOW (best practices), while `web-components-architecture` provides the WHAT (component structure).

**Examples:**
- Writing a data processing utility → Use this skill only
- Writing async fetch logic → Use this skill only (Rules 1-4)
- Building a `<custom-dropdown>` component → Use this skill + `web-components-architecture`
- Implementing form validation → Use this skill only (unless building a custom element)
```

## 4. Add Cross-Reference to web-components-architecture/SKILL.md

After the "Core Principles" section (after line 19), add:

```markdown
## Relationship with JavaScript Best Practices

This skill defines the **architectural pattern** for building web components. When implementing components, combine this skill with `javascript-pragmatic-rules` for production-quality code:

**This skill provides the WHAT (component architecture):**
- Component structure (extends HTMLElement)
- Lifecycle callbacks (connectedCallback, disconnectedCallback)
- State management (attribute-driven)
- Event patterns (handleEvent, CustomEvent)
- Shadow DOM and encapsulation

**`javascript-pragmatic-rules` provides the HOW (implementation quality):**
- Async operation handling (timeouts, cancellation)
- Resource cleanup patterns
- Error handling strategies
- Memory leak prevention
- Performance optimization

**Example:** Building an `<async-button>` component:

```javascript
// Architecture from web-components-architecture skill
class AsyncButton extends HTMLButtonElement {
  #controller = null; // Private field for cleanup

  connectedCallback() {
    this.addEventListener('click', this);
  }

  // Using handleEvent pattern from web-components-architecture
  async handleEvent(e) {
    if (e.type === 'click') {
      // Rule 2 from javascript-pragmatic-rules: Timeout async operations
      this.#controller = new AbortController();
      const timeoutId = setTimeout(() => this.#controller.abort(), 5_000);

      try {
        const response = await fetch(this.getAttribute('data-url'), {
          signal: this.#controller.signal
        });
        clearTimeout(timeoutId);
        // Handle response...
      } catch (error) {
        // Rule 1 from javascript-pragmatic-rules: Handle rejections
        if (error.name === 'AbortError') {
          console.warn('Request timed out');
        } else {
          throw new Error('Request failed', { cause: error });
        }
      }
    }
  }

  // Rule 4 from javascript-pragmatic-rules: Clean up resources
  disconnectedCallback() {
    this.removeEventListener('click', this);
    if (this.#controller) this.#controller.abort();
  }
}
```

**Key Integration Points:**
- Use this skill's `connectedCallback` with `javascript-pragmatic-rules` Rule 4 (cleanup)
- Use this skill's `handleEvent` with `javascript-pragmatic-rules` Rules 1-2 (async safety)
- Use this skill's attribute patterns with `javascript-pragmatic-rules` Rule 5 (immutability)

See `javascript-pragmatic-rules` skill for comprehensive JavaScript best practices.

---
```

## 5. Update web-components-architecture/README.md

After the "Overview" section, add:

```markdown
## When to Use This Skill

**Use this skill when building interactive UI components with the Custom Elements API:**
- Custom form controls
- Interactive widgets (dropdowns, modals, carousels)
- Reusable UI components
- Client-side interactivity

**Do NOT use this skill for:**
- Utility functions (use `javascript-pragmatic-rules` only)
- Data processing logic
- Non-UI JavaScript

**Always combine with `javascript-pragmatic-rules`:** This skill defines component architecture (WHAT to build), while `javascript-pragmatic-rules` ensures quality implementation (HOW to build it correctly). All async operations, error handling, and resource cleanup should follow `javascript-pragmatic-rules` patterns.
```

</requirements>

<constraints>

**Must NOT:**
- Change the technical content of either skill's core patterns
- Merge or consolidate the skill files
- Remove any existing examples or rules
- Change file structure beyond adding cross-references

**Must preserve:**
- All existing rules and patterns in both skills
- File organization (separate skills remain separate)
- Frontmatter metadata (name, description, allowed-tools)

**Writing style:**
- Be concise but clear
- Use bold for emphasis on key decision points
- Provide concrete examples showing both skills working together
- Use decision logic format: "When X → Use Y"

</constraints>

<implementation>

## Execution Order

Work in this exact sequence:

### Step 1: Update GRAYSON.md
1. Read `.claude/commands/GRAYSON.md`
2. Locate the "JavaScript & Component Design Systems" section (lines 46-50)
3. Replace entries 15-16 with the enhanced descriptions from Requirements #1
4. Add the "Skill Relationship - JavaScript" subsection after entry 16
5. Verify the numbering remains consistent with other skills

### Step 2: Update javascript-pragmatic-rules Skill
1. Read `.claude/skills/javascript-pragmatic-rules/SKILL.md`
2. Insert the cross-reference section from Requirements #2 after line 5
3. Read `.claude/skills/javascript-pragmatic-rules/README.md`
4. Replace the "When Claude Uses This Skill" section with Requirements #3

### Step 3: Update web-components-architecture Skill
1. Read `.claude/skills/web-components-architecture/SKILL.md`
2. Insert the cross-reference section from Requirements #4 after line 19
3. Read `.claude/skills/web-components-architecture/README.md`
4. Add the "When to Use This Skill" section from Requirements #5

### Step 4: Validate
Confirm that:
- Both skills now explicitly reference each other
- GRAYSON.md clearly explains when to use each skill
- Decision logic is crystal clear for agents
- No technical content was changed, only relationship clarifications added

</implementation>

<output>

You will modify these 5 files:
1. `.claude/commands/GRAYSON.md` - Enhanced skill descriptions with decision logic
2. `.claude/skills/javascript-pragmatic-rules/SKILL.md` - Add relationship section
3. `.claude/skills/javascript-pragmatic-rules/README.md` - Update "When to Use"
4. `.claude/skills/web-components-architecture/SKILL.md` - Add relationship section
5. `.claude/skills/web-components-architecture/README.md` - Add "When to Use"

After completion, provide a summary showing:
- The new GRAYSON.md skill descriptions
- Example of how an agent would decide which skill(s) to use
- Confirmation that cross-references are in place

</output>

<success_criteria>

Task is complete when:

1. **GRAYSON.md** clearly explains the relationship between the two skills with decision logic
2. **Both skill SKILL.md files** have cross-references to each other with concrete examples
3. **Both skill README.md files** explicitly state when to use that skill vs the other
4. **Agents can automatically determine** which skill(s) to reference based on the task:
   - All JavaScript → `javascript-pragmatic-rules`
   - UI components → BOTH skills
   - Non-UI code → Only `javascript-pragmatic-rules`
5. **No technical content changed** - only relationship clarifications added
6. **Examples provided** showing both skills used together in web component code

</success_criteria>

<verification>

Before marking complete, verify:

- [ ] Read all 5 modified files to confirm changes are correct
- [ ] GRAYSON.md has the "Skill Relationship - JavaScript" subsection
- [ ] Both skills reference each other explicitly
- [ ] Decision logic is clear: "When X → Use Y"
- [ ] At least one concrete code example shows both skills integrated
- [ ] No existing rules or patterns were altered

</verification>
