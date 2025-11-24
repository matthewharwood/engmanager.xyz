<objective>
Integrate the Monaco JSON editor web component with the existing Rust backend save mechanism, ensuring JSON content can be read from and written to the backend while maintaining the same functionality as the previous jsonview implementation.

This completes the Monaco Editor migration by establishing full read/write capabilities with the Rust backend.
</objective>

<context>
The Monaco web component from `./website/src/features/admin/editor/components/monaco-editor.js` is now implemented and provides:
- getValue() method to retrieve JSON
- setValue(json) method to set JSON
- 'content-changed' CustomEvent when user edits

**Backend Context:**
- Rust/Axum server handles JSON persistence
- Existing endpoints for reading/writing JSON (identified in research)
- Current implementation uses specific request/response formats

**Integration Points:**
From `./research/monaco-editor-integration.md`:
- Documented backend endpoints and data formats
- Existing save mechanism and event flow
- Request/response patterns to maintain

**Requirements:**
- Load initial JSON from backend into Monaco
- Save edited JSON back to backend
- Preserve existing save triggers (buttons, auto-save, etc.)
- Handle errors gracefully
- Provide user feedback (saving, saved, error states)
</context>

<requirements>
Implement complete backend integration with:

**Data Loading:**
1. Fetch initial JSON from backend on page load
2. Populate Monaco editor using setValue(json)
3. Handle loading states (show spinner/placeholder)
4. Handle fetch errors gracefully
5. Use AbortController for cancellable requests

**Data Saving:**
1. Capture save trigger (button click, auto-save, etc.)
2. Get current JSON using editor.getValue()
3. Validate JSON before sending (try/catch parse)
4. POST to backend save endpoint
5. Handle success/error responses
6. Update UI state (busy, saved, error)

**Error Handling:**
1. Network errors with { cause: error }
2. JSON parse errors (invalid syntax)
3. Backend validation errors
4. Timeout handling (5_000ms default)
5. User-friendly error messages

**Code Quality:**
- Follow @.claude/skills/javascript-pragmatic-rules/
- Use async/await (no .then())
- AbortController for request cancellation
- ES Private Fields for state
- Proper cleanup in disconnectedCallback
- CustomEvents for state changes
</requirements>

<implementation>
Follow this implementation strategy:

1. **Review Backend Integration:**
   - Read `./research/monaco-editor-integration.md` for endpoint details
   - Examine existing save mechanism in current editor
   - Identify request/response formats to maintain

2. **Create Integration Controller:**
   - File: `./website/src/features/admin/editor/components/editor-controller.js`
   - OR: Extend the monaco-editor.js component if simpler
   - Handles all backend communication
   - Manages loading/saving states

3. **Implement Data Flow:**
   ```javascript
   // On page load:
   async loadJSON() {
     const controller = new AbortController();
     const timeout = setTimeout(() => controller.abort(), 5_000);

     try {
       const response = await fetch('/api/json', {
         signal: controller.signal
       });
       clearTimeout(timeout);
       const data = await response.json();
       this.editor.setValue(JSON.stringify(data, null, 2));
     } catch (error) {
       // Handle with { cause: error }
     }
   }

   // On save:
   async saveJSON() {
     try {
       const json = this.editor.getValue();
       JSON.parse(json); // Validate

       const response = await fetch('/api/json', {
         method: 'POST',
         body: json,
         // ... other options
       });

       if (!response.ok) throw new Error('Save failed');
       // Emit 'save-success' event
     } catch (error) {
       // Emit 'save-error' event with { cause }
     }
   }
   ```

4. **Update UI Integration:**
   - Wire save button to saveJSON()
   - Add loading indicators
   - Display success/error messages
   - Handle unsaved changes warning if needed

5. **Test Full Cycle:**
   - Load page → JSON appears in Monaco
   - Edit JSON → save → verify backend updated
   - Reload page → see saved changes
   - Try invalid JSON → error handling works
   - Network error → graceful degradation
</implementation>

<output>
Create/modify the following files:

**Create (if needed):**
- `./website/src/features/admin/editor/components/editor-controller.js`
  - Backend communication logic
  - State management
  - Error handling

OR

**Extend:**
- `./website/src/features/admin/editor/components/monaco-editor.js`
  - Add loadJSON() and saveJSON() methods
  - Add backend communication
  - Keep component self-contained

**Update:**
- HTML file that uses the editor
  - Wire up save button
  - Add loading/success/error indicators
  - Handle initialization

**Update:**
- `./website/src/features/admin/editor/styles.css`
  - Add styles for loading states
  - Success/error message styling
  - Busy states (opacity, cursor, etc.)

**Documentation:**
- `./website/src/features/admin/editor/README.md`
  - Document backend integration
  - API endpoints used
  - Data flow diagram (text)
  - Error handling strategy
</output>

<success_criteria>
Integration is complete when:
- ✓ Page loads and populates Monaco with backend JSON
- ✓ User can edit JSON in Monaco
- ✓ Save button sends JSON to backend
- ✓ Backend confirms save success
- ✓ Reload shows saved changes
- ✓ Invalid JSON shows user-friendly error
- ✓ Network errors handled gracefully
- ✓ Loading states provide feedback
- ✓ AbortController cleans up pending requests
- ✓ All code follows javascript-pragmatic-rules
- ✓ README documents the integration
</success_criteria>

<verification>
Test the complete workflow:

**Happy Path:**
1. Start Rust server (should already be running)
2. Open admin editor page in browser
3. Verify JSON loads from backend into Monaco
4. Edit the JSON content
5. Click save button
6. Verify "Saving..." indicator appears
7. Verify "Saved!" success message
8. Reload page
9. Verify edited JSON persists

**Error Handling:**
1. Break JSON syntax (missing quote, comma)
2. Try to save
3. Verify error message shows
4. Fix JSON, save again
5. Verify success

**Network Errors:**
1. Stop Rust server
2. Try to save
3. Verify network error handled
4. Restart server
5. Save again
6. Verify recovery works

**Resource Cleanup:**
1. Load page (triggers fetch)
2. Immediately navigate away
3. Verify AbortController cancels request
4. Check browser network tab for aborted requests

**Console Check:**
- No errors in browser console
- No memory leaks (editor cleanup on page navigation)
- Appropriate logging for debugging
</verification>

<constraints>
**MUST:**
- Use AbortController for all fetch requests
- Include timeout (5_000ms) for backend calls
- Validate JSON with try/catch before sending
- Emit CustomEvents for state changes
- Clean up AbortController on disconnect
- Use { cause: error } when rethrowing
- Follow async/await patterns (no .then())

**MUST NOT:**
- Use .then() chains
- Forget to clear timeouts
- Send invalid JSON to backend
- Leave AbortControllers active after disconnect
- Use alert() for error messages
- Block UI during save (use visual feedback instead)

**ERROR MESSAGES:**
- Network error: "Unable to connect. Check your connection."
- Invalid JSON: "Invalid JSON syntax. Please fix errors."
- Backend error: "Save failed: [error message from server]"
- Timeout: "Request timed out. Please try again."
</constraints>

<edge_cases>
Consider and handle:
- Empty editor (what to save?)
- Very large JSON files (loading/saving time)
- Concurrent save attempts (prevent double-save)
- Page unload with unsaved changes (optional warning)
- Backend returns non-JSON response
- Backend validation errors (wrong schema)
</edge_cases>
