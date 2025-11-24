<objective>
Complete the Properties Panel integration by creating a split-view editor UI in /admin/features/{name}/ routes, implementing the publish workflow, and enabling end-to-end Block editing from the panel to the live homepage.

This phase brings together the schema-driven form renderer (Phase 1) and interactive Web Components (Phase 2) into a production-ready editing interface with persistence.

This enables users to edit Header and Hero blocks in the Properties Panel, publish changes to the backend, and immediately see updates reflected on the / route.
</objective>

<context>
**Previous Phase Deliverables:**
- Phase 1: Schema-driven form renderer with schemars integration
- Phase 2: Web Components (<prop-editor>, <prop-field>) with 2-way Monaco binding

**Current State:**
- Test route at /admin/schema-test/header demonstrates working form + Monaco sync
- /admin/features/{name}/ routes currently show component stories only
- No persistence layer for Block edits
- Homepage (/) renders static Block data

**End Goal (This Phase):**
Complete editing workflow:
1. Visit /admin/features/header/ → see split view (Properties Panel + Monaco)
2. Edit HeaderProps via form or JSON
3. Click "Publish" → saves to backend
4. Visit / → see updated Header block with new content

**Why This Matters:**
This completes the Properties Panel vision: a schema-driven, server-rendered editing interface that eliminates manual form coding while providing professional UX for content editing.
</context>

<requirements>
**Agent Invocation:**
Use @agent-graydon-rust-engineer with ALL available skills:
- axum-web-framework (route handlers, state management, JSON APIs)
- rust-core-patterns (type-safe domain modeling, newtype patterns)
- rust-error-handling (API error responses)
- maud-components-patterns (split-view layouts, component composition)
- web-components-architecture (publish button interaction)

**Technical Requirements:**

1. **Split-View UI for /admin/features/{name}/ Routes**
   - Left panel: Properties Panel (schema-driven form wrapped in <prop-editor>)
   - Right panel: Monaco JSON editor (existing setup)
   - Responsive layout using CSS Grid
   - Toolbar with:
     - "Publish" button (saves to backend)
     - "Reset" button (reverts to last saved state)
     - Dirty state indicator ("Unsaved changes")
   - Update existing admin/features.rs to render split view instead of story preview

2. **Backend API: Publish Endpoint**
   - Route: `POST /api/blocks/:block_type/publish`
   - Request body: Updated Block props as JSON
   - Validation:
     - Deserialize into proper Block variant (Header, Hero)
     - Validate using schemars schema
     - Return 400 Bad Request if invalid
   - Persistence:
     - For now, save to JSON file: `website/data/blocks/{block_type}.json`
     - Use BlockWithId wrapper (include UUID)
     - Atomic write (temp file + rename pattern)
   - Response: 200 OK with saved Block data
   - Error handling: Use rust-error-handling patterns

3. **Frontend: Publish Workflow**
   - "Publish" button click handler in <prop-editor>
   - Get current values via `getValue()` method
   - POST to /api/blocks/{block_type}/publish
   - Show loading state during request
   - On success:
     - Update initial-value attribute (mark as clean)
     - Show success toast/message
     - Emit 'prop-published' custom event
   - On error:
     - Show error message with validation details
     - Don't clear dirty state
   - Follow javascript-pragmatic-rules for async/await

4. **Homepage Integration**
   - Update / route handler to load blocks from JSON files
   - Read `website/data/blocks/header.json` and `hero.json`
   - Deserialize into Block enum variants
   - Render using existing render_block() function
   - Handle missing files gracefully (use defaults or show empty state)

5. **Route Updates**
   - Modify /admin/features/header/ to show Properties Panel for HeaderProps
   - Modify /admin/features/hero/ to show Properties Panel for HeroProps
   - Keep existing /admin/features/button/ and /admin/features/checkbox/ as component stories (not blocks)
   - Add navigation hint: "Editing [Block Type]" breadcrumb

6. **Data Directory Setup**
   - Create `website/data/blocks/` directory
   - Initialize with default blocks:
     - `header.json` - Default HeaderProps from story fixture
     - `hero.json` - Default HeroProps from story fixture
   - Add .gitignore entry for `website/data/` (or track with example data)
</requirements>

<implementation>
**Design Principles:**

1. **Split-View Layout (CSS Grid):**
   ```css
   .editor-container {
     display: grid;
     grid-template-columns: 1fr 1fr;
     grid-template-rows: auto 1fr;
     gap: var(--space-m);
     height: 100vh;
   }
   .toolbar { grid-column: 1 / -1; }
   .properties-panel { grid-column: 1; }
   .monaco-editor { grid-column: 2; }
   ```

2. **API Contract:**
   ```rust
   POST /api/blocks/header/publish
   Content-Type: application/json

   {
     "headline": "New headline text",
     "button": {
       "href": "/new-link",
       "text": "Click here",
       "aria_label": "Navigate to new page"
     }
   }

   Response: 200 OK
   {
     "id": "550e8400-e29b-41d4-a716-446655440000",
     "type": "Header",
     "props": { ... }
   }
   ```

3. **File Persistence Pattern:**
   ```rust
   // Atomic write to prevent corruption
   let temp_path = format!("website/data/blocks/.{}.tmp", block_type);
   write_to_file(&temp_path, json)?;
   std::fs::rename(&temp_path, &final_path)?;
   ```

4. **Why This Approach:**
   - Split view: Accommodates both visual and code-first users
   - JSON files: Simple persistence, easy to inspect/edit manually
   - Atomic writes: Prevents data corruption on crashes
   - Validation: Ensures only valid blocks are saved
   - Block-specific routes: Clean separation of editable vs component stories

**What to Avoid:**
- ❌ Don't use database yet (JSON files are fine for MVP)
- ❌ Don't add authentication yet (Phase 4 concern)
- ❌ Don't implement versioning/history yet (future enhancement)
- ❌ Don't auto-save (explicit publish action for now)
- ❌ Don't modify button/checkbox/input features (they stay as component stories)
</implementation>

<output>
Create/modify these files:

1. `./website/src/pages/admin/features.rs` - Update to render split view for Header/Hero
2. `./website/src/pages/api/blocks.rs` - New API module for publish endpoint
3. `./website/src/pages/api/mod.rs` - Export blocks module
4. `./website/src/pages/mod.rs` - Export api module
5. `./website/src/main.rs` - Add API routes to router
6. `./website/src/pages/index.rs` - Load blocks from JSON files
7. `./website/data/blocks/header.json` - Default header data
8. `./website/data/blocks/hero.json` - Default hero data
9. `./website/assets/components/prop-editor.js` - Add publish() method
10. `./website/assets/admin/editor-layout.css` - Split view styling
11. `./.gitignore` - Add website/data/ or track with examples

All files should follow existing project conventions from @CLAUDE.md
</output>

<verification>
Before declaring complete, verify:

1. **UI Integration:**
   - Visit /admin/features/header/ → sees split view layout
   - Properties Panel on left shows HeaderProps form
   - Monaco editor on right shows HeaderProps JSON
   - Toolbar has "Publish" and "Reset" buttons
   - Layout is responsive (no overflow issues)

2. **Edit Workflow:**
   - Edit "headline" field in form → Monaco updates
   - Edit "headline" in Monaco → form updates
   - Both sync correctly for nested fields (button.text)
   - Dirty state indicator shows "Unsaved changes"

3. **Publish Workflow:**
   - Click "Publish" button
   - POST request to /api/blocks/header/publish
   - Success response (200 OK)
   - Dirty state clears (shows "Saved")
   - File website/data/blocks/header.json updated with new data

4. **Homepage Reflection:**
   - Visit / route
   - Header block displays published content
   - Changes persist across browser refreshes
   - Multiple edits accumulate correctly

5. **Error Handling:**
   - Invalid JSON in Monaco → shows validation error
   - Missing required field → 400 Bad Request from API
   - Network error → shows user-friendly error message
   - File write errors logged server-side

6. **Both Block Types:**
   - Test with /admin/features/header/ (HeaderProps)
   - Test with /admin/features/hero/ (HeroProps)
   - Both persist independently to separate JSON files
   - Homepage renders both blocks correctly

7. **Non-Block Features:**
   - /admin/features/button/ still shows component story (not editor)
   - /admin/features/checkbox/ still shows component story
   - These routes unchanged (not editable blocks)
</verification>

<success_criteria>
- ✅ Split-view editor UI integrated into /admin/features/{name}/ routes
- ✅ Publish endpoint saves Block edits to JSON files with validation
- ✅ Homepage (/) loads and renders blocks from persisted JSON files
- ✅ Full editing workflow: Edit → Publish → See changes on /
- ✅ Works for both Header and Hero blocks independently
- ✅ Error handling for invalid data, network issues, file errors
- ✅ Code follows rust-error-handling and axum-web-framework patterns
- ✅ UI follows maud-components-patterns and web-components-architecture
</success_criteria>

<notes>
**Future Enhancements (Not Required Now):**
- Multi-user editing with conflict detection
- Block versioning and undo/redo
- Real-time collaboration with WebSockets
- Block preview mode (see changes before publish)
- Drag-and-drop block reordering
- Database persistence (PostgreSQL)
- Authentication and authorization

These can be added incrementally after the MVP is validated.
</notes>
