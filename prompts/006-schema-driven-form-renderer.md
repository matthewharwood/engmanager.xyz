<objective>
Build the backend foundation for a Server-Driven Properties Panel by implementing schema-to-form generation using schemars and Maud.

This phase creates the core infrastructure: automatic JSON Schema generation from Rust Block Props (HeaderProps, HeroProps) and a recursive rendering function that transforms schemas into HTML forms using the existing input/checkbox components.

This enables dynamic form generation where adding a field to a Rust struct automatically creates the corresponding form UI without touching frontend code.
</objective>

<context>
**Project Architecture:**
- Block system exists at @website/src/core/block.rs with HeaderProps and HeroProps
- Existing form components: @website/src/features/input/ and @website/src/features/checkbox/
- These components implement ComponentStory trait and have schema.rs with Props structs
- Current admin UI at /admin/features/{name}/ shows component stories

**End Goal (This Phase):**
Server-side form rendering that automatically generates HTML forms from JSON Schema, using the existing input/checkbox components as building blocks.

**Why This Matters:**
This is the foundation for a Properties Panel where form structure is defined entirely by Rust structs. Schema reflection eliminates manual form code and ensures the UI always matches the backend data model.
</context>

<requirements>
**Agent Invocation:**
Use @agent-graydon-rust-engineer with ALL available Rust skills:
- rust-core-patterns (trait-based abstraction, type-safe domain modeling)
- axum-web-framework (route handlers, state management)
- maud-components-patterns (recursive template functions)
- rust-error-handling (schema parsing errors)

**Technical Requirements:**

1. **Install & Configure schemars**
   - Add schemars dependency to Cargo.toml
   - Derive JsonSchema on HeaderProps, HeroProps, ButtonProps
   - Generate JSON Schema at compile time or runtime (agent decides based on performance)

2. **Schema-to-Form Renderer**
   - Create recursive function that traverses JSON Schema
   - Map schema types to form components:
     - `type: "string"` → InputProps (input component)
     - `type: "boolean"` → CheckboxProps (checkbox component)
     - `type: "object"` → Nested fieldset with recursive rendering
     - Handle required fields, descriptions, default values
   - Use Maud to render HTML form structure
   - Each field must have:
     - Label from schema property name (formatted: "buttonText" → "Button Text")
     - Input/checkbox component rendered via existing templates
     - Data attributes for property path (e.g., `data-path="button.text"`)

3. **Form Component Architecture**
   - Create `website/src/core/schema_form.rs` module:
     - Function: `generate_schema(props: &impl JsonSchema) -> serde_json::Value`
     - Function: `render_schema_form(schema: &serde_json::Value) -> Markup`
     - Helper: Format property names for labels
     - Helper: Extract nested object schemas
   - Follow rust-core-patterns for type safety

4. **Integration with Existing Components**
   - Reuse InputProps and CheckboxProps for field rendering
   - Import from features::input::template and features::checkbox::template
   - Ensure generated form fields match the visual style of existing components

5. **Test Route**
   - Create temporary test route: `GET /admin/schema-test/header`
   - Render HeaderProps schema as a form
   - Should display all fields: headline (string), button.href (string), button.text (string), button.aria_label (string)
   - Verify form structure in browser
</requirements>

<implementation>
**Design Principles:**

1. **Recursive Schema Traversal:**
   - Handle nested objects by recursively calling render function
   - Track property path for data attributes (e.g., "button.text")
   - Support arbitrary nesting depth

2. **Type Mapping Strategy:**
   ```
   JSON Schema Type → Component
   ─────────────────────────────
   string           → input (type="text")
   boolean          → checkbox
   object           → fieldset + recursive render
   number           → input (type="number")
   ```

3. **HTML Structure Pattern:**
   ```html
   <form class="schema-form">
     <fieldset>
       <legend>Property Name</legend>
       <!-- InputProps or CheckboxProps rendered here -->
     </fieldset>
   </form>
   ```

4. **Why This Approach:**
   - Schema-driven: Adding fields to Rust structs auto-updates UI
   - Type-safe: schemars ensures schema matches actual Props
   - Reusable: Existing components provide consistent styling
   - Server-rendered: No client-side framework needed for structure

**What to Avoid:**
- ❌ Don't create new input/checkbox components (reuse existing)
- ❌ Don't hardcode form fields (must be schema-driven)
- ❌ Don't add JavaScript yet (Phase 2 handles interactivity)
- ❌ Don't integrate with Monaco yet (Phase 3)
</implementation>

<output>
Create/modify these files:

1. `./website/Cargo.toml` - Add schemars dependency
2. `./website/src/core/schema_form.rs` - Schema rendering module
3. `./website/src/core/mod.rs` - Export schema_form module
4. `./website/src/features/header/schema.rs` - Add JsonSchema derive
5. `./website/src/features/hero/schema.rs` - Add JsonSchema derive
6. `./website/src/features/button/schema.rs` - Add JsonSchema derive
7. `./website/src/pages/admin/schema_test.rs` - Test route handler
8. `./website/src/pages/admin/mod.rs` - Export schema_test module
9. `./website/src/main.rs` - Add test route to router

All files should follow existing project conventions from @CLAUDE.md
</output>

<verification>
Before declaring complete, verify:

1. **Compilation:**
   - Run `cargo build` successfully
   - No clippy warnings: `cargo clippy --workspace -- -D warnings`

2. **Schema Generation:**
   - HeaderProps generates valid JSON Schema
   - Schema includes all fields: headline, button.href, button.text, button.aria_label
   - Nested button object is properly represented

3. **Form Rendering:**
   - Visit `/admin/schema-test/header` in browser
   - Form displays all HeaderProps fields
   - Input components use existing styling
   - Nested button fields are grouped in a fieldset
   - Each input has correct label and data-path attribute

4. **Reusability:**
   - The render_schema_form function can work with any JsonSchema type
   - Test with both HeaderProps and HeroProps

5. **Code Quality:**
   - Functions have doc comments explaining schema traversal logic
   - Error handling for malformed schemas
   - Type-safe throughout (no String-based field matching)
</verification>

<success_criteria>
- ✅ schemars integrated and generating schemas for all Block Props
- ✅ Recursive render_schema_form() function handles nested objects
- ✅ Test route displays HeaderProps as an HTML form with all fields
- ✅ Form uses existing input/checkbox components (consistent styling)
- ✅ Each field has data-path attribute for future JavaScript binding
- ✅ Code compiles with no warnings and follows project patterns
</success_criteria>
