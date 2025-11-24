<objective>
Implement a custom `<monaco-json-editor>` web component that wraps Monaco Editor, providing JSON syntax highlighting while maintaining a clean, imperative API for integration with the existing admin editor interface.

This component will replace the current jsonview implementation and serve as the foundation for backend integration in the next phase.
</objective>

<context>
Based on the research from `./research/monaco-editor-integration.md`, implement the Monaco Editor web component following the recommended approach.

**Project Context:**
- Location: @website/src/features/admin/editor/
- Rust backend serves static files via Axum ServeDir
- Must integrate with existing HTML structure
- Follows feature-based architecture

**Technical Requirements:**
- Custom web component (imperative pattern, not strict attribute-driven)
- Monaco Editor loaded and configured for JSON syntax highlighting
- Proper lifecycle management (initialization, cleanup)
- Exposes getValue() and setValue() methods for data access
- Emits CustomEvents when content changes
- Follows @.claude/skills/javascript-pragmatic-rules/ for code quality
</context>

<requirements>
Create a production-ready Monaco Editor web component with:

**Core Functionality:**
1. Custom element definition: `<monaco-json-editor>`
2. Monaco Editor initialization in connectedCallback
3. JSON language configuration and syntax highlighting
4. getValue() method to retrieve current JSON content
5. setValue(json) method to programmatically set content
6. CustomEvent emission on content changes ('content-changed')
7. Proper cleanup in disconnectedCallback

**Code Quality:**
- ES Private Fields (#field) for internal state
- async/await for any asynchronous operations
- AbortController for cleanup if needed
- Error handling with { cause: error } pattern
- Numbers 5+ digits use underscores (5_000)
- Single quotes for strings, backticks for templates
- Arrow functions by default
- Resource cleanup (removeEventListener, abort, etc.)

**Monaco Configuration:**
- JSON language mode
- Appropriate theme (vs-dark or vs-light)
- Minimal features (no IntelliSense, autocomplete yet)
- Reasonable default dimensions (100% width/height)
- Line numbers enabled
- Minimap optional (can be disabled)

**File Structure:**
- Monaco library loading (CDN or local per research)
- Web component definition
- Initialization logic
- API methods
- Event handling
- Cleanup logic
</requirements>

<implementation>
Follow this implementation approach:

1. **Read Research Document:**
   - Review `./research/monaco-editor-integration.md`
   - Follow the recommended loading strategy
   - Use the proposed web component structure

2. **Create Web Component File:**
   - Save to: `./website/src/features/admin/editor/components/monaco-editor.js`
   - Define custom element class
   - Implement all required methods and lifecycle callbacks

3. **Update HTML Integration:**
   - Modify the existing HTML file to use `<monaco-json-editor>`
   - Add Monaco library loading (script tags or ESM imports per research)
   - Ensure proper initialization order

4. **Add Styling if Needed:**
   - Update `./website/src/features/admin/editor/styles.css`
   - Ensure editor container has proper dimensions
   - Handle Monaco's default styles appropriately

5. **Create Example/Test Page:**
   - Optional: Create a simple test HTML file to verify component works
   - Should demonstrate getValue/setValue and event handling

**Code Structure Pattern:**
```javascript
class MonacoJsonEditor extends HTMLElement {
  #editor = null;
  #monaco = null;

  async connectedCallback() {
    // Initialize Monaco
    // Create editor instance
    // Set up event listeners
  }

  disconnectedCallback() {
    // Cleanup editor
    // Remove listeners
  }

  getValue() {
    // Return current JSON
  }

  setValue(json) {
    // Set JSON content
  }

  // Private methods with # prefix
}

customElements.define('monaco-json-editor', MonacoJsonEditor);
```
</implementation>

<output>
Create/modify the following files:

**Required:**
- `./website/src/features/admin/editor/components/monaco-editor.js`
  - Custom web component implementation
  - All lifecycle methods
  - Public API (getValue, setValue)
  - Event emission

**Update:**
- `./website/src/features/admin/editor/components/index.js`
  - Import and export the new component
  - Remove old jsonview imports if present

**Optional:**
- `./website/src/features/admin/editor/styles.css`
  - Add Monaco-specific styles if needed
  - Ensure container sizing works

**Documentation:**
- Update `./website/src/features/admin/editor/README.md`
  - Document the new Monaco component API
  - Provide usage examples
  - Note any breaking changes from jsonview
</output>

<success_criteria>
Implementation is complete when:
- ✓ `<monaco-json-editor>` custom element is defined
- ✓ Monaco Editor loads and displays correctly
- ✓ JSON syntax highlighting works
- ✓ getValue() returns current editor content
- ✓ setValue(json) programmatically sets content
- ✓ 'content-changed' event fires when user edits
- ✓ Component cleans up properly on disconnect
- ✓ Code follows javascript-pragmatic-rules skill
- ✓ All files are saved to correct locations
- ✓ README documents the API
</success_criteria>

<verification>
Before declaring complete, verify:

**Functionality:**
- Can create `<monaco-json-editor>` in HTML
- Editor renders with JSON syntax highlighting
- `getValue()` returns valid content
- `setValue('{"test": true}')` updates editor
- Content changes emit events
- No console errors on load/unload

**Code Quality:**
- ES Private Fields used (#editor, #monaco)
- Async operations use async/await
- Error handling includes { cause }
- Resource cleanup in disconnectedCallback
- Follows all javascript-pragmatic-rules

**Integration:**
- Component loads in the admin editor UI
- Static file serving works (Monaco library accessible)
- No conflicts with existing styles
- Performance is acceptable

Test by opening the admin editor page and verifying Monaco loads with syntax highlighting.
</verification>

<constraints>
**DO:**
- Use ES Private Fields for all internal state
- Follow async/await patterns (no .then())
- Implement proper resource cleanup
- Emit semantic CustomEvents
- Keep Monaco configuration minimal (just JSON highlighting)
- Handle errors gracefully

**DON'T:**
- Use var or let for constants
- Use .then() chains
- Forget to cleanup Monaco instance
- Add unnecessary Monaco features yet
- Break existing backend integration (that's next phase)
- Use innerHTML for dynamic content
</constraints>
