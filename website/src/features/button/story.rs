use crate::features::button::ButtonProps;

pub const NAME: &str = "button";

// Using static function instead of const to avoid "cannot call non-const method in constants" error
// Following rust-core-patterns for type-safe domain modeling
pub fn fixture() -> ButtonProps {
    ButtonProps {
        href: "/example".to_string(),
        text: "Example Button".to_string(),
        aria_label: "Example button for demonstration".to_string(),
    }
}
