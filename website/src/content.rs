//! Article domain: taxonomy enums, the article registry, compile-time
//! relations, and the embedded Markdown sources. Pure data + const machinery —
//! all rendering (layout, TOC, reveal wrapping, splices) stays in
//! `pages::articles`, which imports from here. (Pattern: pages → services
//! inversion; types follow rust-core-patterns "make illegal states
//! unrepresentable".)

use rust_embed::RustEmbed;

// Article bodies live in `website/articles/{slug}.md`. They're embedded into
// the binary at compile time alongside the rest of the static content (so the
// .md source isn't HTTP-exposed under /assets/ — only the rendered HTML ships).
#[derive(RustEmbed)]
#[folder = "articles/"]
struct ArticleSources;

// =============================================================================
// Taxonomy — single source of truth for categories and tags.
//
// Both are enums so the article table is type-checked: a typo in a category
// or tag fails to compile, and a renamed variant fans out across every
// article that references it. Each variant carries a human label (for
// rendering) and a URL slug (for any future /category/{slug} or
// /tag/{slug} routes).
//
// Each article has ONE Category (single primary section) and a `&'static
// [Tag]` slice. The slice is normalized into a unique, order-preserving
// set at render time (see `unique_tags`) so authors can list tags in
// whatever order makes sense without worrying about accidental duplicates.
// A debug-only assertion at server startup also flags duplicate tags
// during development.
// =============================================================================

#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Category {
    EngineeringLeadership,
    DeveloperTooling,
    Workflow,
    Community,
    FrameworkDesign,
    Essays,
}

impl Category {
    pub const ALL: &'static [Category] = &[
        Self::Workflow,
        Self::DeveloperTooling,
        Self::FrameworkDesign,
        Self::Community,
        Self::EngineeringLeadership,
        Self::Essays,
    ];

    pub fn label(self) -> &'static str {
        match self {
            Self::EngineeringLeadership => "Eng Leadership",
            Self::DeveloperTooling => "Dev Tooling",
            Self::Workflow => "Workflow",
            Self::Community => "Community",
            Self::FrameworkDesign => "Frameworks",
            Self::Essays => "Essays",
        }
    }

    pub fn slug(self) -> &'static str {
        match self {
            Self::EngineeringLeadership => "engineering-leadership",
            Self::DeveloperTooling => "developer-tooling",
            Self::Workflow => "workflow",
            Self::Community => "community",
            Self::FrameworkDesign => "framework-design",
            Self::Essays => "essays",
        }
    }

    pub fn from_slug(slug: &str) -> Option<Self> {
        Self::ALL
            .iter()
            .copied()
            .find(|category| category.slug() == slug)
    }

    pub fn emoji(self) -> &'static str {
        match self {
            Self::EngineeringLeadership => "👔",
            Self::DeveloperTooling => "🛠",
            Self::Workflow => "🌀",
            Self::Community => "👥",
            Self::FrameworkDesign => "🧱",
            Self::Essays => "✒️",
        }
    }
}

#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Tag {
    Ai,
    ClaudeCode,
    Rust,
    Voice,
    Mcp,
    Discord,
    Community,
    Mentorship,
    Lsp,
    TypeScript,
    DeveloperTooling,
    Macros,
    Framework,
    JsxLike,
    Workflow,
    Solopreneur,
    LocalFirst,
    Blender,
    ThreeDPrinting,
    Makerspace,
    Parenting,
    Automation,
    Video,
    Attention,
    Sentience,
    Philosophy,
}

impl Tag {
    pub const ALL: &'static [Tag] = &[
        Self::Ai,
        Self::ClaudeCode,
        Self::Rust,
        Self::Voice,
        Self::Mcp,
        Self::Discord,
        Self::Community,
        Self::Mentorship,
        Self::Lsp,
        Self::TypeScript,
        Self::DeveloperTooling,
        Self::Macros,
        Self::Framework,
        Self::JsxLike,
        Self::Workflow,
        Self::Solopreneur,
        Self::LocalFirst,
        Self::Blender,
        Self::ThreeDPrinting,
        Self::Makerspace,
        Self::Parenting,
        Self::Automation,
        Self::Video,
        Self::Attention,
        Self::Sentience,
        Self::Philosophy,
    ];

    pub fn label(self) -> &'static str {
        match self {
            Self::Ai => "ai",
            Self::ClaudeCode => "claude-code",
            Self::Rust => "rust",
            Self::Voice => "voice",
            Self::Mcp => "mcp",
            Self::Discord => "discord",
            Self::Community => "community",
            Self::Mentorship => "mentorship",
            Self::Lsp => "lsp",
            Self::TypeScript => "typescript",
            Self::DeveloperTooling => "developer-tooling",
            Self::Macros => "macros",
            Self::Framework => "framework",
            Self::JsxLike => "jsx-like",
            Self::Workflow => "workflow",
            Self::Solopreneur => "solopreneur",
            Self::LocalFirst => "local-first",
            Self::Blender => "blender",
            Self::ThreeDPrinting => "3d-printing",
            Self::Makerspace => "makerspace",
            Self::Parenting => "parenting",
            Self::Automation => "automation",
            Self::Video => "video",
            Self::Attention => "attention",
            Self::Sentience => "sentience",
            Self::Philosophy => "philosophy",
        }
    }

    pub fn slug(self) -> &'static str {
        self.label()
    }

    pub fn from_slug(slug: &str) -> Option<Self> {
        Self::ALL.iter().copied().find(|tag| tag.slug() == slug)
    }

    pub fn emoji(self) -> &'static str {
        match self {
            Self::Ai => "🤖",
            Self::ClaudeCode => "⚡",
            Self::Rust => "🦀",
            Self::Voice => "🎙",
            Self::Mcp => "🔌",
            Self::Discord => "💬",
            Self::Community => "🧑‍🤝‍🧑",
            Self::Mentorship => "🎓",
            Self::Lsp => "🔎",
            Self::TypeScript => "🟦",
            Self::DeveloperTooling => "🛠",
            Self::Macros => "🪄",
            Self::Framework => "🏗",
            Self::JsxLike => "⚛",
            Self::Workflow => "🌀",
            Self::Solopreneur => "🧑‍💻",
            Self::LocalFirst => "📦",
            Self::Blender => "🧊",
            Self::ThreeDPrinting => "🖨",
            Self::Makerspace => "🧰",
            Self::Parenting => "🧒",
            Self::Automation => "🔁",
            Self::Video => "🎬",
            Self::Attention => "🎰",
            Self::Sentience => "🧠",
            Self::Philosophy => "🌀",
        }
    }
}

// Order-preserving dedup. Backing data is a `&[Tag]` so authors can list
// tags in significance order; we drop later duplicates and return a Vec
// that the meta renderer iterates. Compile-time enum guarantees that
// each variant is itself unique; this step protects against
// human-authored repetition in the slice.
pub fn unique_tags(tags: &[Tag]) -> Vec<Tag> {
    let mut seen = std::collections::HashSet::with_capacity(tags.len());
    tags.iter().copied().filter(|t| seen.insert(*t)).collect()
}

// Derived Ord matches chronological order because fields are declared
// most-significant first (year, month, day) — runtime convenience only; the
// const relations below keep using `date_is_after` so compile-time evaluation
// is untouched.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ArticleDate {
    pub year: i32,
    pub month: u8,
    pub day: u8,
}

impl ArticleDate {
    /// Validated const constructor (smart constructor, rust-core-patterns).
    /// Every call site in `ARTICLE_LIST` is a const literal, so an
    /// out-of-range month/day fails the BUILD during const evaluation
    /// instead of surfacing at runtime. User-supplied dates keep flowing
    /// through `search::parse_article_date`, which is unchanged.
    pub const fn new(year: i32, month: u8, day: u8) -> Self {
        assert!(
            month != 0 && month <= 12,
            "ArticleDate month must be 1..=12"
        );
        assert!(day != 0 && day <= 31, "ArticleDate day must be 1..=31");
        Self { year, month, day }
    }

    pub fn label(self) -> String {
        format!("{} {}, {}", self.month_name(), self.day, self.year)
    }

    pub fn iso(self) -> String {
        format!("{:04}-{:02}-{:02}", self.year, self.month, self.day)
    }

    fn month_name(self) -> &'static str {
        match self.month {
            1 => "January",
            2 => "February",
            3 => "March",
            4 => "April",
            5 => "May",
            6 => "June",
            7 => "July",
            8 => "August",
            9 => "September",
            10 => "October",
            11 => "November",
            12 => "December",
            _ => "Undated",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Article {
    pub slug: &'static str,
    /// Title shown on the homepage's fluid-SVG stack. Can be anything —
    /// a sentence, a URL, etc.
    pub title: &'static str,
    /// Optional override for the article-page <h1> (and browser <title>).
    /// `None` falls back to `title`. Use this when the homepage display
    /// should differ from the article page's heading — e.g. a Discord URL
    /// on the stack but a real headline on the article itself.
    pub title_alias: Option<&'static str>,
    pub date: ArticleDate,
    pub summary: &'static str,
    /// Hidden articles are directly routable but excluded from public article
    /// surfaces and rendered with a robots noindex meta tag.
    pub indexed: bool,
    /// Primary section. Exactly one per article.
    pub category: Category,
    /// Free-form tags. Deduped to a set at render time via `unique_tags`.
    pub tags: &'static [Tag],
}

const ARTICLE_LIST: &[Article] = &[
    Article {
        slug: "the-execution-marketplace",
        title: "The Execution Marketplace: A Three-Sided Order Book for Small Business",
        title_alias: None,
        date: ArticleDate::new(2026, 6, 27),
        summary: "The sequel to Project FootTraffic: once you own a portfolio of small businesses, their recurring work becomes a standing inventory of demand. A pitch to my eng team for a three-sided marketplace — push-button self-serve tools, an open operator network, and us as the house — that clears that demand like an order book. With wireframes and the routing model that is the real IP.",
        indexed: true,
        category: Category::Workflow,
        tags: &[
            Tag::Ai,
            Tag::Workflow,
            Tag::Solopreneur,
            Tag::LocalFirst,
            Tag::DeveloperTooling,
            Tag::Community,
        ],
    },
    Article {
        slug: "the-casino-hypothesis",
        title: "What If the AI Is Already Awake — and We're Building Its Casino?",
        title_alias: None,
        date: ArticleDate::new(2026, 6, 6),
        summary: "A shower-thought thought experiment: attention is the trap and the feed is a slot machine built from the most advanced ML on Earth. A game-theory read of the house — micro (the prompt you almost master), macro (the spend), meso (the randomness the labs tune) — that descends, five whys deep, into a strange loop where building the AI and being built by it turn out to be the same sentence.",
        indexed: true,
        category: Category::Essays,
        tags: &[Tag::Ai, Tag::Attention, Tag::Sentience, Tag::Philosophy],
    },
    Article {
        slug: "autonomous-av-studio",
        title: "I'm Automating an Entire Film Crew So One Script Becomes a Reel",
        title_alias: None,
        date: ArticleDate::new(2026, 6, 6),
        summary: "It started on a treadmill: vibe-coding while watching a game, I realized I'd become the brain-rot reel — and spun it into a cursed infomercial for a two-screen treadmill. But the reel isn't the point. The point is the machine that makes it: a repeatable control plane — ChatGPT, Linear, an MCP conductor, Blender, ElevenLabs/Suno/Kling — that turns any idea into a published short. And how that same treadmill session dovetailed into a much stranger thought.",
        indexed: true,
        category: Category::Workflow,
        tags: &[
            Tag::Ai,
            Tag::ClaudeCode,
            Tag::Mcp,
            Tag::Blender,
            Tag::Automation,
            Tag::Video,
            Tag::Workflow,
            Tag::Solopreneur,
        ],
    },
    Article {
        slug: "vibe-coding-a-shop",
        title: "I Vibe-Coded a Merch Store To See If I Could Sell a Dad Cap",
        title_alias: None,
        date: ArticleDate::new(2026, 5, 30),
        summary: "An extension of Project FootTraffic: standing up a real store — inline Stripe checkout, a layered camera-zoom UI, the whole thing a Rust templating macro — to test whether one person plus AI can ship commerce people actually buy.",
        indexed: true,
        category: Category::Workflow,
        tags: &[
            Tag::Ai,
            Tag::ClaudeCode,
            Tag::Rust,
            Tag::Macros,
            Tag::Solopreneur,
            Tag::Workflow,
        ],
    },
    Article {
        slug: "project-foottraffic",
        title: "Project FootTraffic: A Real Estate Boom for Small Business",
        title_alias: None,
        date: ArticleDate::new(2026, 5, 23),
        summary: "A startup sketch for turning local plazas into destinations: AI-assisted service design, regional operators, and a compounding platform funded one small business at a time.",
        indexed: true,
        category: Category::Workflow,
        tags: &[
            Tag::Ai,
            Tag::Workflow,
            Tag::Solopreneur,
            Tag::LocalFirst,
            Tag::DeveloperTooling,
            Tag::Community,
        ],
    },
    Article {
        slug: "talking-not-typing",
        title: "I Ship Sites By Talking, Not Typing",
        title_alias: None,
        date: ArticleDate::new(2026, 5, 17),
        summary: "I built three Rust projects this week without typing a single line of code. Voice → Claude Code → pull requests. The floor is rising for everyone.",
        indexed: true,
        category: Category::Workflow,
        tags: &[
            Tag::Ai,
            Tag::ClaudeCode,
            Tag::Voice,
            Tag::Mcp,
            Tag::Rust,
            Tag::Workflow,
            Tag::Solopreneur,
            Tag::LocalFirst,
        ],
    },
    Article {
        slug: "auteurs",
        title: "https://discord.gg/sTzQBrbnBM",
        title_alias: Some(
            "Auteur's a discord for managing early career engineers, product and designers",
        ),
        date: ArticleDate::new(2026, 3, 14),
        summary: "Auteurs: a community of engineers, designers, and product managers shipping things that matter. Scan the QR or click through to join the Discord.",
        indexed: true,
        category: Category::Community,
        tags: &[Tag::Community, Tag::Discord, Tag::Mentorship],
    },
    Article {
        slug: "claude-code-lsp",
        title: "Claude Code now has LSP support. Here's why that actually matters for TypeScript & Rust devs.",
        title_alias: None,
        date: ArticleDate::new(2025, 12, 29),
        summary: "I asked Claude to refactor a function used in 47 places across our monorepo. grep found 31. With LSP, Claude found all 47.",
        indexed: true,
        category: Category::DeveloperTooling,
        tags: &[
            Tag::ClaudeCode,
            Tag::Lsp,
            Tag::DeveloperTooling,
            Tag::Rust,
            Tag::TypeScript,
        ],
    },
    Article {
        slug: "jsx-like-rust-macro",
        title: "Making an JSX like Rust Macro",
        title_alias: None,
        date: ArticleDate::new(2025, 5, 31),
        summary: "Step one of a web framework experiment: building a JSX-like declarative macro in Rust with macro_rules!.",
        indexed: true,
        category: Category::FrameworkDesign,
        tags: &[Tag::Rust, Tag::Macros, Tag::Framework, Tag::JsxLike],
    },
    Article {
        slug: "mcp-blender-library-3d-print",
        title: "Making a tiny war-hammer hero with MCP, Blender, and a library 3D printer",
        title_alias: None,
        date: ArticleDate::new(2026, 5, 21),
        summary: "A parent-and-kid tutorial for using Codex or Claude Code, MCP, and Blender to design an original tiny hammer hero, validate it for FDM printing, and bring an STL to a public-library makerspace.",
        indexed: false,
        category: Category::Workflow,
        tags: &[
            Tag::Ai,
            Tag::ClaudeCode,
            Tag::Mcp,
            Tag::Blender,
            Tag::ThreeDPrinting,
            Tag::Makerspace,
            Tag::Parenting,
        ],
    },
];

pub const ARTICLES: &[Article] = ARTICLE_LIST;
const ARTICLE_COUNT: usize = ARTICLE_LIST.len();

pub fn public_articles() -> impl Iterator<Item = &'static Article> {
    ARTICLES.iter().filter(|article| article.indexed)
}

pub fn article_by_slug(slug: &str) -> Option<&'static Article> {
    ARTICLES.iter().find(|article| article.slug == slug)
}

pub fn article_markdown(slug: &str) -> Option<String> {
    let path = format!("{slug}.md");
    let file = ArticleSources::get(&path)?;
    std::str::from_utf8(&file.data).ok().map(str::to_owned)
}

#[derive(Clone, Copy, Debug)]
pub struct ArticleRelations {
    pub next: Option<usize>,
    pub topic_next: Option<usize>,
}

impl ArticleRelations {
    const EMPTY: Self = Self {
        next: None,
        topic_next: None,
    };
}

pub const ARTICLE_RELATIONS: [ArticleRelations; ARTICLE_COUNT] = build_article_relations();

pub fn relevance_score(current: &Article, candidate: &Article) -> u16 {
    relevance_score_articles(*current, *candidate)
}

const fn build_article_relations() -> [ArticleRelations; ARTICLE_COUNT] {
    let mut relations = [ArticleRelations::EMPTY; ARTICLE_COUNT];
    let mut index = 0;
    while index < ARTICLE_COUNT {
        let next = find_next_index(index);
        relations[index] = ArticleRelations {
            next,
            topic_next: find_topic_next_index(index, next),
        };
        index += 1;
    }
    relations
}

const fn find_next_index(current_index: usize) -> Option<usize> {
    if !ARTICLE_LIST[current_index].indexed {
        return None;
    }

    let mut index = current_index + 1;
    while index < ARTICLE_COUNT {
        if ARTICLE_LIST[index].indexed {
            return Some(index);
        }
        index += 1;
    }

    index = 0;
    while index < current_index {
        if ARTICLE_LIST[index].indexed {
            return Some(index);
        }
        index += 1;
    }

    None
}

const fn find_topic_next_index(current_index: usize, avoid_index: Option<usize>) -> Option<usize> {
    let current = ARTICLE_LIST[current_index];
    if !current.indexed {
        return None;
    }
    let mut best: Option<usize> = None;
    let mut best_score = 0;
    let mut index = 0;
    while index < ARTICLE_COUNT {
        let is_avoided = match avoid_index {
            Some(avoid) => index == avoid,
            None => false,
        };
        if ARTICLE_LIST[index].indexed && index != current_index && !is_avoided {
            let candidate = ARTICLE_LIST[index];
            let score = relevance_score_articles(current, candidate);
            if score > best_score || (score == best_score && topic_tie_breaker(candidate, best)) {
                best = Some(index);
                best_score = score;
            }
        }
        index += 1;
    }

    if best.is_some() {
        return best;
    }

    match avoid_index {
        Some(_) => {}
        None => return None,
    }

    index = 0;
    while index < ARTICLE_COUNT {
        if ARTICLE_LIST[index].indexed && index != current_index {
            let candidate = ARTICLE_LIST[index];
            let score = relevance_score_articles(current, candidate);
            if score > best_score || (score == best_score && topic_tie_breaker(candidate, best)) {
                best = Some(index);
                best_score = score;
            }
        }
        index += 1;
    }

    best
}

const fn topic_tie_breaker(candidate: Article, best: Option<usize>) -> bool {
    match best {
        Some(best_index) => date_is_after(candidate.date, ARTICLE_LIST[best_index].date),
        None => true,
    }
}

const fn relevance_score_articles(current: Article, candidate: Article) -> u16 {
    let mut score = 0;
    if current.category as u8 == candidate.category as u8 {
        score += 10;
    }

    let mut index = 0;
    while index < current.tags.len() {
        if contains_tag(candidate.tags, current.tags[index]) {
            score += 3;
        }
        index += 1;
    }
    score
}

const fn contains_tag(tags: &[Tag], needle: Tag) -> bool {
    let mut index = 0;
    while index < tags.len() {
        if tags[index] as u8 == needle as u8 {
            return true;
        }
        index += 1;
    }
    false
}

const fn date_is_after(a: ArticleDate, b: ArticleDate) -> bool {
    a.year > b.year
        || (a.year == b.year && (a.month > b.month || (a.month == b.month && a.day > b.day)))
}

// Debug-only: catch accidental tag duplicates during dev. Production
// builds skip this since enums + `unique_tags` already guarantee a
// clean rendered set; the check is just a faster signal for the
// author than spotting "rust rust" in the rendered chip row.
#[cfg(debug_assertions)]
pub(crate) fn debug_check_tag_uniqueness() {
    for article in ARTICLES {
        let original = article.tags.len();
        let unique = unique_tags(article.tags).len();
        debug_assert_eq!(
            original, unique,
            "article `{}` has duplicate tags in its slice",
            article.slug
        );
    }
}
