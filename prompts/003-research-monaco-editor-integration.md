<objective>
Research and analyze how to integrate Monaco Editor into the existing JSON editor at @website/src/features/admin/editor/, replacing the current jsonview implementation with a Monaco-based solution that maintains compatibility with the Rust backend.

This research will inform the implementation of a custom web component wrapper for Monaco Editor that provides JSON syntax highlighting while preserving the existing save/publish functionality.
</objective>

<context>
The project is a Rust web application (Axum-based) with a feature-based architecture where each feature contains its own HTML, CSS, and JavaScript. The admin editor currently uses jsonview for JSON editing and needs to be upgraded to Monaco Editor.

**Current Implementation:**
- Location: @website/src/features/admin/editor/
- Files: components/, styles.css, README.md
- Backend: Rust/Axum serving static files and handling JSON save operations

**Project Architecture:**
- Follows web component patterns defined in @.claude/skills/web-components-architecture/
- JavaScript best practices from @.claude/skills/javascript-pragmatic-rules/
- Static files served via Axum ServeDir middleware
- Feature-based organization: /features/[feature-name]/

**Integration Constraints:**
- Monaco can use imperative patterns (not strict attribute-driven)
- Must maintain compatibility with existing Rust backend save mechanism
- Should work as a drop-in replacement for current editor
- Syntax highlighting only (no schema validation, IntelliSense, etc. for now)
</context>

<research_requirements>
Thoroughly investigate and document the following:

1. **Current Editor Implementation:**
   - Read all files in @website/src/features/admin/editor/
   - Understand how jsonview is currently integrated
   - Identify how JSON data flows to/from the Rust backend
   - Document the save/publish mechanism (HTTP endpoints, event flow, etc.)
   - Note any dependencies or patterns that must be preserved

2. **Monaco Editor Integration Patterns:**
   - Research how Monaco Editor is typically integrated as a web component
   - Identify best practices for loading Monaco (CDN vs local, ESM vs AMD)
   - Document Monaco's initialization API and configuration options
   - Find minimal setup for JSON syntax highlighting
   - Research Monaco's destroy/cleanup patterns for proper resource management

3. **Web Component Wrapper Strategy:**
   - Analyze existing web components in the codebase for patterns
   - Determine optimal approach for wrapping Monaco imperatively
   - Identify lifecycle hooks needed (connectedCallback, disconnectedCallback)
   - Plan how to expose Monaco's getValue/setValue methods
   - Consider how to trigger save events when content changes

4. **Backend Integration Points:**
   - Examine Rust routes that handle JSON save operations
   - Identify request/response formats expected by backend
   - Document any authentication or validation requirements
   - Understand file serving configuration for static assets

5. **Potential Challenges:**
   - Monaco's AMD loader vs modern ESM modules
   - Monaco's size and loading performance
   - Shadow DOM compatibility (if used)
   - TypeScript definitions and build requirements
</research_requirements>

<deliverables>
Create a comprehensive research document saved to:
`./research/monaco-editor-integration.md`

The document must include:

**Section 1: Current Implementation Analysis**
- File structure and responsibilities
- Data flow diagram (text-based)
- Backend integration details
- Identified pain points or limitations

**Section 2: Monaco Integration Recommendations**
- Recommended loading strategy (CDN/local, ESM/AMD)
- Minimal configuration for JSON highlighting
- Code snippets showing basic Monaco setup
- Resource cleanup patterns

**Section 3: Web Component Design**
- Proposed custom element structure
- Lifecycle callbacks and their purposes
- API surface (methods, events)
- Integration points with existing code

**Section 4: Implementation Roadmap**
- Step-by-step plan for implementation
- Files to create/modify
- Testing strategy
- Rollback plan if issues arise

**Section 5: Open Questions**
- Any unresolved issues requiring decisions
- Trade-offs to consider
- Potential risks
</deliverables>

<implementation>
Use the following tools strategically:

1. **Read** all files in @website/src/features/admin/editor/ to understand current implementation
2. **Grep** for JSON-related endpoints in the Rust codebase
3. **WebSearch** for Monaco Editor web component integration patterns
4. **WebFetch** Monaco Editor documentation for API details

Think deeply about:
- How to make the transition seamless
- What existing patterns should be preserved vs changed
- How to minimize breaking changes
- What the user experience should be during the upgrade
</implementation>

<success_criteria>
Research is complete when:
- ✓ Current implementation is fully documented
- ✓ Monaco integration approach is clearly defined
- ✓ Backend integration points are identified
- ✓ Web component design is proposed with rationale
- ✓ Implementation roadmap provides clear next steps
- ✓ All open questions are documented
- ✓ Document is saved to ./research/monaco-editor-integration.md
</success_criteria>

<verification>
Before declaring complete, verify:
- All files in admin/editor/ have been examined
- Monaco Editor documentation has been consulted
- Backend save mechanism is understood
- Research document is comprehensive and actionable
- No critical questions remain unanswered (or they're documented in "Open Questions")
</verification>
