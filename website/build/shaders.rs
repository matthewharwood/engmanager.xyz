//! Explicit, website-owned GLSL literal compaction before JavaScript minification.
//! The `glsl` authoring marker retains readable shader sources. Only static
//! templates are replaced; this is neither a GLSL optimizer nor a CSS feature.
use std::path::Path;

use oxc_allocator::Allocator;
use oxc_ast::ast::{CallExpression, Expression};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::Parser;
use oxc_span::SourceType;

pub fn compact_literals(source: &str, path: &Path) -> String {
    let allocator = Allocator::default();
    let parsed = Parser::new(
        &allocator,
        source,
        SourceType::from_path(path).unwrap_or_default(),
    )
    .parse();
    assert!(
        parsed.errors.is_empty(),
        "parse GLSL bindings {}: {:?}",
        path.display(),
        parsed.errors
    );
    let mut visitor = Literals::default();
    visitor.visit_program(&parsed.program);
    visitor.replacements.sort_unstable_by_key(|value| value.0);
    let mut output = source.to_owned();
    for (start, end, value) in visitor.replacements.into_iter().rev() {
        output.replace_range(start..end, &serde_json::to_string(&value).unwrap());
    }
    output
}

#[derive(Default)]
struct Literals {
    replacements: Vec<(usize, usize, String)>,
}

impl<'a> Visit<'a> for Literals {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if !call.optional
            && matches!(&call.callee, Expression::Identifier(name) if name.name == "glsl")
            && call.arguments.len() == 1
            && let Some(Expression::TemplateLiteral(template)) = call.arguments[0].as_expression()
            && template.expressions.is_empty()
            && template.quasis.len() == 1
            && let Some(value) = &template.quasis[0].value.cooked
            && let Some(compacted) = compact_glsl(value.as_str())
        {
            self.replacements
                .push((call.span.start as usize, call.span.end as usize, compacted));
            return;
        }
        walk::walk_call_expression(self, call);
    }
}

fn compact_glsl(source: &str) -> Option<String> {
    // Backslash-newline and quoted preprocessor operands need a fuller GLSL
    // preprocessor. Preserve them instead of changing continuation semantics.
    if !source.starts_with("#version ") || source.contains(['\\', '\r']) {
        return None;
    }
    let mut output = String::with_capacity(source.len());
    let mut chars = source.chars().peekable();
    let mut block = false;
    while let Some(character) = chars.next() {
        if block {
            output.push(character);
            if character == '*' && chars.peek() == Some(&'/') {
                output.push(chars.next().unwrap());
                block = false;
            }
        } else if character == '/' && chars.peek() == Some(&'*') {
            output.push(character);
            output.push(chars.next().unwrap());
            block = true;
        } else if character == '/' && chars.peek() == Some(&'/') {
            for character in chars.by_ref() {
                if character == '\n' {
                    output.push('\n');
                    break;
                }
            }
        } else if matches!(character, '\'' | '"') {
            return None;
        } else {
            output.push(character);
        }
    }
    if block {
        return None;
    }
    // Keep every newline, including empty/comment-only lines. Only horizontal
    // boundary whitespace is removed, so tokens and #version/uniform text stay
    // unchanged and compiler line numbers still refer to the authored source.
    let mut compacted = String::with_capacity(output.len());
    for line in output.split_inclusive('\n') {
        if let Some(body) = line.strip_suffix('\n') {
            compacted.push_str(body.trim_matches([' ', '\t']));
            compacted.push('\n');
        } else {
            compacted.push_str(line.trim_matches([' ', '\t']));
        }
    }
    Some(compacted)
}
