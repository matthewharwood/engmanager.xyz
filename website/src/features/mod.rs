/// Features module - Feature-based architecture
///
/// This module organizes code by feature (vertical slices) rather than by
/// technical layer (horizontal slices). Each feature is self-contained with
/// its own templates, styles, and scripts.
///
/// # Architecture Benefits
///
/// - **Cohesion**: Related code lives together
/// - **Modularity**: Features can be added/removed independently
/// - **Scalability**: Clear boundaries as the codebase grows
/// - **Separation of concerns**: Each feature owns its presentation layer
///
/// # Features
///
/// - **header**: Page header with headline and CTA button
/// - **hero**: Hero section with headline and subheadline
///
/// # Adding a New Feature
///
/// 1. Create directory: `src/features/my_feature/`
/// 2. Add props to `core/block.rs` (if block-based)
/// 3. Create template: `src/features/my_feature/template.rs`
/// 4. Create styles: `src/features/my_feature/styles.css`
/// 5. Create module: `src/features/my_feature/mod.rs`
/// 6. Add variant to `Block` enum (if block-based)
/// 7. Update render dispatcher in pages

pub mod header;
pub mod hero;
