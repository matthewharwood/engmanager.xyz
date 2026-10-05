//! Class-bearing constructions cannot be inferred one literal piece at a time.
use oxc_ast::ast::{BinaryExpression, CallExpression, Expression, StringLiteral, TemplateLiteral};
use oxc_ast_visit::{Visit, walk};

/// DOMTokenList toggle's second argument is a boolean, not a class token.
pub fn class_list_argument(method: Option<&str>, index: usize) -> bool {
    match method {
        Some("toggle" | "contains") => index == 0,
        Some("replace") => index < 2,
        _ => true,
    }
}

/// True when an implicit DOM binding constructs unmanaged class identifiers.
/// Dynamic attribute/id-only selector values do not observe the CSS class map.
pub fn unmanaged_class_construction(expression: &Expression<'_>, class_list: bool) -> bool {
    if matches!(expression, Expression::StringLiteral(_))
        || matches!(expression, Expression::TemplateLiteral(value) if value.expressions.is_empty())
    {
        return false;
    }
    if let Expression::CallExpression(call) = expression
        && !compiled_composition(expression, class_list)
        && !matches!(&call.callee, Expression::StaticMemberExpression(member) if member.property.name == "getAttribute" && call.arguments.first().and_then(|argument| argument.as_expression()).is_some_and(|argument| matches!(argument, Expression::StringLiteral(value) if matches!(value.value.as_str(), "href" | "class"))))
    {
        return true;
    }
    let mut visitor = Construction {
        class_list,
        unmanaged: false,
        constructing: false,
        pin_dynamic: class_list || !attribute_or_id_prefix(expression),
    };
    visitor.visit_expression(expression);
    visitor.unmanaged
}

struct Construction {
    class_list: bool,
    unmanaged: bool,
    constructing: bool,
    pin_dynamic: bool,
}
impl<'a> Visit<'a> for Construction {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if let Expression::Identifier(callee) = &call.callee
            && matches!(
                callee.name.as_str(),
                "cssClasses" | "cssSelector" | "cssToken" | "cssHtml"
            )
        {
            return;
        }
        // Array/string joins can assemble names absent from every literal.
        if self.pin_dynamic
            && matches!(&call.callee, Expression::StaticMemberExpression(member) if member.property.name == "join")
        {
            self.unmanaged = true;
        }
        walk::walk_call_expression(self, call);
    }
    fn visit_string_literal(&mut self, value: &StringLiteral<'a>) {
        if self.constructing {
            self.inspect(value.value.as_str());
        }
    }
    fn visit_binary_expression(&mut self, value: &BinaryExpression<'a>) {
        let previous = self.constructing;
        if self.pin_dynamic
            && value.operator.as_str() == "+"
            && !(compiled_composition(&value.left, self.class_list)
                && compiled_composition(&value.right, self.class_list))
            && (self.class_list || !attribute_or_id_prefix(&value.left))
        {
            // Variable operands are as unsafe as literal fragments: foo + bar
            // may observe foobar even when no complete name occurs in source.
            self.unmanaged = true;
        }
        self.constructing |= value.operator.as_str() == "+";
        walk::walk_binary_expression(self, value);
        self.constructing = previous;
    }
    fn visit_template_literal(&mut self, value: &TemplateLiteral<'a>) {
        let previous = self.constructing;
        if self.pin_dynamic
            && !value.expressions.is_empty()
            && (self.class_list
                || !value
                    .quasis
                    .first()
                    .is_some_and(|quasi| attribute_prefix(quasi.value.raw.as_str())))
            && !(value
                .quasis
                .iter()
                .all(|quasi| quasi.value.raw.trim().is_empty())
                && value
                    .expressions
                    .iter()
                    .all(|expression| compiled_composition(expression, self.class_list)))
        {
            self.unmanaged = true;
        }
        self.constructing |= !value.expressions.is_empty();
        for quasi in &value.quasis {
            if self.constructing {
                self.inspect(
                    quasi
                        .value
                        .cooked
                        .as_ref()
                        .map_or(quasi.value.raw.as_str(), |value| value.as_str()),
                );
            }
        }
        walk::walk_template_literal(self, value);
        self.constructing = previous;
    }
}
impl Construction {
    fn inspect(&mut self, value: &str) {
        self.unmanaged |= if self.class_list {
            !value.trim().is_empty()
        } else {
            value.contains(['.', '\\']) || value.to_ascii_lowercase().contains("[class")
        };
    }
}

// Explicit compiled bindings compose safely with whitespace and attribute-only
// selector fragments. Other dynamic operands require a conservative namespace.
fn compiled_composition(value: &Expression<'_>, classes: bool) -> bool {
    match value {
        Expression::CallExpression(call) => {
            matches!(&call.callee, Expression::Identifier(name) if matches!(name.name.as_str(), "cssClasses" | "cssSelector" | "cssToken"))
        }
        Expression::StringLiteral(value) => {
            if classes {
                value.value.trim().is_empty()
            } else {
                !value.value.contains(['.', '\\'])
                    && !value.value.to_ascii_lowercase().contains("[class")
            }
        }
        Expression::TemplateLiteral(value) => {
            !classes
                && value
                    .quasis
                    .first()
                    .is_some_and(|quasi| attribute_prefix(quasi.value.raw.as_str()))
                && value.quasis.iter().all(|quasi| {
                    !quasi.value.raw.contains(['.', '\\'])
                        && !quasi.value.raw.to_ascii_lowercase().contains("[class")
                })
        }
        Expression::BinaryExpression(value) if value.operator.as_str() == "+" => {
            compiled_composition(&value.left, classes)
                && compiled_composition(&value.right, classes)
        }
        _ => false,
    }
}
fn attribute_or_id_prefix(value: &Expression<'_>) -> bool {
    match value {
        Expression::StringLiteral(value) => attribute_prefix(value.value.as_str()),
        Expression::BinaryExpression(value) if value.operator.as_str() == "+" => {
            attribute_or_id_prefix(&value.left)
        }
        Expression::TemplateLiteral(value) => value
            .quasis
            .first()
            .is_some_and(|quasi| attribute_prefix(quasi.value.raw.as_str())),
        _ => false,
    }
}

fn attribute_prefix(value: &str) -> bool {
    if value.starts_with('#') {
        return true;
    }
    value.find('[').is_some_and(|index| {
        value[..index].chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '*' | ':' | '|')
        }) && !value[index..].to_ascii_lowercase().starts_with("[class")
    })
}
