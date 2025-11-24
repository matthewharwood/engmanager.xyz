use crate::features::button::ButtonProps;
use crate::features::header::HeaderProps;

pub const NAME: &str = "header";

// Using static function instead of const to avoid "cannot call non-const method in constants" error
// Following rust-core-patterns for type-safe domain modeling
pub fn fixture() -> HeaderProps {
    HeaderProps {
        headline: "Sample Header Component".to_string(),
        button: ButtonProps {
            href: "https://www.google.com".to_string(),
            text: "Click Me".to_string(),
            aria_label: "Navigate to Google".to_string(),
        },
    }
}
