<objective>
Build the interactive Properties Panel UI using Web Components with 2-way data binding between the schema-driven form and Monaco editor.

This phase creates the client-side interactivity layer: custom elements (<prop-editor>, <prop-field>) that handle form state, real-time Monaco synchronization, and dirty state tracking—all without requiring a JavaScript framework.

This enables users to edit Block properties via both the visual form and raw JSON, with changes instantly reflected in both views.
</objective>

<context>
**Previous Phase Deliverables:**
- Schema-driven form renderer exists (schema_form.rs)
- Forms are server-rendered with data-path attributes on each field
- Test route at /admin/schema-test/header displays HeaderProps form

**Current State:**
- Monaco editor exists and is integrated (from git history: admin-index.css, monaco.js)
- Forms are static HTML (no interactivity yet)
- No connection between form fields and Monaco JSON

**End Goal (This Phase):**
Web Components that provide:
- Form field state management
- 2-way binding: Form changes → Monaco JSON, Monaco changes → Form fields
- Dirty state tracking (unsaved changes indicator)
- Foundation for Phase 3's publish workflow

**Why This Matters:**
This creates a professional editor experience where users can work in their preferred mode (visual form or code) while maintaining a single source of truth. Changes propagate instantly without page reloads.
</context>

<requirements>
**Agent Invocation:**
Use @agent-graydon-rust-engineer with ALL available skills:
- web-components-architecture (Custom Elements v1, Declarative Shadow DOM, handleEvent)
- javascript-pragmatic-rules (async operations, V8 optimization, memory management)
- maud-components-patterns (server-side rendering with Web Components)
- rust-core-patterns (type-safe component architecture)

**CRITICAL:** Use Web Components architecture skill for ALL JavaScript. Follow these patterns:
- Custom Elements v1 API with Declarative Shadow DOM
- Attribute-driven state (no props drilling)
- handleEvent pattern for event handling
- Zero DOM selection (NO querySelector, NO innerHTML)
- Pure web platform APIs only (NO external libraries)

**Technical Requirements:**

1. **Web Component: `<prop-editor>`**
   - Container component that manages the entire properties panel
   - Attributes:
     - `schema` - JSON Schema (from schemars)
     - `initial-value` - Current Block props as JSON string
   - State:
     - Current form values (object matching schema structure)
     - Dirty flag (has unsaved changes)
   - Responsibilities:
     - Initialize Monaco editor in JSON mode
     - Sync form → Monaco on field changes
     - Sync Monaco → form on editor changes
     - Emit custom events: `prop-change`, `prop-dirty`, `prop-clean`
   - Methods:
     - `getValue()` - Return current props as JSON
     - `setValue(json)` - Update both form and Monaco
     - `reset()` - Revert to initial value

2. **Web Component: `<prop-field>`**
   - Individual form field wrapper
   - Attributes:
     - `path` - Property path (e.g., "button.text")
     - `type` - Schema type ("string", "boolean", "number")
     - `value` - Current value
   - Responsibilities:
     - Wrap existing input/checkbox components
     - Listen for user input events
     - Dispatch change event to parent <prop-editor>
     - Update own value when parent calls setValue()
   - Use handleEvent pattern for all event listeners

3. **2-Way Binding Architecture**
   ```
   User types in form input
     ↓
   <prop-field> dispatches 'field-change' event
     ↓
   <prop-editor> updates internal state
     ↓
   <prop-editor> updates Monaco JSON
     ↓
   Monaco editor displays updated JSON

   User edits Monaco JSON
     ↓
   Monaco onChange event
     ↓
   <prop-editor> parses JSON
     ↓
   <prop-editor> updates form fields via setValue()
     ↓
   <prop-field> elements reflect new values
   ```

4. **Dirty State Tracking**
   - Compare current value with initial-value attribute
   - Add visual indicator (e.g., orange border, "Unsaved changes" text)
   - Emit `prop-dirty` event when changes detected
   - Emit `prop-clean` event when reverted to initial

5. **Server Integration**
   - Update schema_form.rs to wrap rendered form in <prop-editor>
   - Inject schema and initial-value attributes server-side
   - Render <prop-field> wrappers around input/checkbox components
   - Include Web Component JavaScript in page <head>

6. **Monaco Integration**
   - Reuse existing Monaco editor setup
   - Configure for JSON editing mode
   - Add schema validation (use the generated JSON Schema)
   - Pretty-print JSON formatting
   - Syntax highlighting for properties
</requirements>

<implementation>
**Design Principles:**

1. **Web Components Best Practices:**
   - Extend HTMLElement, NOT framework components
   - Use attributeChangedCallback for reactive updates
   - Implement connectedCallback/disconnectedCallback for lifecycle
   - Use handleEvent pattern for memory-efficient event handling
   - Declarative Shadow DOM for encapsulation (if needed)

2. **State Management Pattern:**
   ```javascript
   class PropEditor extends HTMLElement {
     #state = { values: {}, dirty: false };

     handleEvent(event) {
       switch(event.type) {
         case 'field-change': this.#handleFieldChange(event);
         case 'monaco-change': this.#handleMonacoChange(event);
       }
     }

     #syncFormToMonaco() { /* update Monaco JSON */ }
     #syncMonacoToForm() { /* update form fields */ }
   }
   ```

3. **Data Flow:**
   - Single source of truth: <prop-editor>'s internal state
   - Form fields are "controlled components" (React pattern in vanilla JS)
   - Monaco editor is also controlled by <prop-editor>
   - Deep equality check prevents infinite update loops

4. **Why This Approach:**
   - Web Components: Native, no build step, framework-agnostic
   - handleEvent: Memory-efficient, better performance than arrow functions
   - Attribute-driven: Server can hydrate initial state easily
   - Custom events: Loose coupling, easy to extend

**What to Avoid:**
- ❌ NO React/Vue/Angular (Web Components only)
- ❌ NO npm/webpack (vanilla ES modules)
- ❌ NO querySelector inside components (pass refs via attributes if needed)
- ❌ NO innerHTML (security risk, breaks existing components)
- ❌ NO global state (encapsulate in <prop-editor>)
</implementation>

<output>
Create/modify these files:

1. `./website/assets/components/prop-editor.js` - Main editor component
2. `./website/assets/components/prop-field.js` - Field wrapper component
3. `./website/assets/components/index.js` - Register all components
4. `./website/src/core/schema_form.rs` - Update to wrap form in Web Components
5. `./website/src/pages/admin/schema_test.rs` - Include component scripts
6. `./website/assets/components/prop-editor.css` - Styling for dirty states, layout

All JavaScript must follow the web-components-architecture skill patterns.
All files should follow existing project conventions from @CLAUDE.md
</output>

<verification>
Before declaring complete, verify:

1. **Component Registration:**
   - Custom elements are registered: `customElements.define('prop-editor', PropEditor)`
   - No console errors on page load
   - Components appear in browser DevTools as custom elements

2. **Form → Monaco Sync:**
   - Type in a form input field
   - Monaco editor JSON updates in real-time
   - JSON structure matches schema (nested objects preserved)
   - No lag or debouncing issues

3. **Monaco → Form Sync:**
   - Edit JSON directly in Monaco (e.g., change "headline": "New Text")
   - Form field updates to show "New Text"
   - Works for nested properties (button.text)
   - Invalid JSON shows validation error (doesn't crash)

4. **Dirty State:**
   - Initially shows "No unsaved changes"
   - After editing, shows "Unsaved changes" indicator
   - Visual feedback (e.g., orange border on form)
   - Reverts to clean when reset() is called

5. **Browser Compatibility:**
   - Test in Chrome/Safari (Web Components support)
   - No framework dependencies in network tab
   - JavaScript follows javascript-pragmatic-rules (no memory leaks)

6. **Integration with Existing UI:**
   - Existing input/checkbox components still render correctly
   - Styles don't conflict
   - Server-rendered HTML hydrates properly
</verification>

<success_criteria>
- ✅ Web Components defined using Custom Elements v1 API
- ✅ 2-way binding works: Form ↔ Monaco JSON sync in real-time
- ✅ Dirty state tracking with visual indicator
- ✅ Zero framework dependencies (vanilla JS only)
- ✅ Follows web-components-architecture patterns (handleEvent, no querySelector)
- ✅ Test route demonstrates full interactivity with HeaderProps
- ✅ Code follows javascript-pragmatic-rules (memory-safe, performant)
</success_criteria>
