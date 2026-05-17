## Preface

I've had this itch to build a Web Framework. Will I actually finish it? … probably not. But hey, posting about the journey keeps me moving, one tiny experiment at a time. If you want to contribute or get 1:1 mentorship, shoot me a DM and come learn with me! Okay, let's see where this goes!

## Inspiration

Jason Miller aka *DevelopIt* has been a big inspiration for me for a long time. His library [HTM](https://github.com/developit/htm) is the library that inspired this first step towards making a web framework.

What really got this idea going is a very recent video from Ryan Carniato, the author of SolidJS — a great watch prior to this lesson.

## Objectives

- Learn Rust
- Uncompromising Performance and DX Framework
- Low Code Tools

## Step one: `macro_rules!`

There are 2 types of macros in Rust: **declarative** and **procedural**. I'm not smart enough for procedural, yet. This contrived example below will use the declarative `macro_rules!` and later I'll do a follow-up on the more flexible and advanced procedural variant.

### Scaffold & Test

Been using the project name "Candy" and `htm` because of what I said above:

```bash
cargo new candy_htm --lib
cd candy_htm
```

Macros in Rust use the `!` suffix, and the `format!` macro is baked into the language for string formatting / interpolation.

```rust
pub fn htm_element(tag: &str, children: &str) -> String {
    format!("<{}>{}</{}>", tag, children, tag)
}
```

Rust comes with tests baked in. The syntax is a bit dense at a glance but easy enough to sus out:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn htm_element_test() {
        let result = htm_element("p", "Hello, World");
        assert_eq!(result, "<p>Hello, World</p>");
    }
}
```

Let's validate that the test works:

```bash
cargo test
```

### Creating a Macro

```rust
#[macro_export]
macro_rules! htm {
    (<$tag: ident> $content: literal </$end_tag: ident>) => {
        $crate::htm_element(stringify!($tag), $content)
    };
}

#[test]
fn htm_macro() {
    let x = htm!(<p>"hello world"</p>);
    assert_eq!(
        x,
        "<p>hello world</p>"
    )
}
```

There's a lot of syntax to unpack here, so let's go over it.

### The syntax

**Pattern matching.** The chunk below is a "pattern" that literally matches on the inner `htm!(<p>"hello world"</p>)`:

```rust
<$tag: ident> $content: literal </$end_tag: ident>
```

**Fragment specifiers.** You still must give each macro placeholder almost-"types" called *fragment specifiers* — `ident`, `literal`, `expr`, `tt`, `path`, and so on. There are a lot.

**`$crate`.** Next we need to point our now-matched macro and parsed tokens to the input of a function using the `$crate` syntax:

```rust
$crate::htm_element(stringify!($tag), $content)
```

`stringify!` turns a token into a string (e.g., `div` → `"div"`).

## Closing

I have like 10 more steps to go:

- Arbitrary Rust Expressions
- HTML Attributes
- Allow Nested HTML
- Tag Mismatch Safety
- Create Component-Like Functions
- Build an HTML Tree Struct
- Traits for Render-to-String
- Migrate to Procedural Macros
- Signals / Reactivity
