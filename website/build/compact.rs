//! Website adapter for the framework-independent Lightning CSS compact plugin.
//! All rewrites operate on explicit, parsed bindings. Unknown string references
//! reserve their class identifiers instead of being guessed or rewritten.
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use lightningcss::selector::SelectorList;
use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use lightningcss::traits::ParseWithOptions;
use lightningcss_compact::{
    BindingInput, BindingKind, CompiledProject, Mode, Options, ProjectInput, StylesheetInput,
};
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    AssignmentExpression, CallExpression, Expression, ObjectProperty, StringLiteral,
    TemplateLiteral,
};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::Parser;
use oxc_span::SourceType;
use proc_macro2::{TokenStream, TokenTree};

#[derive(Clone)]
struct JsReplacement {
    start: usize,
    end: usize,
    binding: String,
}
struct MarkdownSource {
    name: String,
    source: String,
    replacements: Vec<JsReplacement>,
}

#[path = "ast_inventory.rs"]
mod ast_inventory;
#[path = "inventory.rs"]
mod inventory;
use ast_inventory::{class_list_argument, unmanaged_class_construction};
use inventory::{
    css_classes, html_class_ranges, html_script_ranges, markdown_inventory, reserve_unknown,
};

pub struct Adapter {
    pub input: ProjectInput,
    rust: BTreeMap<(String, String), String>,
    js: BTreeMap<PathBuf, Vec<JsReplacement>>,
    markdown: Vec<MarkdownSource>,
    html_literals: BTreeMap<String, (String, Vec<JsReplacement>)>,
    fixed: BTreeMap<String, String>,
}

impl Adapter {
    pub fn collect(css: &[(PathBuf, String)], js: &[PathBuf]) -> Self {
        println!("cargo:rerun-if-changed=src");
        println!("cargo:rerun-if-changed=tests");
        println!("cargo:rerun-if-changed=articles");
        println!("cargo:rerun-if-changed=build/compact.rs");
        println!("cargo:rerun-if-changed=build/inventory.rs");
        println!("cargo:rerun-if-changed=build/ast_inventory.rs");
        println!("cargo:rerun-if-env-changed=ENG_CSS_MODE");
        let mut adapter = Self {
            input: ProjectInput {
                complete_usage: true,
                ..Default::default()
            },
            rust: BTreeMap::new(),
            js: BTreeMap::new(),
            markdown: Vec::new(),
            html_literals: BTreeMap::new(),
            fixed: BTreeMap::new(),
        };
        let mut classes = BTreeSet::new();
        for (path, id) in css {
            let source =
                fs::read_to_string(path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
            classes.extend(css_classes(&source));
            adapter.input.stylesheets.push(StylesheetInput {
                id: id.clone(),
                source,
            });
        }
        // Each asset remains an independent loading boundary. The page's Head
        // collector still owns its delivery order; compilation never combines
        // these independently loaded sheets into a synthetic global sheet.
        adapter
            .input
            .load_groups
            .extend(css.iter().map(|(_, id)| vec![id.clone()]));
        adapter.input.managed_classes = classes.clone();
        // Third-party engines own these namespaces, including dynamically
        // injected Mermaid/MapLibre classes and immutable assessment releases.
        adapter.input.reserved_prefixes = vec![
            "maplibregl-".into(),
            "mermaid-".into(),
            "language-".into(),
            "hljs-".into(),
            "katex-".into(),
        ];
        adapter.input.reserved_classes.extend([
            "mermaid".into(),
            "node".into(),
            "edge".into(),
            "label".into(),
            "clusters".into(),
            "root".into(),
        ]);
        for path in files(Path::new("assets/personality/v7"), "css") {
            let source = fs::read_to_string(path).expect("read immutable assessment stylesheet");
            adapter.input.reserved_classes.extend(css_classes(&source));
        }
        // Self-contained error documents have their own unchanged inline CSS.
        let error_html = fs::read_to_string("src/pages/server_error.html")
            .expect("read independent error document");
        for (start, end) in html_class_ranges(&error_html) {
            adapter.input.reserved_classes.extend(
                error_html[start..end]
                    .split_ascii_whitespace()
                    .map(str::to_owned),
            );
        }
        for path in files(Path::new("src"), "rs")
            .into_iter()
            .chain(files(Path::new("tests"), "rs"))
        {
            let source = fs::read_to_string(&path).expect("read Rust source");
            let tokens: TokenStream = source
                .parse()
                .unwrap_or_else(|e| panic!("parse bindings {}: {e}", path.display()));
            adapter.rust_tokens(tokens, &path, &classes);
        }
        for path in js {
            let source = fs::read_to_string(path).expect("read JavaScript source");
            let allocator = Allocator::default();
            let parsed = Parser::new(
                &allocator,
                &source,
                SourceType::from_path(path).unwrap_or_default(),
            )
            .parse();
            assert!(
                parsed.errors.is_empty(),
                "parse bindings {}: {:?}",
                path.display(),
                parsed.errors
            );
            let mut visitor = JsBindings {
                adapter: &mut adapter,
                path,
                classes: &classes,
                replacements: Vec::new(),
            };
            visitor.visit_program(&parsed.program);
            let replacements = visitor.replacements;
            adapter.js.insert(path.clone(), replacements);
        }
        for path in files(Path::new("articles"), "md") {
            let source = fs::read_to_string(&path).expect("read Markdown source");
            let name = path.file_name().unwrap().to_string_lossy().into_owned();
            let mut replacements = Vec::new();
            let (html_ranges, heading_classes) = markdown_inventory(&source);
            adapter.input.reserved_classes.extend(heading_classes);
            for range in html_ranges {
                let id = format!("markdown:{name}:{}", range.start);
                adapter.add(
                    id.clone(),
                    BindingKind::Html,
                    source[range.clone()].to_owned(),
                );
                replacements.push(JsReplacement {
                    start: range.start,
                    end: range.end,
                    binding: id,
                });
            }
            adapter.markdown.push(MarkdownSource {
                name,
                source,
                replacements,
            });
        }
        // Binding-only class tokens must never collide with generated names.
        // Existing JS selectors may intentionally name an unstyled hook.
        for binding in &adapter.input.bindings {
            if matches!(binding.kind, BindingKind::Classes | BindingKind::Token) {
                for name in binding.value.split_ascii_whitespace() {
                    if !classes.contains(name) {
                        adapter.input.reserved_classes.insert(name.into());
                    }
                }
            }
        }
        adapter
    }

    fn add(&mut self, id: String, kind: BindingKind, value: String) {
        if kind == BindingKind::Selector
            && (SelectorList::parse_string_with_options(&value, ParserOptions::default()).is_err()
                || StyleSheet::parse(&format!("{value}{{}}"), ParserOptions::default()).is_err())
        {
            // A literal segment of a dynamically assembled selector is not a
            // complete selector. Keep it literal and reserve any owned names.
            reserve_unknown(
                &value,
                &self.input.managed_classes,
                &mut self.input.reserved_classes,
            );
            self.fixed.insert(id, value);
            return;
        }
        if kind == BindingKind::Token {
            self.input
                .dynamic_classes
                .extend(value.split_ascii_whitespace().map(str::to_owned));
        }
        self.input.bindings.push(BindingInput { id, kind, value });
    }

    fn rust_tokens(&mut self, stream: TokenStream, path: &Path, classes: &BTreeSet<String>) {
        let tokens: Vec<_> = stream.into_iter().collect();
        let mut index = 0;
        while index < tokens.len() {
            if let (
                Some(TokenTree::Ident(name)),
                Some(TokenTree::Punct(bang)),
                Some(TokenTree::Group(args)),
            ) = (
                tokens.get(index),
                tokens.get(index + 1),
                tokens.get(index + 2),
            ) && bang.as_char() == '!'
            {
                let macro_name = name.to_string();
                if let Some(kind) = rust_kind(&macro_name) {
                    let literal = syn::parse2::<syn::LitStr>(args.stream()).unwrap_or_else(|_| {
                        panic!(
                            "{}:{}: {macro_name}! requires exactly one string literal",
                            path.display(),
                            name.span().start().line
                        )
                    });
                    let value = literal.value();
                    let id = format!(
                        "rust:{}:{}:{}",
                        path.display(),
                        name.span().start().line,
                        name.span().start().column
                    );
                    self.rust
                        .entry((macro_name.clone(), args.stream().to_string()))
                        .or_insert_with(|| id.clone());
                    if macro_name == "css_html" {
                        let mut replacements = Vec::new();
                        for (start, end) in html_class_ranges(&value) {
                            let class_value = &value[start..end];
                            if class_value.contains(['{', '&', '\\']) {
                                self.input.reserved_classes.extend(classes.iter().cloned());
                                continue;
                            }
                            let class_id = format!("{id}:html:{start}");
                            self.add(
                                class_id.clone(),
                                BindingKind::Classes,
                                class_value.to_owned(),
                            );
                            replacements.push(JsReplacement {
                                start,
                                end,
                                binding: class_id,
                            });
                        }
                        for (start, end) in html_script_ranges(&value) {
                            let javascript = &value[start..end];
                            let allocator = Allocator::default();
                            let parsed =
                                Parser::new(&allocator, javascript, SourceType::mjs()).parse();
                            assert!(
                                parsed.errors.is_empty(),
                                "{}:{} inline fixture JavaScript: {:?}",
                                path.display(),
                                name.span().start().line,
                                parsed.errors
                            );
                            let mut visitor = JsSemantics {
                                adapter: self,
                                classes,
                                prefix: format!("{id}:script:{start}"),
                                offset: start,
                                kind: None,
                                replacements: Vec::new(),
                            };
                            visitor.visit_program(&parsed.program);
                            replacements.extend(visitor.replacements);
                        }
                        replacements.sort_by_key(|replacement| replacement.start);
                        self.html_literals.insert(id, (value, replacements));
                    } else {
                        self.add(id, kind, value);
                    }
                    index += 3;
                    continue;
                }
            }
            match &tokens[index] {
                TokenTree::Group(group) => self.rust_tokens(group.stream(), path, classes),
                TokenTree::Literal(literal) if path.starts_with("src") => {
                    if let Ok(value) = syn::parse_str::<syn::LitStr>(&literal.to_string()) {
                        reserve_unknown(&value.value(), classes, &mut self.input.reserved_classes);
                    }
                }
                _ => {}
            }
            index += 1;
        }
    }

    pub fn compile(&self) -> CompiledProject {
        let mode = match std::env::var("ENG_CSS_MODE").as_deref() {
            Ok("baseline") => Mode::Baseline,
            Ok("naming") => Mode::Naming,
            Ok("compact") | Err(_) => Mode::Compact,
            Ok(other) => panic!("ENG_CSS_MODE must be baseline, naming, or compact; got {other}"),
        };
        lightningcss_compact::compile_project(
            self.input.clone(),
            Options {
                mode,
                ..Default::default()
            },
        )
        .unwrap_or_else(|e| panic!("compact CSS project: {e}"))
    }

    pub fn emit(&self, compiled: &CompiledProject, out: &Path) {
        let mut macros = String::from("// @generated: literal-only compile-time CSS bindings.\n");
        for name in ["classes", "selector", "token", "css_html"] {
            macros.push_str(&format!("#[macro_export]\nmacro_rules! {name} {{\n"));
            for ((kind, value), id) in &self.rust {
                if kind == name {
                    let output = if let Some((source, replacements)) = self.html_literals.get(id) {
                        let mut output = source.clone();
                        for replacement in replacements.iter().rev() {
                            let transformed = self
                                .fixed
                                .get(&replacement.binding)
                                .unwrap_or_else(|| &compiled.bindings[&replacement.binding]);
                            let value = if replacement.binding.contains(":script:") {
                                serde_json::to_string(transformed).unwrap()
                            } else {
                                transformed.clone()
                            };
                            output.replace_range(replacement.start..replacement.end, &value);
                        }
                        output
                    } else {
                        self.fixed
                            .get(id)
                            .unwrap_or_else(|| &compiled.bindings[id])
                            .clone()
                    };
                    macros.push_str(&format!("    ({value}) => {{ {:?} }};\n", output));
                }
            }
            macros.push_str(&format!("    ($other:literal) => {{ compile_error!(\"unknown {name}! binding; rebuild after adding a literal binding\") }};\n}}\n"));
        }
        macros.push_str(&format!(
            "pub const CSS_GENERATION: &str = {:?};\n",
            compiled.manifest.generation
        ));
        fs::write(out.join("compact_bindings.rs"), macros).expect("write CSS bindings");
        fs::write(
            out.join("css-compact-input.json"),
            serde_json::to_vec_pretty(&self.input).unwrap(),
        )
        .expect("write compact inventory");
        fs::write(
            out.join("css-compact-output.json"),
            serde_json::to_vec_pretty(compiled).unwrap(),
        )
        .expect("write compact output");
        let dir = out.join("compiled-articles");
        if dir.exists() {
            fs::remove_dir_all(&dir).expect("reset compiled Markdown");
        }
        fs::create_dir_all(&dir).expect("create compiled Markdown directory");
        for markdown in &self.markdown {
            let mut text = markdown.source.clone();
            for replacement in markdown.replacements.iter().rev() {
                text.replace_range(
                    replacement.start..replacement.end,
                    &compiled.bindings[&replacement.binding],
                );
            }
            fs::write(dir.join(&markdown.name), text).expect("write compiled Markdown");
        }
    }

    pub fn javascript(&self, path: &Path, source: &str, compiled: &CompiledProject) -> String {
        let mut text = source.to_owned();
        if let Some(replacements) = self.js.get(path) {
            for replacement in replacements.iter().rev() {
                text.replace_range(
                    replacement.start..replacement.end,
                    &serde_json::to_string(
                        self.fixed
                            .get(&replacement.binding)
                            .unwrap_or_else(|| &compiled.bindings[&replacement.binding]),
                    )
                    .unwrap(),
                );
            }
        }
        text
    }
}

fn rust_kind(name: &str) -> Option<BindingKind> {
    match name {
        "classes" => Some(BindingKind::Classes),
        "selector" => Some(BindingKind::Selector),
        "token" => Some(BindingKind::Token),
        "css_html" => Some(BindingKind::Html),
        _ => None,
    }
}
fn js_kind(name: &str) -> Option<BindingKind> {
    match name {
        "cssClasses" => Some(BindingKind::Classes),
        "cssSelector" => Some(BindingKind::Selector),
        "cssToken" => Some(BindingKind::Token),
        "cssHtml" => Some(BindingKind::Html),
        _ => None,
    }
}

struct JsBindings<'a> {
    adapter: &'a mut Adapter,
    path: &'a Path,
    classes: &'a BTreeSet<String>,
    replacements: Vec<JsReplacement>,
}
impl<'a> Visit<'a> for JsBindings<'_> {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if let Expression::Identifier(callee) = &call.callee
            && let Some(kind) = js_kind(callee.name.as_str())
        {
            assert_eq!(
                call.arguments.len(),
                1,
                "{}: {} requires one literal",
                self.path.display(),
                callee.name
            );
            let value = match call.arguments[0].as_expression() {
                Some(Expression::StringLiteral(value)) => value.value.to_string(),
                Some(Expression::TemplateLiteral(value)) if value.expressions.is_empty() => value
                    .quasis[0]
                    .value
                    .cooked
                    .as_ref()
                    .expect("cooked CSS literal")
                    .to_string(),
                _ => panic!(
                    "{}:{}: {} requires a static string literal",
                    self.path.display(),
                    call.span.start,
                    callee.name
                ),
            };
            let id = format!("javascript:{}:{}", self.path.display(), call.span.start);
            self.adapter.add(id.clone(), kind, value);
            self.replacements.push(JsReplacement {
                start: call.span.start as usize,
                end: call.span.end as usize,
                binding: id,
            });
            return;
        }
        let method = call
            .callee
            .get_member_expr()
            .and_then(|member| member.static_property_name());
        let token = call.callee.get_member_expr().is_some_and(|member| {
            member
                .object()
                .get_member_expr()
                .is_some_and(|object| object.static_property_name() == Some("classList"))
        });
        for (index, argument) in call.arguments.iter().enumerate() {
            let class_list = (token && class_list_argument(method, index)) || (method == Some("setAttribute") && index == 1 && call.arguments[0].as_expression().is_some_and(|value| matches!(value, Expression::StringLiteral(value) if value.value == "class")));
            let selector = index == 0
                && matches!(
                    method,
                    Some("querySelector" | "querySelectorAll" | "matches" | "closest")
                );
            if (class_list || selector)
                && (matches!(argument, oxc_ast::ast::Argument::SpreadElement(_))
                    || argument
                        .as_expression()
                        .is_some_and(|value| unmanaged_class_construction(value, class_list)))
            {
                println!(
                    "cargo:warning={} byte {}: unmanaged constructed DOM class reference preserves the class namespace",
                    self.path.display(),
                    call.span.start
                );
                self.adapter
                    .input
                    .reserved_classes
                    .extend(self.classes.iter().cloned());
            }
        }
        walk::walk_call_expression(self, call);
    }
    fn visit_assignment_expression(&mut self, assignment: &AssignmentExpression<'a>) {
        if assignment
            .left
            .as_member_expression()
            .and_then(|member| member.static_property_name())
            == Some("className")
            && unmanaged_class_construction(&assignment.right, true)
        {
            self.adapter
                .input
                .reserved_classes
                .extend(self.classes.iter().cloned());
        }
        walk::walk_assignment_expression(self, assignment);
    }
    fn visit_string_literal(&mut self, value: &StringLiteral<'a>) {
        reserve_unknown(
            value.value.as_str(),
            self.classes,
            &mut self.adapter.input.reserved_classes,
        );
    }
    fn visit_template_literal(&mut self, value: &TemplateLiteral<'a>) {
        for quasi in &value.quasis {
            reserve_unknown(
                quasi.value.raw.as_str(),
                self.classes,
                &mut self.adapter.input.reserved_classes,
            );
            if let Some(cooked) = &quasi.value.cooked {
                reserve_unknown(
                    cooked.as_str(),
                    self.classes,
                    &mut self.adapter.input.reserved_classes,
                );
            }
        }
        walk::walk_template_literal(self, value);
    }
}

pub fn files(root: &Path, extension: &str) -> Vec<PathBuf> {
    let mut result = Vec::new();
    if root.exists() {
        for entry in fs::read_dir(root).expect("read source directory") {
            let path = entry.expect("read source entry").path();
            if path.is_dir() {
                result.extend(files(&path, extension));
            } else if path.extension().and_then(|x| x.to_str()) == Some(extension) {
                result.push(path);
            }
        }
    }
    result.sort();
    result
}

struct JsSemantics<'a> {
    adapter: &'a mut Adapter,
    classes: &'a BTreeSet<String>,
    prefix: String,
    offset: usize,
    kind: Option<BindingKind>,
    replacements: Vec<JsReplacement>,
}
impl<'a> Visit<'a> for JsSemantics<'_> {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        let old = self.kind;
        let method = call
            .callee
            .get_member_expr()
            .and_then(|member| member.static_property_name());
        let token = call.callee.get_member_expr().is_some_and(|member| {
            member
                .object()
                .get_member_expr()
                .is_some_and(|object| object.static_property_name() == Some("classList"))
        });
        self.kind = None;
        self.visit_expression(&call.callee);
        for (index, argument) in call.arguments.iter().enumerate() {
            self.kind = if token && class_list_argument(method, index) {
                Some(BindingKind::Token)
            } else if method == Some("setAttribute")
                && index == 1
                && call.arguments[0].as_expression().is_some_and(|value| matches!(value, Expression::StringLiteral(value) if value.value == "class"))
            {
                Some(BindingKind::Classes)
            } else if index == 0
                && (matches!(
                    method,
                    Some("querySelector" | "querySelectorAll" | "matches" | "closest")
                ) || matches!(call.callee_name(), Some("query" | "click" | "$")))
            {
                Some(BindingKind::Selector)
            } else {
                None
            };
            if self.kind.is_some()
                && (matches!(argument, oxc_ast::ast::Argument::SpreadElement(_))
                    || argument.as_expression().is_some_and(|value| {
                        unmanaged_class_construction(
                            value,
                            self.kind != Some(BindingKind::Selector),
                        )
                    }))
            {
                println!(
                    "cargo:warning={} byte {}: unmanaged inline script class construction preserves the class namespace",
                    self.prefix, call.span.start
                );
                self.adapter
                    .input
                    .reserved_classes
                    .extend(self.classes.iter().cloned());
                continue;
            }
            self.visit_argument(argument);
        }
        self.kind = old;
    }
    fn visit_assignment_expression(&mut self, assignment: &AssignmentExpression<'a>) {
        let old = self.kind;
        self.kind = assignment
            .left
            .as_member_expression()
            .and_then(|member| member.static_property_name())
            .filter(|name| *name == "className")
            .map(|_| BindingKind::Classes);
        if self.kind.is_some() && unmanaged_class_construction(&assignment.right, true) {
            self.adapter
                .input
                .reserved_classes
                .extend(self.classes.iter().cloned());
            self.kind = old;
            return;
        }
        self.visit_expression(&assignment.right);
        self.kind = old;
    }
    fn visit_object_property(&mut self, property: &ObjectProperty<'a>) {
        let old = self.kind;
        self.kind = None;
        walk::walk_object_property(self, property);
        self.kind = old;
    }
    fn visit_string_literal(&mut self, value: &StringLiteral<'a>) {
        let text = value.value.as_str();
        let contains_class = self
            .classes
            .iter()
            .any(|class| text.contains(&format!(".{class}")));
        let kind = self.kind.or_else(|| {
            (contains_class && (text.starts_with('.') || text.starts_with('#')))
                .then_some(BindingKind::Selector)
        });
        if let Some(kind) = kind {
            let start = value.span.start as usize + self.offset;
            let id = format!("{}:{start}", self.prefix);
            self.adapter.add(id.clone(), kind, text.to_owned());
            self.replacements.push(JsReplacement {
                start,
                end: value.span.end as usize + self.offset,
                binding: id,
            });
        }
    }
    fn visit_template_literal(&mut self, value: &TemplateLiteral<'a>) {
        let old = self.kind;
        self.kind = None;
        walk::walk_template_literal(self, value);
        self.kind = old;
    }
}
