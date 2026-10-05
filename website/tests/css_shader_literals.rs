//! The shader pass must preserve GLSL tokens and every compiler source line.
#[path = "../build/shaders.rs"]
mod shaders;

use std::path::Path;

use oxc_allocator::Allocator;
use oxc_ast::ast::StringLiteral;
use oxc_ast_visit::{Visit, walk};
use oxc_parser::Parser;
use oxc_span::SourceType;

fn strings(source: &str) -> Vec<String> {
    struct Strings(Vec<String>);
    impl<'a> Visit<'a> for Strings {
        fn visit_string_literal(&mut self, value: &StringLiteral<'a>) {
            self.0.push(value.value.to_string());
            walk::walk_string_literal(self, value);
        }
    }
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, SourceType::default()).parse();
    assert!(parsed.errors.is_empty(), "{:?}", parsed.errors);
    let mut visitor = Strings(Vec::new());
    visitor.visit_program(&parsed.program);
    visitor.0
}

// Independent lexer: discard both comment forms and group GLSL identifiers,
// numbers and operators. It does not use the compactor's trimming algorithm.
fn tokens(shader: &str) -> Vec<(usize, String)> {
    let mut chars = shader.chars().peekable();
    let mut tokens = Vec::new();
    let mut line = 1;
    while let Some(character) = chars.next() {
        if character.is_whitespace() {
            line += usize::from(character == '\n');
            continue;
        }
        if character == '/' && chars.peek() == Some(&'/') {
            for next in chars.by_ref() {
                if next == '\n' {
                    line += 1;
                    break;
                }
            }
            continue;
        }
        if character == '/' && chars.peek() == Some(&'*') {
            chars.next();
            while let Some(next) = chars.next() {
                line += usize::from(next == '\n');
                if next == '*' && chars.peek() == Some(&'/') {
                    chars.next();
                    break;
                }
            }
            continue;
        }
        let mut token = character.to_string();
        if character.is_ascii_alphanumeric() || matches!(character, '_' | '.') {
            while chars
                .peek()
                .is_some_and(|next| next.is_ascii_alphanumeric() || matches!(next, '_' | '.'))
            {
                token.push(chars.next().unwrap());
            }
        } else if chars.peek().is_some_and(|next| {
            matches!(
                (character, *next),
                ('+' | '-' | '*' | '/' | '%' | '=' | '!' | '<' | '>', '=')
                    | ('+', '+')
                    | ('-', '-')
                    | ('&', '&')
                    | ('|', '|')
            )
        }) {
            token.push(chars.next().unwrap());
        }
        tokens.push((line, token));
    }
    tokens
}

#[test]
fn explicit_static_shader_keeps_tokens_lines_and_uniform_replacement() {
    let shader = "#version 300 es\n  // Author explanation\n\tuniform int u_scene;  \n\n  /* Preserve // block text */\n  void main() { float x = 1.0; // explanation\n    x += 2.0;\n  }  \n";
    let source = format!("const shader=glsl(`{shader}`);const other='glsl(`unchanged`)';");
    let compacted = shaders::compact_literals(&source, Path::new("shader.js"));
    let literals = strings(&compacted);
    let result = &literals[0];
    assert_eq!(tokens(shader), tokens(result));
    assert_eq!(shader.matches('\n').count(), result.matches('\n').count());
    assert!(result.starts_with("#version 300 es\n"));
    assert!(result.contains("uniform int u_scene;"));
    assert!(result.contains("/* Preserve // block text */"));
    assert!(!result.contains("Author explanation"));
    assert_eq!(literals[1], "glsl(`unchanged`)");
    assert!(result.len() < shader.len());
}

#[test]
fn runtime_expressions_member_calls_and_uncertain_preprocessing_are_preserved() {
    for source in [
        "const x=glsl(`#version 300 es\n${part}`);",
        "const x=object.glsl(`#version 300 es\n void main() {}`);",
        "const x=glsl?.(`#version 300 es\n void main() {}`);",
        "const x=glsl(`#version 300 es\n`, extra);",
        "const x=glsl('ordinary string');",
        "const x=glsl(`#version 300 es\n#define PART \\\\ \nnext`);",
        "const x=glsl(`#version 300 es\n#include \"path//file\"`);",
        "const x=glsl(`#version 300 es\n/* unfinished`);",
        "const x=glsl(`ordinary text`);",
    ] {
        assert_eq!(
            shaders::compact_literals(source, Path::new("shader.js")),
            source
        );
    }
}

#[test]
fn actual_authored_shader_literals_keep_all_tokens_and_line_numbers() {
    let source = include_str!("../js/src/article-heroes.js");
    let compacted = shaders::compact_literals(source, Path::new("article-heroes.js"));
    let original: Vec<_> = source
        .split("glsl(`")
        .skip(1)
        .map(|literal| literal.split("`)").next().unwrap())
        .collect();
    let emitted: Vec<_> = strings(&compacted)
        .into_iter()
        .filter(|literal| literal.starts_with("#version "))
        .collect();
    assert_eq!(original.len(), 2);
    assert_eq!(emitted.len(), original.len());
    for (before, after) in original.iter().zip(&emitted) {
        assert_eq!(tokens(before), tokens(after));
        assert_eq!(before.matches('\n').count(), after.matches('\n').count());
    }
    assert!(emitted[1].contains("uniform int u_scene;"));
    assert!(compacted.len() < source.len());
}
