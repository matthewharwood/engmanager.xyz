//! Shop catalog domain: the product table, the cap photo views, image-path
//! helpers, and the `PriceCents` money newtype. Pure data — page rendering
//! (grid, panel, bag, JSON islands) stays in `pages::shop`, which imports from
//! here, as do the Stripe sync/checkout paths and search.

use crate::asset_url;

/// Money newtype (rust-core-patterns "Newtypes"): an amount in US cents.
/// Constructed from whole dollars at the const catalog table, so every price
/// in the system is exact integer cents — Stripe `unit_amount` consumes
/// `cents()` directly and the storefront renders `label()` ("$80").
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct PriceCents(u32);

impl PriceCents {
    pub const fn from_dollars(dollars: u16) -> Self {
        Self(dollars as u32 * 100)
    }

    pub fn cents(self) -> u32 {
        self.0
    }

    /// Whole-dollar display label, byte-identical to the storefront's
    /// historical `format!("${}", dollars)` rendering. Prices are built via
    /// `from_dollars`, so the division is always exact.
    pub fn label(self) -> String {
        format!("${}", self.0 / 100)
    }
}

pub(crate) const CAP_VIEWS: &[CapView] = &[
    CapView {
        id: "front",
        label: "Front",
        caption: "Crown-forward embroidery read.",
    },
    CapView {
        id: "angle",
        label: "Angle",
        caption: "Side sweep, curved brim, panel seams.",
    },
    CapView {
        id: "detail",
        label: "Detail",
        caption: "Close stitch pass with thread texture.",
    },
    CapView {
        id: "worn",
        label: "Worn",
        caption: "On-head scale for the daily standup.",
    },
    CapView {
        id: "model",
        label: "Model",
        caption: "Person-worn product reference.",
    },
];

pub(crate) const SHOP_PRODUCTS: &[ShopProduct] = &[
    ShopProduct {
        slug: "engmanager-xyz",
        name: "ENGMANAGER.XYZ 🌀",
        phrase: "ENGMANAGER.XYZ 🌀",
        cap_color: "#f4efe6",
        thread_color: "#111111",
        accent_color: "#0ea5e9",
        price: PriceCents::from_dollars(80),
        description: "The site cap. Loud enough for the offsite, quiet enough for the retro.",
    },
    ShopProduct {
        slug: "scrum-of-scrums",
        name: "Scrum of Scrums 🗓️🗓️",
        phrase: "Scrum of Scrums 🗓️🗓️",
        cap_color: "#293241",
        thread_color: "#f2f7ff",
        accent_color: "#ee6c4d",
        price: PriceCents::from_dollars(80),
        description: "A tiny crown for the meeting that became a meeting about meetings.",
    },
    ShopProduct {
        slug: "scrum-master",
        name: "Scrum Master 🗓️",
        phrase: "Scrum Master 🗓️",
        cap_color: "#e0fbfc",
        thread_color: "#16324f",
        accent_color: "#3d5a80",
        price: PriceCents::from_dollars(80),
        description: "Ceremonial, but make it cotton. Built for blockers and board hygiene.",
    },
    ShopProduct {
        slug: "velocity",
        name: "Velocity",
        phrase: "Velocity",
        cap_color: "#f8d8e6",
        thread_color: "#681a40",
        accent_color: "#ff7aa2",
        price: PriceCents::from_dollars(80),
        description: "For when the chart is a conversation starter, not a prophecy.",
    },
    ShopProduct {
        slug: "real-programmer",
        name: "Real Programmer 🧙‍♂️",
        phrase: "Real Programmer 🧙‍♂️",
        cap_color: "#111827",
        thread_color: "#ecfeff",
        accent_color: "#a78bfa",
        price: PriceCents::from_dollars(80),
        description: "A stitched incantation for people who still read the stack trace.",
    },
    ShopProduct {
        slug: "css-engineer",
        name: "CSS Engineer 🐐",
        phrase: "CSS Engineer 🐐",
        cap_color: "#ffffff",
        thread_color: "#244c3d",
        accent_color: "#79b473",
        price: PriceCents::from_dollars(80),
        description: "Cascade control, specificity restraint, and a tiny stitched goat.",
    },
    ShopProduct {
        slug: "time-check",
        name: "Time Check",
        phrase: "Time Check",
        cap_color: "#17324d",
        thread_color: "#f9f871",
        accent_color: "#ff4fa3",
        price: PriceCents::from_dollars(80),
        description: "A brim-forward nudge for the room to pause, sync, and check the clock.",
    },
    ShopProduct {
        slug: "standup",
        name: "Standup 🏋🏻‍♂️",
        phrase: "Standup 🏋🏻‍♂️",
        cap_color: "#d4f1f4",
        thread_color: "#0b4f6c",
        accent_color: "#ff6b35",
        price: PriceCents::from_dollars(80),
        description: "Fifteen minutes, lifted cleanly, then put back on the rack.",
    },
    ShopProduct {
        slug: "lgtm-plus-two",
        name: "LGTM +2",
        phrase: "LGTM +2",
        cap_color: "#fbf3b9",
        thread_color: "#3a405a",
        accent_color: "#f45b69",
        price: PriceCents::from_dollars(80),
        description: "Approval, twice stitched. For reviews that can finally move.",
    },
    ShopProduct {
        slug: "stakeholder",
        name: "Stakeholder 🥩",
        phrase: "Stakeholder 🥩",
        cap_color: "#252422",
        thread_color: "#fffcf2",
        accent_color: "#eb5e28",
        price: PriceCents::from_dollars(80),
        description: "For the person who can unblock funding and still asks great questions.",
    },
    ShopProduct {
        slug: "agentic-slop",
        name: "Agentic Slop 🔮",
        phrase: "Agentic Slop 🔮",
        cap_color: "#c7f9cc",
        thread_color: "#22577a",
        accent_color: "#38a3a5",
        price: PriceCents::from_dollars(80),
        description: "A mystical output stream, confidently shipped before the evals finish.",
    },
    ShopProduct {
        slug: "step-change",
        name: "Step Change 🪜",
        phrase: "Step Change 🪜",
        cap_color: "#ece4db",
        thread_color: "#4a4e69",
        accent_color: "#9a8c98",
        price: PriceCents::from_dollars(80),
        description: "The slope changed. The ladder was apparently involved.",
    },
    ShopProduct {
        slug: "up-and-to-the-right",
        name: "Up & to the Right",
        phrase: "Up & to the Right",
        cap_color: "#fefae0",
        thread_color: "#283618",
        accent_color: "#22c55e",
        price: PriceCents::from_dollars(80),
        description: "Optimism with a y-axis. Small chart, big stakeholder energy.",
    },
    ShopProduct {
        slug: "imma-p0",
        name: "I'mma P0 ❄️",
        phrase: "I'mma P0 ❄️",
        cap_color: "#dbeafe",
        thread_color: "#1d4ed8",
        accent_color: "#f97316",
        price: PriceCents::from_dollars(80),
        description: "Priority escalated, temperature lowered, incident channel opened.",
    },
    ShopProduct {
        slug: "ownership",
        name: "Ownership 💪🏻",
        phrase: "Ownership 💪🏻",
        cap_color: "#fee2e2",
        thread_color: "#7f1d1d",
        accent_color: "#ef4444",
        price: PriceCents::from_dollars(80),
        description: "For the person who picked it up and did not drop the thread.",
    },
    ShopProduct {
        slug: "okrs",
        name: "OKRs 🎯",
        phrase: "OKRs 🎯",
        cap_color: "#e9d5ff",
        thread_color: "#3b0764",
        accent_color: "#ef4444",
        price: PriceCents::from_dollars(80),
        description: "Objectives, key results, and one very clear embroidered target.",
    },
    ShopProduct {
        slug: "violently-aligned",
        name: "Violently Aligned ⚔️",
        phrase: "Violently Aligned ⚔️",
        cap_color: "#ccfbf1",
        thread_color: "#134e4a",
        accent_color: "#14b8a6",
        price: PriceCents::from_dollars(80),
        description: "Same direction. Extremely little ambiguity about it.",
    },
    ShopProduct {
        slug: "tokenmaxxing",
        name: "Tokenmaxxing 💸",
        phrase: "Tokenmaxxing 💸",
        cap_color: "#f5f5f4",
        thread_color: "#365314",
        accent_color: "#84cc16",
        price: PriceCents::from_dollars(80),
        description: "Long context, longer invoice, one more pass for polish.",
    },
];

#[derive(Clone, Copy)]
pub(crate) struct CapView {
    pub(crate) id: &'static str,
    pub(crate) label: &'static str,
    pub(crate) caption: &'static str,
}

#[derive(Clone, Copy)]
pub(crate) struct ShopProduct {
    pub(crate) slug: &'static str,
    pub(crate) name: &'static str,
    pub(crate) phrase: &'static str,
    pub(crate) cap_color: &'static str,
    pub(crate) thread_color: &'static str,
    pub(crate) accent_color: &'static str,
    pub(crate) price: PriceCents,
    pub(crate) description: &'static str,
}

pub(crate) fn product_image_url(product: &ShopProduct, view: &CapView) -> String {
    asset_url(&product_image_path(product, view))
}

pub(crate) fn product_image_path(product: &ShopProduct, view: &CapView) -> String {
    format!("shop/caps/{}-{}.webp", product.slug, view.id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::path::Path;

    #[test]
    fn product_catalog_is_full_grid_with_unique_slugs() {
        assert_eq!(SHOP_PRODUCTS.len(), 18);
        let slugs = SHOP_PRODUCTS
            .iter()
            .map(|product| product.slug)
            .collect::<HashSet<_>>();
        assert_eq!(slugs.len(), SHOP_PRODUCTS.len());
    }

    #[test]
    fn every_product_view_has_a_generated_asset() {
        let assets_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("assets");

        for product in SHOP_PRODUCTS {
            for view in CAP_VIEWS {
                let path = assets_root.join(product_image_path(product, view));
                assert!(
                    path.exists(),
                    "missing generated cap asset: {}",
                    path.display()
                );
            }
        }
    }

    #[test]
    fn price_cents_round_trips_dollars_and_label() {
        let price = PriceCents::from_dollars(80);
        assert_eq!(price.cents(), 8_000);
        assert_eq!(price.label(), "$80");

        for product in SHOP_PRODUCTS {
            assert_eq!(
                product.price.cents() % 100,
                0,
                "catalog prices are whole dollars"
            );
        }
    }
}
