/**
 * Landing Agent — the reference page.
 *
 * A complete, realistic `Page` for an Indian D2C leather-goods brand. Every one of the 12
 * flow blocks and all 3 fixtures are populated with believable content.
 *
 * WHY THIS FILE EXISTS
 * It decouples every other workstream from the Anthropic API. The block components, the Puck
 * registry, the renderer, the CRO validator and the dashboard can all be built, tested and
 * demoed against this document with no key, no latency and no cost — and because it is parsed
 * through `PageSchema` at module load, it is guaranteed to be exactly the shape the generator
 * produces. If a schema change breaks the contract, this import throws immediately rather
 * than surfacing as a mystery render bug later.
 *
 * It also doubles as the worked example of the conversion rules in BLOCK-CATALOG §5:
 *   - Message match: the ad promised "Flat ₹500 Off Leather Totes"; the announcement bar and
 *     hero both say it.
 *   - Price integrity: ₹2,499 from ₹2,999 (249900 / 299900 paise), and every savings figure
 *     on the page is derivable from a price pair.
 *   - One primary action: every primary CTA is the same Shopify direct-checkout destination.
 *   - Data integrity: every asserted number carries a DataSource, and the unverified ones
 *     carry a `notes` flag naming what a human must confirm before publish.
 *   - Urgency restraint: one urgency-strip, three signals, exactly one countdown on the page.
 */

import type { z } from "zod";

import { type Page, PageSchema } from "@/lib/schema/page";

/**
 * Authored against the INPUT type, so fields carrying a Zod `.default()` may be omitted —
 * which keeps the document readable instead of drowning it in restated defaults.
 */
const rawMockPage = {
  id: "page_mock_kaarva",
  slug: "meera-leather-tote-monsoon-sale",
  title: "Kaarva — Meera Leather Tote (Monsoon, Meta cold)",

  meta: {
    title: "Meera Leather Tote — Flat ₹500 Off | Kaarva",
    description:
      "Full-grain Kanpur leather tote that fits a 14-inch laptop. ₹2,499 (was ₹2,999). COD, free shipping and 15-day returns across India.",
    keywords: [
      "leather tote",
      "leather tote bag for women",
      "office bag India",
      "laptop tote",
      "full grain leather bag",
    ],
    ogTitle: "Meera Leather Tote — Flat ₹500 Off",
    ogDescription:
      "Handmade in Kanpur from full-grain leather. Fits a 14-inch laptop. ₹2,499 with free shipping and COD.",
    ogImage: {
      src: "/img/kaarva/meera-tan-hero.webp",
      alt: "Tan full-grain leather tote bag standing upright against a linen backdrop",
      width: 1200,
      height: 630,
    },
    // Paid-only landing page: keep it out of the index so it never competes with the PDP.
    noindex: true,
    locale: "en-IN",
  },

  theme: {
    primary: "#5C3A21",
    accent: "#C08B4E",
    neutralHue: 60,
    headingFont: "fraunces",
    bodyFont: "dm-sans",
    radius: 0.5,
    personality: "premium-minimal",
    surfaceTint: "warm",
    ctaShape: "rounded",
    darkCtaSection: true,
  },

  blocks: [
    /* ══ 1 ══ announcement-bar ═══════════════════════════════════════════════
       Message match happens here, in the first paint. No countdown — the page's
       single countdown lives in the urgency strip (cro/urgency-restraint).      */
    {
      id: "blk_ann_a1",
      type: "announcement-bar",
      props: {
        text: "MONSOON SALE — Flat ₹500 OFF the Meera Tote + Free Shipping",
        mobileText: "₹500 OFF Meera Tote + Free Shipping",
        emphasis: "Flat ₹500 OFF",
        tone: "dark",
        icon: "sparkles",
        dismissible: false,
        sticky: false,
        countdown: null,
        marquee: false,
        link: { kind: "url", href: "#blk_offers_e5" },
      },
    },

    /* ══ 2 ══ hero-product ═══════════════════════════════════════════════════
       The whole decision on one screen. Bullets capped at 5 and the eyebrow kept
       short so the CTA clears the 400px fold on a 360×640 viewport.             */
    {
      id: "blk_hero_b2",
      type: "hero-product",
      props: {
        eyebrow: "Handmade in Kanpur · 412 reviews",
        title: "Meera Everyday Leather Tote",
        subtitle:
          "Full-grain leather that fits a 14-inch laptop, your lunch and gym kit — and still closes.",
        gallery: [
          {
            src: "/img/kaarva/meera-tan-hero.webp",
            alt: "Tan full-grain leather tote standing upright, showing the hand-stitched top edge",
            width: 1200,
            height: 1200,
          },
          {
            src: "/img/kaarva/meera-interior.webp",
            alt: "Tote interior showing a 14-inch laptop in the padded sleeve beside a zip pocket",
            width: 1200,
            height: 1200,
          },
          {
            src: "/img/kaarva/meera-on-shoulder.webp",
            alt: "Woman carrying the tan leather tote on her shoulder while walking to work",
            width: 1200,
            height: 1200,
          },
          {
            src: "/img/kaarva/meera-grain-detail.webp",
            alt: "Close-up of the full-grain leather surface and saddle-stitched handle join",
            width: 1200,
            height: 1200,
          },
          {
            src: "/img/kaarva/meera-patina.webp",
            alt: "Two totes side by side: one new, one after two years showing a darker patina",
            width: 1200,
            height: 1200,
          },
        ],
        galleryLayout: "thumbs-below",
        rating: { value: 4.7, count: 412, label: "verified reviews", linkToReviews: true },
        price: { amount: 249900, currency: "INR" },
        compareAtPrice: { amount: 299900, currency: "INR" },
        discountBadge: { mode: "auto-amount", tone: "danger", shape: "pill" },
        priceNote: "Inclusive of all taxes · Free shipping over ₹999",
        bullets: [
          "Fits a 14-inch laptop, tiffin and gym kit with room to spare",
          "Full-grain leather that softens and darkens with every year",
          "Padded laptop sleeve and a zip pocket for your phone",
          "Hand-stitched by Kanpur artisans, never glued",
          "Free shipping, COD, and 15-day easy returns",
        ],
        variants: [
          {
            id: "colour",
            label: "Choose your colour",
            style: "swatch",
            required: true,
            options: [
              {
                id: "col_tan",
                label: "Classic Tan",
                shopifyVariantId: "49220011",
                swatchHex: "#B07A4B",
                badge: "Bestseller",
              },
              {
                id: "col_espresso",
                label: "Espresso Brown",
                shopifyVariantId: "49220012",
                swatchHex: "#4A2F1E",
              },
              {
                id: "col_ink",
                label: "Ink Black",
                shopifyVariantId: "49220013",
                swatchHex: "#1F1B18",
              },
            ],
          },
        ],
        showQuantity: true,
        quantityMax: 3,
        primaryCta: {
          label: "Buy Now — ₹2,499",
          sublabel: "COD available · Ships in 24 hrs",
          variant: "solid",
          tone: "brand",
          icon: "zap",
          action: {
            kind: "shopify",
            productId: "8412009",
            variantId: "49220011",
            quantity: 1,
            discountCode: "TOTE500",
            mode: "direct-checkout",
          },
        },
        secondaryCta: {
          label: "Order on WhatsApp",
          variant: "outline",
          icon: "smartphone",
          action: {
            kind: "whatsapp",
            phone: "919820045678",
            businessName: "Kaarva Support",
            messageTemplate:
              "Hi! I'd like to order the {{product}} ({{variant}}) at {{price}}. Please help me place the order.",
          },
        },
        trustChips: [
          { icon: "truck", label: "Free shipping ₹999+" },
          { icon: "banknote", label: "Cash on Delivery" },
          { icon: "rotate-ccw", label: "15-day returns" },
          { icon: "shield-check", label: "2-year warranty" },
        ],
        layout: "media-left",
        background: "light",
      },
    },

    /* ══ 3 ══ urgency-strip ══════════════════════════════════════════════════
       Three signals, three real sources, one countdown. The static one is
       verified:false and the notes field names what a human must confirm.       */
    {
      id: "blk_urg_c3",
      type: "urgency-strip",
      notes:
        "SIGNAL 1 is mode:static, verified:false — confirm the 168 units-sold figure against Shopify analytics before publish, or switch it to mode:analytics.",
      props: {
        signals: [
          {
            kind: "units-sold",
            label: "{value} totes sold this month",
            period: "30 days",
            format: "plus",
            icon: "flame",
            source: { mode: "static", value: 168, verified: false },
          },
          {
            kind: "stock-remaining",
            label: "Only {value} left in Classic Tan",
            stockCriticalFloor: 3,
            showBar: true,
            barMax: 40,
            icon: "package",
            source: {
              mode: "shopify-inventory",
              productId: "8412009",
              variantId: "49220011",
              fallback: 9,
            },
          },
          {
            kind: "countdown",
            label: "Sale price ends in {value}",
            icon: "clock",
            config: { mode: "daily-reset", resetAtHour: 23, expiredBehaviour: "restart" },
          },
        ],
        layout: "row",
        tone: "warning",
        dividers: true,
        animate: true,
        disclosureText: "Stock counts refresh every few minutes from live inventory.",
        sticky: false,
      },
    },

    /* ══ 4 ══ value-pillars ══════════════════════════════════════════════════
       "Why this one and not the ₹899 one on Amazon", answered in four seconds.  */
    {
      id: "blk_pillars_d4",
      type: "value-pillars",
      props: {
        heading: "Why this tote outlasts the ₹899 one",
        subheading: "Four things that decide whether a bag lasts two months or ten years.",
        numbering: "none",
        columns: 4,
        iconStyle: "circle",
        align: "center",
        divider: false,
        background: "light",
        pillars: [
          {
            id: "pil_grain",
            icon: "award",
            title: "Full-grain, not split",
            description:
              "The top layer of the hide, with the grain intact. It resists scuffs, and it ages into a deeper colour instead of peeling.",
          },
          {
            id: "pil_stitch",
            icon: "check",
            title: "Stitched, never glued",
            description:
              "Saddle-stitched handles with waxed thread. If one stitch fails the rest hold — which is exactly why glued bags come apart at the strap.",
          },
          {
            id: "pil_fit",
            icon: "package",
            title: "Built around a laptop",
            description:
              "A padded 14-inch sleeve, a zip pocket and two slip pockets. Nothing rattles around and nothing digs into your screen.",
          },
          {
            id: "pil_cod",
            icon: "banknote",
            title: "COD and easy returns",
            description:
              "Pay cash on delivery anywhere in India. Changed your mind in 15 days? We arrange a free pickup and refund you in full.",
          },
        ],
      },
    },

    /* ══ 5 ══ offer-stack ════════════════════════════════════════════════════
       WHETHER -> WHICH. Exactly one mostPopular. Per-unit display off: these are
       different products, not multiples of one, so ₹/unit would be meaningless.  */
    {
      id: "blk_offers_e5",
      type: "offer-stack",
      props: {
        heading: "Pick your set",
        subheading: "Most customers add the sling — it is the bag they carry on weekends.",
        columns: 3,
        emphasis: "popular-scale",
        savingsDisplay: "both",
        showPerUnit: false,
        background: "neutral",
        footnote: "Every set ships free · COD available · 15-day returns",
        offers: [
          {
            id: "off_single",
            title: "The Tote",
            subtitle: "Just the everyday carry",
            unitCount: 1,
            price: { amount: 249900, currency: "INR" },
            compareAtPrice: { amount: 299900, currency: "INR" },
            includes: ["Meera Everyday Tote", "Cotton dust bag", "Free shipping"],
            image: {
              src: "/img/kaarva/set-tote.webp",
              alt: "Meera leather tote with its cotton dust bag",
            },
            cta: {
              label: "Buy the Tote",
              variant: "outline",
              action: {
                kind: "shopify",
                productId: "8412009",
                variantId: "49220011",
                discountCode: "TOTE500",
                mode: "direct-checkout",
              },
            },
          },
          {
            id: "off_bundle",
            title: "Tote + Sling",
            subtitle: "Weekday carry and weekend carry",
            unitCount: 2,
            price: { amount: 379900, currency: "INR" },
            compareAtPrice: { amount: 499800, currency: "INR" },
            mostPopular: true,
            badge: "Most popular",
            badgeTone: "accent",
            includes: [
              "Meera Everyday Tote",
              "Rehan Crossbody Sling",
              "Two cotton dust bags",
              "Free shipping",
            ],
            freebies: ["+ Free leather care balm (worth ₹399)"],
            image: {
              src: "/img/kaarva/set-tote-sling.webp",
              alt: "Meera tote beside the matching Rehan crossbody sling in tan leather",
            },
            cta: {
              label: "Buy Tote + Sling",
              sublabel: "Save ₹1,199",
              variant: "solid",
              tone: "brand",
              action: {
                kind: "shopify",
                productId: "8412009",
                variantId: "49220021",
                discountCode: "TOTE500",
                mode: "direct-checkout",
              },
            },
          },
          {
            id: "off_gift",
            title: "The Gift Set",
            subtitle: "Tote, wallet and care kit, boxed",
            unitCount: 3,
            price: { amount: 449900, currency: "INR" },
            compareAtPrice: { amount: 619700, currency: "INR" },
            badge: "Save the most",
            includes: [
              "Meera Everyday Tote",
              "Bifold leather wallet",
              "Leather care kit",
              "Gift box with hand-written note",
              "Free shipping",
            ],
            freebies: ["+ Free monogramming (up to 3 letters)"],
            image: {
              src: "/img/kaarva/set-gift.webp",
              alt: "Gift box containing the leather tote, a bifold wallet and a leather care kit",
            },
            cta: {
              label: "Buy the Gift Set",
              sublabel: "Save ₹1,698",
              variant: "outline",
              action: {
                kind: "shopify",
                productId: "8412009",
                variantId: "49220031",
                discountCode: "TOTE500",
                mode: "direct-checkout",
              },
            },
          },
        ],
      },
    },

    /* ══ 6 ══ review-wall ════════════════════════════════════════════════════
       Distribution is not all-5-star, on purpose. A visible 3 and 2 is what makes
       the 4.7 believable to a sceptical COD buyer.                              */
    {
      id: "blk_reviews_f6",
      type: "review-wall",
      props: {
        heading: "412 verified reviews",
        summary: {
          value: 4.7,
          count: 412,
          distribution: { "5": 301, "4": 78, "3": 21, "2": 8, "1": 4 },
          label: "Based on 412 verified purchases",
          sourceBadge: "Verified by Judge.me",
          source: {
            mode: "api",
            endpoint: "/api/reviews/summary",
            jsonPath: "$.aggregate",
            refreshSeconds: 3600,
            fallback: 4.7,
            staleBehaviour: "show-fallback",
          },
        },
        showDistribution: true,
        layout: "grid",
        columns: 3,
        initialCount: 6,
        sortDefault: "helpful",
        filterable: false,
        showPhotos: true,
        background: "light",
        reviews: [
          {
            id: "rev_1",
            name: "Ananya R.",
            location: "Bengaluru, Karnataka",
            rating: 5,
            date: "2026-06-18",
            title: "Finally a work bag that fits everything",
            verified: true,
            variantPurchased: "Classic Tan",
            helpfulCount: 186,
            body: "I carry a 14-inch MacBook, a water bottle, a tiffin and my gym shoes. This is the first tote that takes all of it and still shuts properly. Four months of daily Whitefield commuting and the handles haven't stretched at all.",
            photos: [
              {
                src: "/img/kaarva/rev-ananya.webp",
                alt: "Customer photo of the tan tote packed with a laptop, bottle and lunch box",
              },
            ],
          },
          {
            id: "rev_2",
            name: "Rohit K.",
            location: "Pune, Maharashtra",
            rating: 5,
            date: "2026-06-05",
            verified: true,
            variantPurchased: "Ink Black",
            helpfulCount: 94,
            body: "Bought it for my wife's birthday and ended up ordering a second one for myself. The leather smells like actual leather, not chemicals. COD worked without any drama and it reached Pune in three days.",
          },
          {
            id: "rev_3",
            name: "Fathima S.",
            location: "Kochi, Kerala",
            rating: 4,
            date: "2026-05-27",
            title: "Lovely bag, heavier than I expected",
            verified: true,
            variantPurchased: "Espresso Brown",
            helpfulCount: 71,
            body: "The build quality is genuinely excellent and the espresso colour is richer in person. My only note is that it's a solid bag even when empty — if you want something featherweight this isn't it. For me the sturdiness is the point.",
            response: {
              author: "Kaarva Team",
              body: "Thank you Fathima! Full-grain hide does carry weight — it is the same reason the bag holds its shape after years. Our Rehan sling is the lighter option if you ever want one.",
              date: "2026-05-28",
            },
          },
          {
            id: "rev_4",
            name: "Sneha M.",
            location: "Ahmedabad, Gujarat",
            rating: 5,
            date: "2026-05-14",
            verified: true,
            variantPurchased: "Classic Tan",
            helpfulCount: 58,
            body: "Ordered the Tote and Sling set. Both arrived in cotton dust bags with the care balm. The monogram on the wallet was neatly done. It felt like unboxing something from a real brand, not a marketplace seller.",
          },
          {
            id: "rev_5",
            name: "Vikram D.",
            location: "Jaipur, Rajasthan",
            rating: 3,
            date: "2026-04-29",
            verified: true,
            helpfulCount: 33,
            body: "The bag itself is good. My issue was delivery — it took seven days to reach Jaipur when the site suggested four. Support replied on WhatsApp quickly, but I'd have liked accurate timelines up front.",
            response: {
              author: "Kaarva Team",
              body: "Apologies Vikram — that was a courier delay at our end. We have since updated the tier-2 estimates on this page to 4–6 working days.",
              date: "2026-04-30",
            },
          },
          {
            id: "rev_6",
            name: "Priya N.",
            location: "Chennai, Tamil Nadu",
            rating: 5,
            date: "2026-04-11",
            title: "Two years in and it looks better",
            verified: true,
            variantPurchased: "Classic Tan",
            helpfulCount: 142,
            body: "This is my second Kaarva. The first one is two years old, has been through two Chennai monsoons, and has darkened into a colour I couldn't buy off a shelf. That patina is the whole reason I came back.",
            photos: [
              {
                src: "/img/kaarva/rev-priya-patina.webp",
                alt: "Two-year-old tan tote showing a darkened, glossy patina on the handles",
              },
            ],
          },
        ],
        cta: {
          label: "Get yours — ₹500 off",
          variant: "solid",
          tone: "brand",
          action: { kind: "url", href: "#blk_offers_e5" },
        },
      },
    },

    /* ══ 7 ══ product-narrative ══════════════════════════════════════════════
       Where an unknown brand earns the right to a COD order. Stats trio, not two. */
    {
      id: "blk_story_g7",
      type: "product-narrative",
      props: {
        eyebrow: "Why we made this",
        heading: "We buy the hide before anyone cuts a single bag",
        body: "Most tote bags sold online in India are split leather — the leftover underlayer, sprayed with a plastic finish that cracks in about a year. It photographs beautifully and it does not last.\n\nWe buy full-grain hides directly from a tannery in Kanpur, inspect them ourselves, and hand them to eleven artisans who saddle-stitch every handle. It is slower and it costs more. It is also the difference between a bag you replace next summer and one that looks better in 2028 than it does today.",
        stats: [
          { value: "11", label: "artisans in Kanpur", icon: "heart" },
          { value: "412", label: "verified reviews", icon: "star" },
          { value: "2 years", label: "stitching warranty", icon: "shield-check" },
        ],
        image: {
          src: "/img/kaarva/kanpur-workshop.webp",
          alt: "Artisan saddle-stitching a leather tote handle by hand in the Kanpur workshop",
        },
        imagePosition: "right",
        signature: {
          name: "Meera Iyer",
          role: "Founder, Kaarva",
          avatar: {
            src: "/img/kaarva/founder-meera.webp",
            alt: "Meera Iyer, founder of Kaarva, holding a finished leather tote",
          },
        },
        cta: {
          label: "See the sets",
          variant: "ghost",
          action: { kind: "url", href: "#blk_offers_e5" },
        },
        background: "light",
        maxWidth: "prose",
      },
    },

    /* ══ 8 ══ persona-cards ══════════════════════════════════════════════════
       Recommendations reference offerId rather than restating a price, so the
       offer stack stays the single source of truth (cro/price-integrity).        */
    {
      id: "blk_persona_h8",
      type: "persona-cards",
      props: {
        heading: "Which set is right for you?",
        subheading: "Three ways people actually buy this bag.",
        columns: 3,
        cardStyle: "image-top",
        background: "neutral",
        personas: [
          {
            id: "per_commuter",
            title: "You commute with a laptop every day",
            description:
              "Office, cab, coffee shop, back home. You need one bag that swallows a 14-inch laptop, a charger and lunch without looking like a rucksack in a meeting.",
            image: {
              src: "/img/kaarva/persona-commuter.webp",
              alt: "Woman stepping out of a cab with the tan leather tote on her shoulder",
            },
            matchPoints: [
              "Carry a laptop five days a week",
              "Want one bag for work and after-work",
              "Tired of straps that dig into your shoulder",
            ],
            recommended: {
              offerId: "off_single",
              reason: "The everyday carry, nothing extra",
              cta: {
                label: "Get the Tote",
                variant: "outline",
                action: {
                  kind: "shopify",
                  productId: "8412009",
                  variantId: "49220011",
                  discountCode: "TOTE500",
                  mode: "direct-checkout",
                },
              },
            },
          },
          {
            id: "per_weekend",
            title: "You want one bag for weekdays, one for weekends",
            description:
              "The tote does Monday to Friday. On a Saturday you want your hands free and only your phone, cards and keys with you — a full tote is overkill for that.",
            image: {
              src: "/img/kaarva/persona-weekend.webp",
              alt: "Tan tote and matching crossbody sling laid side by side on a wooden table",
            },
            matchPoints: [
              "Switch bags between work and weekend",
              "Want the pair to match",
              "Best value per bag on this page",
            ],
            recommended: {
              offerId: "off_bundle",
              reason: "Save ₹1,199 versus buying separately",
              cta: {
                label: "Get Tote + Sling",
                variant: "solid",
                action: {
                  kind: "shopify",
                  productId: "8412009",
                  variantId: "49220021",
                  discountCode: "TOTE500",
                  mode: "direct-checkout",
                },
              },
            },
          },
          {
            id: "per_gift",
            title: "You're buying it as a gift",
            description:
              "A birthday, a new job, a wedding. You want it to arrive boxed and finished, not in a courier bag with an invoice taped to it.",
            image: {
              src: "/img/kaarva/persona-gift.webp",
              alt: "Kaarva gift box open, showing the tote, wallet and care kit with a hand-written note",
            },
            matchPoints: [
              "Want it gift-boxed and monogrammed",
              "Buying for someone who notices details",
            ],
            recommended: {
              offerId: "off_gift",
              reason: "Boxed, monogrammed, with a hand-written note",
              cta: {
                label: "Get the Gift Set",
                variant: "outline",
                action: {
                  kind: "shopify",
                  productId: "8412009",
                  variantId: "49220031",
                  discountCode: "TOTE500",
                  mode: "direct-checkout",
                },
              },
            },
          },
        ],
      },
    },

    /* ══ 9 ══ comparison-table ═══════════════════════════════════════════════
       Compared against CATEGORIES, never named competitors — named comparisons
       invite fact-checking and Meta ad disapproval. cells.length === columns.length. */
    {
      id: "blk_compare_i9",
      type: "comparison-table",
      props: {
        heading: "Kaarva vs. the alternatives",
        subheading: "Why ₹2,499 once beats ₹899 three times.",
        columns: [
          {
            id: "col_us",
            label: "Kaarva",
            sublabel: "Meera Everyday Tote",
            isUs: true,
            cta: {
              label: "Buy Now — ₹2,499",
              variant: "solid",
              tone: "brand",
              action: {
                kind: "shopify",
                productId: "8412009",
                variantId: "49220011",
                discountCode: "TOTE500",
                mode: "direct-checkout",
              },
            },
          },
          { id: "col_fast", label: "Fast-fashion totes", sublabel: "₹700–1,200 range" },
          { id: "col_import", label: "Imported luxury bags", sublabel: "₹15,000 and up" },
        ],
        rows: [
          {
            id: "row_leather",
            label: "Full-grain leather",
            tooltip: "The intact top layer of the hide — not split, not bonded, not PU.",
            cells: [{ type: "check" }, { type: "cross" }, { type: "check" }],
          },
          {
            id: "row_stitch",
            label: "Hand saddle-stitched handles",
            cells: [{ type: "check" }, { type: "cross" }, { type: "partial" }],
          },
          {
            id: "row_laptop",
            label: "Padded 14-inch laptop sleeve",
            cells: [{ type: "check" }, { type: "partial" }, { type: "cross" }],
          },
          {
            id: "row_ages",
            label: "Ages into a patina",
            cells: [{ type: "check" }, { type: "cross" }, { type: "check" }],
          },
          {
            id: "row_cod",
            label: "Cash on delivery",
            cells: [{ type: "check" }, { type: "check" }, { type: "cross" }],
          },
          {
            id: "row_repair",
            label: "Repairs and re-stitching",
            cells: [
              { type: "text", value: "Free for 2 years" },
              { type: "text", value: "Not offered" },
              { type: "text", value: "Paid, weeks-long" },
            ],
          },
          {
            id: "row_life",
            label: "Realistic lifespan",
            cells: [
              { type: "text", value: "5–10 years" },
              { type: "text", value: "About a year" },
              { type: "text", value: "10+ years" },
            ],
          },
        ],
        priceRow: {
          label: "What you pay",
          values: ["₹2,499 once", "₹899 every year", "₹15,000+"],
          note: "All prices inclusive of taxes",
        },
        ctaRow: true,
        highlightUs: true,
        stickyFirstColumn: true,
        background: "neutral",
        disclaimer:
          "Comparison against product categories, based on publicly listed materials and typical Indian retail pricing, June 2026.",
      },
    },

    /* ══ 10 ══ spec-table ════════════════════════════════════════════════════
       Sits low on purpose: specs suppress emotional momentum if placed early.    */
    {
      id: "blk_spec_j10",
      type: "spec-table",
      props: {
        heading: "Every detail of this bag",
        layout: "two-column",
        striped: true,
        collapsibleGroups: true,
        background: "neutral",
        footnote:
          "Leather is a natural material — grain and shade vary slightly between bags. This is expected, not a defect.",
        image: {
          src: "/img/kaarva/meera-dimensions.webp",
          alt: "Line drawing of the tote with its height, width and depth measurements marked",
        },
        groups: [
          {
            id: "grp_basics",
            title: "The basics",
            rows: [
              {
                id: "r_dims",
                label: "Dimensions",
                value: "38 cm wide × 30 cm tall × 12 cm deep",
                highlight: true,
              },
              { id: "r_weight", label: "Weight", value: "980 g empty" },
              {
                id: "r_laptop",
                label: "Laptop fit",
                value: "Padded sleeve fits up to a 14-inch laptop",
                highlight: true,
              },
              { id: "r_strap", label: "Handle drop", value: "24 cm — clears a winter coat shoulder" },
              { id: "r_closure", label: "Closure", value: "Magnetic snap with an inner zip divider" },
            ],
          },
          {
            id: "grp_material",
            title: "Materials",
            rows: [
              {
                id: "r_leather",
                label: "Outer",
                value: "1.8 mm full-grain buffalo hide, vegetable tanned in Kanpur",
                highlight: true,
              },
              { id: "r_lining", label: "Lining", value: "Unbleached cotton canvas, 220 GSM" },
              { id: "r_thread", label: "Thread", value: "Waxed polyester, saddle-stitched by hand" },
              {
                id: "r_hardware",
                label: "Hardware",
                value: "Antique-brass finished zinc alloy, nickel-free",
              },
              {
                id: "r_pockets",
                label: "Pockets",
                value: "1 padded laptop sleeve · 1 zip pocket · 2 slip pockets",
              },
            ],
          },
          {
            id: "grp_care",
            title: "Care and warranty",
            rows: [
              {
                id: "r_care",
                label: "Cleaning",
                value: "Wipe with a dry cloth. Condition with leather balm every 3–4 months.",
              },
              {
                id: "r_rain",
                label: "In the rain",
                value: "Water-resistant, not waterproof. Pat dry — never use a hair dryer.",
              },
              {
                id: "r_warranty",
                label: "Warranty",
                value: "2 years on stitching and hardware",
                highlight: true,
              },
              { id: "r_origin", label: "Country of origin", value: "India (Made in Kanpur, UP)" },
            ],
          },
        ],
      },
    },

    /* ══ 11 ══ faq-accordion ═════════════════════════════════════════════════
       Covers all five India-critical objections: COD, delivery, returns,
       authenticity, suitability (cro/objection-coverage).                        */
    {
      id: "blk_faq_k11",
      type: "faq-accordion",
      props: {
        heading: "Questions people ask before ordering",
        layout: "single-column",
        allowMultipleOpen: true,
        defaultOpen: ["faq_cod"],
        emitJsonLd: true,
        background: "light",
        groups: null,
        items: [
          {
            id: "faq_cod",
            question: "Is Cash on Delivery available?",
            answer:
              "Yes. COD is available on 22,000+ pincodes across India at no extra charge. You pay the delivery partner in cash or by UPI when the bag arrives. Prepaid orders get an extra 5% off at checkout.",
          },
          {
            id: "faq_ship",
            question: "How long will delivery take to my city?",
            answer:
              "Metro cities — Mumbai, Delhi NCR, Bengaluru, Hyderabad, Chennai, Pune and Kolkata — get delivery in 2–3 working days. Tier 2 and tier 3 cities take 4–6 working days. You get a tracking link on WhatsApp within 24 hours of ordering.",
          },
          {
            id: "faq_laptop",
            question: "Will my 14-inch laptop actually fit?",
            answer:
              "Yes. The padded sleeve measures 34 cm × 25 cm, which takes any 13-inch or 14-inch laptop including a MacBook Pro 14. A 15.6-inch Windows laptop will fit in the main compartment but not in the padded sleeve.",
          },
          {
            id: "faq_returns",
            question: "What if I don't like it when it arrives?",
            answer:
              "Return it within 15 days for a full refund, as long as the tags are on and it hasn't been used outdoors. Message us on WhatsApp, we arrange a free pickup, and the refund reaches your account within 5 working days.",
          },
          {
            id: "faq_real",
            question: "How do I know the leather is genuine full-grain?",
            answer:
              "Every bag ships with a tannery batch number stamped inside the zip pocket. Full-grain leather has visible pores and small natural marks — if a bag has a perfectly uniform surface, it is coated split leather. Ours will darken with use; coated leather cannot.",
          },
          {
            id: "faq_rain",
            question: "Is it safe in the monsoon?",
            answer:
              "Vegetable-tanned leather is water-resistant, not waterproof. Light rain is fine — pat it dry with a cloth and let it air dry away from direct heat. In heavy rain we would keep it under an umbrella, the same as you would a laptop.",
          },
          {
            id: "faq_smell",
            question: "Will it smell of chemicals?",
            answer:
              "No. Vegetable tanning uses bark extracts rather than chromium, so the bag smells of leather and nothing else. The scent fades over the first few weeks.",
          },
          {
            id: "faq_gst",
            question: "Is ₹2,499 the final price including GST and shipping?",
            answer:
              "Yes. ₹2,499 is what you pay — GST included. Shipping is free on every order above ₹999, so every set on this page ships free anywhere in India.",
            cta: {
              label: "Buy Now — ₹2,499",
              variant: "solid",
              tone: "brand",
              action: {
                kind: "shopify",
                productId: "8412009",
                variantId: "49220011",
                discountCode: "TOTE500",
                mode: "direct-checkout",
              },
            },
          },
        ],
        supportCta: {
          heading: "Still deciding between colours?",
          body: "Message us on WhatsApp — we'll send you real photos of each colour in daylight, usually within 10 minutes.",
          icon: "headphones",
          cta: {
            label: "Chat on WhatsApp",
            variant: "solid",
            tone: "success",
            icon: "smartphone",
            action: {
              kind: "whatsapp",
              phone: "919820045678",
              businessName: "Kaarva Support",
              messageTemplate:
                "Hi! I'm on the {{page}} page and can't decide between the colours. Can you send photos?",
            },
          },
        },
      },
    },

    /* ══ 12 ══ collection-grid ═══════════════════════════════════════════════
       Deliberately last: placed higher it leaks attention from the primary CTA. */
    {
      id: "blk_grid_l12",
      type: "collection-grid",
      props: {
        heading: "The rest of the Kaarva range",
        subheading: "Same hides, same eleven artisans.",
        columns: 4,
        mobileColumns: 2,
        mobileLayout: "carousel",
        aspectRatio: "1:1",
        showPrice: true,
        showCompareAt: true,
        cardCta: "whole-card",
        background: "light",
        items: [
          {
            id: "p_sling",
            image: {
              src: "/img/kaarva/rehan-sling.webp",
              alt: "Rehan crossbody sling in tan leather with an adjustable strap",
            },
            name: "Rehan Crossbody Sling",
            subtitle: "Hands-free weekend carry",
            price: { amount: 179900, currency: "INR" },
            compareAtPrice: { amount: 199900, currency: "INR" },
            badge: "Bestseller",
            rating: { value: 4.6, count: 238, linkToReviews: false },
            action: { kind: "url", href: "/products/rehan-crossbody-sling" },
          },
          {
            id: "p_wallet",
            image: {
              src: "/img/kaarva/bifold-wallet.webp",
              alt: "Bifold leather wallet open, showing six card slots and a note compartment",
            },
            name: "Bifold Leather Wallet",
            subtitle: "Six card slots, no bulk",
            price: { amount: 89900, currency: "INR" },
            compareAtPrice: { amount: 109900, currency: "INR" },
            rating: { value: 4.8, count: 512, linkToReviews: false },
            action: { kind: "url", href: "/products/bifold-leather-wallet" },
          },
          {
            id: "p_laptop",
            image: {
              src: "/img/kaarva/laptop-folio.webp",
              alt: "Slim leather laptop folio with a felt lining and a magnetic flap",
            },
            name: "Arav Laptop Folio",
            subtitle: "Felt-lined, fits 14-inch",
            price: { amount: 199900, currency: "INR" },
            compareAtPrice: { amount: 249900, currency: "INR" },
            badge: "New",
            badgeTone: "success",
            action: { kind: "url", href: "/products/arav-laptop-folio" },
          },
          {
            id: "p_care",
            image: {
              src: "/img/kaarva/care-kit.webp",
              alt: "Leather care kit with a tin of balm, a horsehair brush and a cotton cloth",
            },
            name: "Leather Care Kit",
            subtitle: "Balm, brush and cloth",
            price: { amount: 39900, currency: "INR" },
            compareAtPrice: { amount: 49900, currency: "INR" },
            action: { kind: "url", href: "/products/leather-care-kit" },
          },
        ],
        viewAll: {
          label: "View all 18 products",
          variant: "outline",
          action: { kind: "url", href: "/collections/all", target: "_self" },
        },
      },
    },
  ],

  /* ══ FIXTURES ═══════════════════════════════════════════════════════════════
     Singletons on page.fixtures, not members of blocks[]. Never drag-reordered. */
  fixtures: {
    stickyCta: {
      enabled: true,
      showOn: "mobile",
      // Appears the moment the hero scrolls away — addressed by block id, never by index.
      trigger: { mode: "after-block", blockId: "blk_hero_b2" },
      productName: "Meera Everyday Leather Tote",
      image: {
        src: "/img/kaarva/meera-tan-hero.webp",
        alt: "Tan full-grain leather tote bag",
      },
      price: { amount: 249900, currency: "INR" },
      compareAtPrice: { amount: 299900, currency: "INR" },
      savingsLabel: "Save ₹500",
      reflectVariantSelection: true,
      hideNearFooter: true,
      tone: "brand",
      // Resolves to the same destination as the hero primary CTA (cro/one-primary-action).
      cta: {
        label: "Buy Now",
        variant: "solid",
        action: {
          kind: "shopify",
          productId: "8412009",
          variantId: "49220011",
          discountCode: "TOTE500",
          mode: "direct-checkout",
        },
      },
      secondaryIconCta: {
        label: "WhatsApp",
        icon: "smartphone",
        variant: "outline",
        action: {
          kind: "whatsapp",
          phone: "919820045678",
          messageTemplate: "Hi! I have a question about the {{product}}.",
        },
      },
    },

    socialProofPopup: {
      enabled: true,
      position: "bottom-left",
      // Never "bottom" on mobile — that space belongs to stickyCta.
      mobilePosition: "top",
      template: "{name} from {city} just ordered {variant}",
      showImage: true,
      showTimeAgo: true,
      initialDelaySeconds: 10,
      intervalSeconds: 22,
      displaySeconds: 5,
      maxPerSession: 5,
      dismissible: true,
      clickAction: { kind: "url", href: "#blk_offers_e5" },
      source: {
        mode: "shopify-orders",
        shop: "kaarva.myshopify.com",
        lookbackHours: 24,
        // "full" (surname included) is forbidden by the validator — a live privacy exposure.
        anonymise: "first-name-initial",
        fallback: [
          {
            id: "ev_1",
            name: "Rohan S.",
            city: "Jaipur",
            product: "Meera Everyday Tote",
            variant: "Classic Tan",
            minutesAgo: 7,
            verified: true,
            image: { src: "/img/kaarva/meera-tan-hero.webp", alt: "Meera leather tote in tan" },
          },
          {
            id: "ev_2",
            name: "Divya M.",
            city: "Coimbatore",
            product: "Meera Everyday Tote",
            variant: "Tote + Sling",
            minutesAgo: 16,
            verified: true,
            image: { src: "/img/kaarva/set-tote-sling.webp", alt: "Tote and sling set in tan" },
          },
          {
            id: "ev_3",
            name: "Aarti K.",
            city: "Indore",
            product: "Meera Everyday Tote",
            variant: "Ink Black",
            minutesAgo: 34,
            verified: true,
            image: { src: "/img/kaarva/meera-tan-hero.webp", alt: "Meera leather tote" },
          },
          {
            id: "ev_4",
            name: "Nikhil B.",
            city: "Hyderabad",
            product: "Meera Everyday Tote",
            variant: "The Gift Set",
            minutesAgo: 51,
            verified: true,
            image: { src: "/img/kaarva/set-gift.webp", alt: "Kaarva gift set box" },
          },
        ],
      },
    },

    trustBar: {
      enabled: true,
      placement: "above-footer",
      style: "mixed",
      showLabels: true,
      tone: "neutral",
      bordered: true,
      badges: [
        { id: "tb_ship", icon: "truck", label: "Free shipping", sublabel: "On orders above ₹999" },
        { id: "tb_cod", icon: "banknote", label: "Cash on Delivery", sublabel: "22,000+ pincodes" },
        { id: "tb_return", icon: "rotate-ccw", label: "15-day returns", sublabel: "Free pickup" },
        {
          id: "tb_warranty",
          icon: "shield-check",
          label: "2-year warranty",
          sublabel: "Stitching and hardware",
        },
        { id: "tb_secure", icon: "lock", label: "Secure payments", sublabel: "Razorpay protected" },
        {
          id: "tb_support",
          icon: "headphones",
          label: "9am–9pm support",
          sublabel: "WhatsApp in 10 mins",
        },
      ],
      paymentLogos: [
        "upi",
        "gpay",
        "phonepe",
        "paytm",
        "rupay",
        "visa",
        "mastercard",
        "netbanking",
        "cod",
      ],
    },
  },

  tracking: {
    gtmId: "GTM-KAARVA1",
    ga4MeasurementId: "G-KAARVA0001",
    metaPixelId: "1188220044556677",
    googleAdsConversionId: "AW-998877665",
    googleAdsConversionLabel: "toteMonsoonPurchase",
    conversionEventName: "cta_click",
    utmDefaults: {
      source: "meta",
      medium: "paid_social",
      campaign: "monsoon-tote-cold",
      content: "meera-tote-500off",
    },
  },

  status: "draft",
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-01T09:00:00.000Z",
} satisfies z.input<typeof PageSchema>;

/**
 * The example page, parsed through `PageSchema` so every default is applied and the document
 * is provably valid at import time. Treat it as immutable — clone before mutating.
 */
export const mockPage: Page = PageSchema.parse(rawMockPage);

/** Convenience for callers that want an independent copy to edit. */
export function cloneMockPage(): Page {
  return structuredClone(mockPage);
}
