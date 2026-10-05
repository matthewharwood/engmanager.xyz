//! The same AST construction guard executes in the real build adapter.
#[path = "../build/ast_inventory.rs"]
mod ast_inventory;
use oxc_allocator::Allocator;
use oxc_ast::ast::Statement;
use oxc_parser::Parser;
use oxc_span::SourceType;

fn guard(source: &str, classes: bool) -> bool {
    let allocator = Allocator::default();
    let source = format!("const binding = {source};");
    let parsed = Parser::new(&allocator, &source, SourceType::mjs()).parse();
    assert!(parsed.errors.is_empty());
    let Statement::VariableDeclaration(statement) = &parsed.program.body[0] else {
        panic!("expression fixture")
    };
    let expression = statement.declarations[0].init.as_ref().unwrap();
    ast_inventory::unmanaged_class_construction(expression, classes)
}
#[test]
fn implicit_constructed_classes_and_selectors_reserve_the_namespace() {
    assert!(guard("'foo' + 'bar'", true));
    assert!(guard("prefix + suffix", true));
    assert!(guard("constructName(prefix, suffix)", true));
    assert!(guard("constructSelector(prefix, suffix)", false));
    assert!(guard("prefix + suffix", false));
    assert!(guard("['foo', 'bar'].join('')", true));
    assert!(guard("['.', prefix, suffix].join('')", false));
    assert!(
        !guard("active ? '.foo' : '.bar'", false),
        "whole conditional literals remain independently bound"
    );
    assert!(guard("'.' + 'foo' + suffix", false));
    assert!(guard("`.foo${suffix}`", false));
    assert!(guard("`[CLASS~='${name}']`", false));
    assert!(guard("`foo${suffix}`", true));
    assert!(guard("`${prefix}${suffix}`", true));
    assert!(guard("`${prefix}${suffix}`", false));
    assert!(!guard("`script[data-config='${name}']`", false));
    assert!(!guard("link.getAttribute('href')", false));
    assert!(
        !guard("'foobar'", true),
        "complete literal has a parsed binding instead"
    );
    assert!(!guard("cssClasses('foo') + ' ' + cssToken('bar')", true));
    assert!(!guard("cssSelector('.foo') + `[data-id='${id}']`", false));
    assert!(
        !guard("`[data-id='${id}']`", false),
        "data attributes do not name CSS classes"
    );
}

#[test]
fn token_mutators_keep_boolean_controls_out_of_the_class_inventory() {
    assert!(ast_inventory::class_list_argument(Some("toggle"), 0));
    assert!(!ast_inventory::class_list_argument(Some("toggle"), 1));
    assert!(ast_inventory::class_list_argument(Some("replace"), 1));
    assert!(!ast_inventory::class_list_argument(Some("replace"), 2));
    assert!(ast_inventory::class_list_argument(Some("remove"), 2));
}
