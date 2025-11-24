/// Features module - Feature-based architecture
///
/// This module organizes code by feature (vertical slices) rather than by
/// technical layer (horizontal slices). Each feature is self-contained with
/// its own schema, templates, styles, and scripts.
///
/// # Architecture Benefits
///
/// - **Cohesion**: Related code lives together
/// - **Modularity**: Features can be added/removed independently
/// - **Scalability**: Clear boundaries as the codebase grows
/// - **Separation of concerns**: Each feature owns its data shape and presentation
///
/// # Features
///
/// - **button**: Reusable button/link component (primitive)
/// - **header**: Page header with headline and CTA button
/// - **hero**: Hero section with headline and subheadline
///
/// # Story System
///
/// - **story**: ComponentStory trait for the component preview system
///
/// # Adding a New Feature
///
/// 1. Create directory: `src/features/my_feature/`
/// 2. Create schema: `src/features/my_feature/schema.rs` (define props)
/// 3. Create template: `src/features/my_feature/template.rs`
/// 4. Create styles: `src/features/my_feature/styles.css`
/// 5. Create module: `src/features/my_feature/mod.rs` (re-export schema and template)
/// 6. Add feature to this file: `pub mod my_feature;`
/// 7. (Optional) Implement ComponentStory trait in schema.rs for preview system
/// 8. Add variant to `Block` enum in `core/block.rs` (if block-based)
/// 9. Update render dispatcher in pages
pub mod button;
pub mod header;
pub mod hero;
pub mod story;
