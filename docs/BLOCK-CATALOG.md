# Landing Agent — Block Catalog Specification

**Status:** Contract. Version 1.0.
**Audience:** Every engineer, prompt author, and schema author on this project.
**Rule:** If it is not in this document, it does not exist. If you need something new, amend this
document first, then write the code.

---

## 0. Preamble — how to read this document

### 0.1 The architectural contract

The AI **never** emits HTML, JSX, CSS, or Tailwind classes. It emits a JSON document that conforms to
`PageSchema`. That JSON references block types from the **locked registry** defined below. The Puck
editor reads and writes the exact same JSON. There is no lossy transformation step anywhere in the
pipeline.

```
Anthropic SDK ──(JSON)──▶ Zod validate ──▶ page.json ──▶ Puck editor ──▶ page.json ──▶ Renderer
                              ▲                                              │
                              └──────────── AI edit pass ◀───────────────────┘
```

Every block instance on a page has this envelope:

```ts
interface BlockInstance<T extends BlockType = BlockType> {
  id: string;          // stable, unique per page, e.g. "blk_hero_8f21a". NEVER reused, NEVER an index.
  type: T;             // one of the 12 flow block type ids
  props: PropsFor<T>;  // validated by the Zod schema for that type
  hidden?: boolean;    // soft-delete: keeps the block in the JSON but skips render. Default false.
  notes?: string;      // internal marketer/AI annotation. Never rendered.
}
```

**Addressing rule (non-negotiable):** all AI edit operations and all editor operations address blocks by
`id`. Never by array index. Never by type. An operation like `{ op: "update", id: "blk_hero_8f21a",
path: "props.headline", value: "..." }` is legal. `{ op: "update", index: 0, ... }` is illegal and must
be rejected at the schema boundary.

### 0.2 Content props vs structural props

Every prop is tagged in the tables below:

| Tag | Meaning | Marketer can edit in Puck? | AI can set at generation? | AI can change on edit pass? |
|---|---|---|---|---|
| **C** — content | Words, numbers, images, links — the meaning of the block | Yes | Yes | Yes |
| **S** — structural | Layout, variant, column count, theme — the shape of the block | Yes, from a fixed enum | Yes, from a fixed enum | Yes, from a fixed enum |
| **L** — locked | System fields (`id`, analytics keys, data bindings resolved server-side) | No — hidden from the Puck field list | Set once at generation | No |

Structural props are always **enums or bounded numbers**, never free strings. This is what stops the AI
from inventing a layout the renderer cannot draw.

### 0.3 Shared primitive types

These are referenced by many blocks. Define once in `src/schema/primitives.ts`.

```ts
// Money — always stored as integer paise to avoid float drift. Rendered as ₹ with Indian grouping.
type Money = {
  amount: number;        // integer, in paise. 149900 = ₹1,499.00
  currency: "INR";       // locked. Prototype is India-only.
};

// Image — every image needs alt text for accessibility AND for Meta/Google ad policy review.
type ImageRef = {
  src: string;           // absolute URL or /public path
  alt: string;           // required, non-empty. Max 125 chars.
  width?: number;
  height?: number;
  focal?: "center" | "top" | "bottom" | "left" | "right"; // default "center"
};

// Icon — from a locked lucide-react subset. AI cannot supply arbitrary SVG.
type IconName =
  | "truck" | "shield-check" | "rotate-ccw" | "banknote" | "smartphone" | "leaf"
  | "sparkles" | "clock" | "flame" | "heart" | "star" | "award" | "package"
  | "thumbs-up" | "zap" | "lock" | "headphones" | "check" | "x" | "gift";

// Theme token — locked palette slots, resolved by the Tailwind v4 @theme block.
type ToneToken = "brand" | "accent" | "neutral" | "success" | "warning" | "danger" | "dark" | "light";

type Rating = number; // 0–5, one decimal place. e.g. 4.6
```

---

## 1. THE CHECKOUT ACTION MODEL

This is the single most important shared type in the system. **Every CTA button in every block uses it.**
No block is allowed to define its own ad-hoc link shape.

```ts
type CheckoutAction =
  | { kind: "shopify";  productId: string; variantId?: string; quantity?: number;
      discountCode?: string; mode?: "cart" | "direct-checkout" }
  | { kind: "whatsapp"; phone: string; messageTemplate: string; businessName?: string }
  | { kind: "form";     formId: string; fields: FormField[]; submitLabel?: string;
      successMessage?: string; webhookUrl?: string }
  | { kind: "url";      href: string; target?: "_self" | "_blank"; rel?: string };
```

### 1.1 Variant details

**`kind: "shopify"`**

| Field | Type | Req | Default | Description |
|---|---|---|---|---|
| `productId` | string | ✅ | — | Shopify numeric product id or handle. |
| `variantId` | string | ❌ | resolved from block's selected variant | Shopify numeric variant id. If the containing block has a variant selector, the selected variant overrides this at click time. |
| `quantity` | number (int ≥ 1) | ❌ | `1` | Quantity added. Overridden by the hero quantity stepper if present. |
| `discountCode` | string | ❌ | — | Auto-applied on checkout. Uppercase, `[A-Z0-9_-]{3,32}`. |
| `mode` | `"cart" \| "direct-checkout"` | ❌ | `"direct-checkout"` | Cold paid traffic should skip the cart. Default is deliberate. |

Resolves to: `https://{shop}/cart/{variantId}:{quantity}?discount={code}` for direct checkout.

**`kind: "whatsapp"`**

| Field | Type | Req | Default | Description |
|---|---|---|---|---|
| `phone` | string | ✅ | — | E.164 without `+`, e.g. `919876543210`. Validated: `^91[6-9]\d{9}$` for India. |
| `messageTemplate` | string | ✅ | — | Prefilled message. Supports tokens: `{{product}}`, `{{variant}}`, `{{price}}`, `{{page}}`, `{{utm_campaign}}`. |
| `businessName` | string | ❌ | — | Shown in the CTA subtitle, e.g. "Chat with Nykaa Support". |

Resolves to: `https://wa.me/{phone}?text={encodeURIComponent(rendered template)}`.
On desktop the renderer must use `https://web.whatsapp.com/send?phone=...` — this is a renderer
concern, not a schema concern.

**`kind: "form"`**

| Field | Type | Req | Default | Description |
|---|---|---|---|---|
| `formId` | string | ✅ | — | Stable id; used as the storage key for submissions JSON. |
| `fields` | `FormField[]` | ✅ | — | 1–6 fields. More than 4 fields on mobile measurably kills lead rate; the generator must warn above 4. |
| `submitLabel` | string | ❌ | `"Submit"` | Button label inside the form. |
| `successMessage` | string | ❌ | `"Thanks! We'll call you shortly."` | Shown after submit. |
| `webhookUrl` | string (url) | ❌ | — | Optional POST target in addition to disk storage. |

```ts
type FormField = {
  name: string;                  // machine key, snake_case
  label: string;                 // shown to user
  type: "text" | "tel" | "email" | "pincode" | "select" | "textarea";
  required?: boolean;            // default false
  placeholder?: string;
  options?: string[];            // required when type === "select"
  validation?: string;           // named validator id: "in-mobile" | "in-pincode" | "email"
};
```

`type: "tel"` must default to `validation: "in-mobile"` (`^[6-9]\d{9}$`) and render
`inputmode="numeric"` with a fixed `+91` prefix. Indian users abandon on tel fields that require typing
the country code.

**`kind: "url"`**

| Field | Type | Req | Default | Description |
|---|---|---|---|---|
| `href` | string | ✅ | — | Absolute URL or in-page anchor (`#offers`). |
| `target` | `"_self" \| "_blank"` | ❌ | `"_self"` | Off-site links should be `_blank`. |
| `rel` | string | ❌ | `"noopener noreferrer"` when target is `_blank` | Standard rel. |

### 1.2 Rules that apply to every CheckoutAction

1. **One primary action per page.** All primary CTAs on a page must resolve to the *same* `kind` and
   the *same* destination. Mixing "Buy on Shopify" and "Order on WhatsApp" as co-equal primaries splits
   intent and costs conversions. Secondary CTAs may differ (e.g. primary = shopify, secondary =
   whatsapp for questions).
2. **Anchor CTAs are allowed as secondaries only.** `{ kind: "url", href: "#offer-stack" }` is a valid
   secondary; it must never be a page's only conversion path.
3. **Analytics is automatic.** The renderer attaches `data-cta-id={blockId}:{slot}` and fires a
   `cta_click` event with `{ blockId, blockType, actionKind, position }`. Blocks do not declare
   analytics props.
4. **UTM passthrough is automatic.** All incoming `utm_*`, `gclid`, `fbclid`, `wbraid` params are
   appended to `url` and `shopify` destinations and injected into `whatsapp` templates. Never model this
   in block props.

---

## 2. THE 12 FLOW BLOCKS

---

### 2.1 `announcement-bar`

**What it is:** A full-width strip pinned to the very top of the page, above the hero.

**Conversion job:** Deliver the single highest-value offer term *before* the visitor sees anything else,
so the ad's promise is confirmed within 300ms of paint. On cold paid traffic this is the message-match
handshake. Optionally adds a countdown to compress the decision window.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `text` | string | ✅ | — | C | Offer line. Max 70 chars — longer wraps to two lines on a 360px screen and pushes the hero down. |
| `mobileText` | string | ❌ | falls back to `text` | C | Shorter variant used below 640px. |
| `emphasis` | string | ❌ | — | C | Substring of `text` rendered bold/accent, e.g. the code `FLAT30`. |
| `tone` | `ToneToken` | ❌ | `"dark"` | S | Background tone slot. |
| `icon` | `IconName` | ❌ | — | C | Leading icon. |
| `link` | `CheckoutAction` | ❌ | — | C | Makes the whole bar tappable. Usually `{ kind: "url", href: "#offer-stack" }`. |
| `dismissible` | boolean | ❌ | `false` | S | Shows an × and persists dismissal in `localStorage` for 24h. Default false for paid traffic. |
| `sticky` | boolean | ❌ | `false` | S | Keeps the bar pinned on scroll. If true, `sticky-cta` must set `offsetTop`. |
| `countdown` | `CountdownConfig \| null` | ❌ | `null` | C | See below. |
| `marquee` | boolean | ❌ | `false` | S | Scrolls text horizontally when it overflows on mobile. |

```ts
type CountdownConfig = {
  mode: "fixed-deadline" | "rolling-window" | "daily-reset";
  deadline?: string;        // ISO 8601 with offset. Required when mode = "fixed-deadline".
  windowMinutes?: number;   // Required when mode = "rolling-window". Per-session, localStorage-backed.
  resetAtHour?: number;     // 0–23 IST. Required when mode = "daily-reset".
  expiredBehaviour: "hide" | "show-expired-text" | "restart";  // default "hide"
  expiredText?: string;
  labels?: { d: string; h: string; m: string; s: string };  // default { d:"d", h:"h", m:"m", s:"s" }
};
```

**Mobile behaviour:** Single line, `text-xs`, 32–36px tall, horizontal padding 12px. Uses `mobileText`
when present. If the string still overflows and `marquee` is false, it truncates with an ellipsis — it
never wraps to a second line, because two-line bars eat 8% of a 667px viewport. The countdown collapses
to `MM:SS` under 640px when under one hour, `HH:MM:SS` otherwise; days are dropped on mobile.

**Example**

```json
{
  "id": "blk_ann_a91c",
  "type": "announcement-bar",
  "props": {
    "text": "MONSOON SALE — Flat 40% OFF + Free Shipping across India",
    "mobileText": "FLAT 40% OFF + Free Shipping",
    "emphasis": "Flat 40% OFF",
    "tone": "dark",
    "icon": "sparkles",
    "dismissible": false,
    "sticky": false,
    "countdown": {
      "mode": "rolling-window",
      "windowMinutes": 30,
      "expiredBehaviour": "restart"
    },
    "link": { "kind": "url", "href": "#offer-stack" }
  }
}
```

---

### 2.2 `hero-product`

**What it is:** The above-the-fold conversion unit. Image gallery on one side, the entire buying decision
on the other.

**Conversion job:** Everything a visitor needs to say yes, in one screen: what it is, what it costs, what
they save, that other people trust it, and how to buy. On paid traffic 40–60% of visitors never scroll
past this block, so it must be independently sufficient.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `eyebrow` | string | ❌ | — | C | Small label above the title, e.g. "Bestseller · 12,000+ sold". Max 40 chars. |
| `title` | string | ✅ | — | C | Product name. Max 60 chars. Must contain the ad's core keyword. |
| `subtitle` | string | ❌ | — | C | One-sentence benefit, not a feature. Max 110 chars. |
| `gallery` | `ImageRef[]` | ✅ | — | C | 1–8 images. First is LCP and must be `priority`. |
| `galleryLayout` | `"thumbs-left" \| "thumbs-below" \| "carousel" \| "stacked"` | ❌ | `"thumbs-below"` | S | Desktop layout. Mobile always uses swipe carousel. |
| `rating` | `RatingSummary \| null` | ❌ | `null` | C | Aggregate rating shown under the title. |
| `price` | `Money` | ✅ | — | C | Current selling price. |
| `compareAtPrice` | `Money \| null` | ❌ | `null` | C | Struck-through MRP. Must be > `price` or Zod rejects. |
| `discountBadge` | `DiscountBadge \| null` | ❌ | auto-computed from price pair | C | Badge config. `auto` mode derives "40% OFF". |
| `priceNote` | string | ❌ | `"Inclusive of all taxes"` | C | Small print under price. |
| `variants` | `VariantGroup[]` | ❌ | `[]` | C | 0–3 groups (e.g. Size, Colour, Pack). |
| `showQuantity` | boolean | ❌ | `true` | S | Renders the quantity stepper. |
| `quantityMax` | number (int 1–10) | ❌ | `5` | S | Stepper cap. |
| `primaryCta` | `CtaSpec` | ✅ | — | C | The main buy button. |
| `secondaryCta` | `CtaSpec \| null` | ❌ | `null` | C | Lower-commitment alternative. |
| `trustChips` | `TrustChip[]` | ❌ | `[]` | C | 0–4 chips under the CTAs. |
| `bullets` | string[] | ❌ | `[]` | C | 0–5 scannable benefit lines. Max 70 chars each. |
| `stockLine` | string | ❌ | — | C | e.g. "Only 14 left in stock". Prefer `urgency-strip` for anything data-bound. |
| `layout` | `"media-left" \| "media-right"` | ❌ | `"media-left"` | S | Desktop split direction. |
| `background` | `ToneToken` | ❌ | `"light"` | S | Section background. |

```ts
type RatingSummary = {
  value: Rating;            // 0–5
  count: number;            // integer ≥ 0
  label?: string;           // e.g. "verified reviews"
  linkToReviews?: boolean;  // default true — anchors to the review-wall block
};

type DiscountBadge = {
  mode: "auto-percent" | "auto-amount" | "manual";
  text?: string;            // required when mode = "manual", e.g. "LAUNCH PRICE"
  tone?: ToneToken;         // default "danger"
  shape?: "pill" | "corner-ribbon" | "burst";  // default "pill"
};

type VariantGroup = {
  id: string;               // "size" | "colour" | custom slug
  label: string;            // "Choose your size"
  style: "swatch" | "chip" | "dropdown" | "card";
  required?: boolean;       // default true
  options: VariantOption[];
};

type VariantOption = {
  id: string;
  label: string;
  shopifyVariantId?: string;   // overrides primaryCta.action.variantId on selection
  priceDelta?: Money;          // added to base price when selected
  swatchHex?: string;          // for style "swatch"
  image?: ImageRef;            // switches the gallery on selection
  soldOut?: boolean;           // default false
  badge?: string;              // e.g. "Most popular"
};

type CtaSpec = {
  label: string;               // max 28 chars
  sublabel?: string;           // max 40 chars, e.g. "COD available · Ships in 24h"
  action: CheckoutAction;
  variant?: "solid" | "outline" | "ghost";  // default "solid" for primary, "outline" for secondary
  tone?: ToneToken;            // default "brand"
  icon?: IconName;
  fullWidth?: boolean;         // default true on mobile regardless
};

type TrustChip = {
  icon: IconName;
  label: string;               // max 22 chars
  tooltip?: string;
};
```

**Mobile behaviour:** Single column, strict order: gallery → eyebrow → title → rating → price row →
bullets → variants → quantity → primary CTA → secondary CTA → trust chips. The gallery is a
snap-scroll carousel with dot indicators, capped at `60vh` so the price and CTA are reachable within one
thumb-scroll. **Hard requirement: the primary CTA must be visible or reachable within one 400px scroll
from paint on a 360×640 viewport.** Trust chips wrap to a 2×2 grid. Variant swatches must have a 44px
minimum touch target. If `gallery.length > 4`, mobile lazy-loads images 2..n.

**Example**

```json
{
  "id": "blk_hero_8f21a",
  "type": "hero-product",
  "props": {
    "eyebrow": "Bestseller · 18,400+ sold",
    "title": "Kumkumadi Radiance Face Oil",
    "subtitle": "Cold-pressed Ayurvedic oil that visibly fades dark spots in 4 weeks — dermat tested.",
    "gallery": [
      { "src": "/img/kumkumadi-hero.webp", "alt": "Kumkumadi Radiance Face Oil 30ml amber glass bottle with dropper", "width": 1200, "height": 1200 },
      { "src": "/img/kumkumadi-texture.webp", "alt": "Golden oil texture swatch on skin" },
      { "src": "/img/kumkumadi-ingredients.webp", "alt": "Saffron, sandalwood and manjistha ingredients laid flat" },
      { "src": "/img/kumkumadi-results.webp", "alt": "Before and after 4 weeks of use on Indian skin tone" }
    ],
    "galleryLayout": "thumbs-below",
    "rating": { "value": 4.6, "count": 2841, "label": "verified reviews", "linkToReviews": true },
    "price": { "amount": 89900, "currency": "INR" },
    "compareAtPrice": { "amount": 149900, "currency": "INR" },
    "discountBadge": { "mode": "auto-percent", "tone": "danger", "shape": "pill" },
    "priceNote": "Inclusive of all taxes · Free shipping over ₹499",
    "bullets": [
      "Fades pigmentation & dark spots in 4 weeks",
      "24-carat saffron + cold-pressed sesame base",
      "No parabens, no mineral oil, no fragrance",
      "Safe for sensitive & acne-prone skin"
    ],
    "variants": [
      {
        "id": "pack",
        "label": "Choose your pack",
        "style": "card",
        "required": true,
        "options": [
          { "id": "p1", "label": "1 Bottle (30ml)", "shopifyVariantId": "44831002", "priceDelta": { "amount": 0, "currency": "INR" } },
          { "id": "p2", "label": "Pack of 2 — Save ₹400", "shopifyVariantId": "44831003", "priceDelta": { "amount": 69900, "currency": "INR" }, "badge": "Most popular" },
          { "id": "p3", "label": "Pack of 3 — Save ₹900", "shopifyVariantId": "44831004", "priceDelta": { "amount": 129900, "currency": "INR" } }
        ]
      }
    ],
    "showQuantity": true,
    "quantityMax": 5,
    "primaryCta": {
      "label": "Buy Now",
      "sublabel": "COD available · Ships in 24 hrs",
      "variant": "solid",
      "tone": "brand",
      "icon": "zap",
      "action": { "kind": "shopify", "productId": "7781234", "variantId": "44831003", "quantity": 1, "discountCode": "MONSOON40", "mode": "direct-checkout" }
    },
    "secondaryCta": {
      "label": "Order on WhatsApp",
      "variant": "outline",
      "icon": "smartphone",
      "action": {
        "kind": "whatsapp",
        "phone": "919876543210",
        "businessName": "Vedaroots Support",
        "messageTemplate": "Hi! I want to order {{product}} ({{variant}}) at {{price}}. Please help me place the order."
      }
    },
    "trustChips": [
      { "icon": "truck", "label": "Free shipping ₹499+" },
      { "icon": "banknote", "label": "Cash on Delivery" },
      { "icon": "rotate-ccw", "label": "15-day returns" },
      { "icon": "shield-check", "label": "100% authentic" }
    ],
    "layout": "media-left",
    "background": "light"
  }
}
```

---

### 2.3 `urgency-strip`

**What it is:** A horizontal strip of live-ish scarcity and social signals sitting directly under the
hero.

**Conversion job:** Convert "I'll think about it" into "I'll do it now" by showing that the offer is
finite and that other people are acting. This is the single highest-leverage block for cold traffic — and
the single easiest one to get sued over, which is why **every signal carries a data source**.

#### The data-source model (read this carefully)

No signal value may be a bare number that the AI invented. Every signal is a discriminated union of a
**binding** plus a **display config**. The renderer resolves the binding server-side (or at ISR time)
before paint.

```ts
type DataSource =
  | { mode: "static";     value: number; verified?: boolean }
  | { mode: "api";        endpoint: string; jsonPath: string; refreshSeconds?: number;
                          fallback: number; staleBehaviour?: "show-fallback" | "hide-signal" }
  | { mode: "shopify-inventory"; productId: string; variantId?: string; fallback: number }
  | { mode: "analytics";  metric: "active_visitors" | "units_sold" | "add_to_cart" | "orders";
                          windowMinutes: number; fallback: number }
  | { mode: "simulated";  min: number; max: number; driftPerMinute?: number; seed?: string;
                          disclosure: string };
```

**Governance rules — the generator MUST obey these:**

1. `mode: "simulated"` requires a non-empty `disclosure` string. It is the only mode where the number is
   not real, and the block renders a small "*indicative" footnote sourced from that string.
2. The AI generator's **default is `mode: "static"` with `verified: false`**, plus a `notes` field on the
   block instance flagging that a human must bind or confirm the number before publish.
3. A page containing any `mode: "simulated"` signal is flagged in the validator with severity `warn` and
   cannot be published without an explicit human acknowledgement. `mode: "static", verified: false`
   raises the same warn.
4. `mode: "api"` and `mode: "shopify-inventory"` must supply a `fallback`. The strip must never render an
   empty slot, a `0`, or a spinner on paint — a broken scarcity signal reads as a broken store.
5. Stock-remaining signals must never render below `stockCriticalFloor` (see below). Showing "0 left"
   next to a Buy button is a guaranteed bounce.

#### Props

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `signals` | `UrgencySignal[]` | ✅ | — | C | 1–4 signals. More than 4 reads as noise and loses credibility. |
| `layout` | `"row" \| "grid" \| "ticker"` | ❌ | `"row"` | S | Desktop arrangement. |
| `tone` | `ToneToken` | ❌ | `"warning"` | S | Strip background tone. |
| `dividers` | boolean | ❌ | `true` | S | Vertical rules between signals. |
| `animate` | boolean | ❌ | `true` | S | Pulse dot on live signals. Respects `prefers-reduced-motion`. |
| `disclosureText` | string | ❌ | — | C | Footnote shown when any signal is simulated or unverified. |
| `sticky` | boolean | ❌ | `false` | S | Pin under the header on scroll. Use sparingly. |

```ts
type UrgencySignal =
  | { kind: "units-sold";      label: string; source: DataSource;
      period?: string; format?: "plain" | "compact" | "plus"; icon?: IconName }
  | { kind: "people-viewing";  label: string; source: DataSource;
      minDisplay?: number; icon?: IconName }
  | { kind: "stock-remaining"; label: string; source: DataSource;
      stockCriticalFloor?: number; showBar?: boolean; barMax?: number; icon?: IconName }
  | { kind: "countdown";       label: string; config: CountdownConfig; icon?: IconName }
  | { kind: "custom";          label: string; value: string; source: DataSource; icon?: IconName };
```

| Signal field | Type | Req | Default | Description |
|---|---|---|---|---|
| `label` | string | ✅ | — | Template with a `{value}` token, e.g. `"{value} sold in the last 24 hours"`. Max 48 chars. |
| `source` | `DataSource` | ✅ | — | Where the number comes from. See governance rules. |
| `period` | string | ❌ | `"24 hours"` | Human window label for `units-sold`. |
| `format` | enum | ❌ | `"compact"` | `compact` → `12.4k`; `plus` → `12,000+`; `plain` → `12,431`. |
| `minDisplay` | number | ❌ | `3` | `people-viewing` never renders below this. "1 person viewing" is anti-social-proof. |
| `stockCriticalFloor` | number | ❌ | `3` | `stock-remaining` clamps to this minimum. |
| `showBar` | boolean | ❌ | `true` | Renders a depletion bar for stock. |
| `barMax` | number | ❌ | `50` | Denominator for the depletion bar. |
| `icon` | `IconName` | ❌ | per-kind default | Leading icon. |

**Mobile behaviour:** `layout: "row"` collapses to a 2-column grid at ≤640px; with 3 signals the third
spans full width. `layout: "ticker"` rotates one signal at a time every 4s on mobile — preferred when
there are 4 signals, since 4 stacked signals push the fold. Countdown digits use tabular numerals to stop
layout shift. Font floor is 12px. Total strip height must stay ≤ 88px on mobile.

**Example**

```json
{
  "id": "blk_urg_3d0e",
  "type": "urgency-strip",
  "props": {
    "layout": "row",
    "tone": "warning",
    "dividers": true,
    "animate": true,
    "signals": [
      {
        "kind": "units-sold",
        "label": "{value} bottles sold in the last 24 hours",
        "period": "24 hours",
        "format": "plus",
        "icon": "flame",
        "source": { "mode": "analytics", "metric": "units_sold", "windowMinutes": 1440, "fallback": 340 }
      },
      {
        "kind": "people-viewing",
        "label": "{value} people viewing right now",
        "minDisplay": 6,
        "icon": "sparkles",
        "source": { "mode": "analytics", "metric": "active_visitors", "windowMinutes": 5, "fallback": 27 }
      },
      {
        "kind": "stock-remaining",
        "label": "Only {value} left at this price",
        "stockCriticalFloor": 4,
        "showBar": true,
        "barMax": 50,
        "icon": "package",
        "source": { "mode": "shopify-inventory", "productId": "7781234", "variantId": "44831003", "fallback": 12 }
      },
      {
        "kind": "countdown",
        "label": "Offer ends in {value}",
        "icon": "clock",
        "config": { "mode": "daily-reset", "resetAtHour": 23, "expiredBehaviour": "restart" }
      }
    ],
    "disclosureText": "Stock and viewer counts update every few minutes."
  }
}
```

---

### 2.4 `offer-stack`

**What it is:** Two to four side-by-side offer/bundle cards with an anchored "most popular" option.

**Conversion job:** Move the visitor from *whether* to buy to *which one* to buy, and lift AOV via
decoy pricing. In Indian D2C, multi-pack bundles routinely lift AOV 30–60% because the per-unit saving is
legible in rupees, not percentages.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `heading` | string | ❌ | `"Choose your pack"` | C | Section heading. Max 60 chars. |
| `subheading` | string | ❌ | — | C | Supporting line. Max 120 chars. |
| `offers` | `Offer[]` | ✅ | — | C | 2–4 offers. Exactly one may set `mostPopular: true`. |
| `columns` | `2 \| 3 \| 4` | ❌ | matches `offers.length` | S | Desktop columns. |
| `emphasis` | `"popular-scale" \| "popular-border" \| "flat"` | ❌ | `"popular-scale"` | S | How the highlighted card is distinguished. |
| `savingsDisplay` | `"amount" \| "percent" \| "both"` | ❌ | `"both"` | S | Rupee savings convert better than percentages in India; `both` shows "Save ₹400 (27%)". |
| `showPerUnit` | boolean | ❌ | `true` | S | Renders "₹450/bottle" — the strongest bundle justification. |
| `background` | `ToneToken` | ❌ | `"neutral"` | S | Section background. |
| `footnote` | string | ❌ | — | C | e.g. "All packs include free shipping." |

```ts
type Offer = {
  id: string;                    // stable, referenced by persona-cards recommendations
  title: string;                 // "Pack of 2" — max 32 chars
  subtitle?: string;             // "Best for a 2-month course" — max 60 chars
  image?: ImageRef;
  price: Money;                  // required
  compareAtPrice?: Money;        // struck-through; must be > price
  perUnitLabel?: string;         // "per bottle" — used with showPerUnit
  unitCount?: number;            // integer ≥ 1, used to compute per-unit price. Default 1.
  savingsLabel?: string;         // overrides computed savings text
  mostPopular?: boolean;         // default false. Max one per block.
  badge?: string;                // e.g. "Save the most" — max 20 chars
  badgeTone?: ToneToken;         // default "accent"
  includes?: string[];           // 0–6 bullet lines of what's in the pack
  freebies?: string[];           // 0–3 "+ Free travel size (₹299)" lines
  soldOut?: boolean;             // default false — renders disabled
  cta: CtaSpec;                  // required, one per offer
};
```

**Mobile behaviour:** Stacks to one column. The `mostPopular` card is **reordered to the top on mobile**
— the renderer applies `order` so the anchor is seen first without changing JSON order. Cards keep full
CTA buttons (never a "select" radio) because a visible button per card converts better on touch. Card
height is not equalised on mobile. If `offers.length === 4`, mobile renders a horizontal snap-scroll
carousel with a peek of the next card.

**Example**

```json
{
  "id": "blk_offers_5b7c",
  "type": "offer-stack",
  "props": {
    "heading": "Pick your Kumkumadi course",
    "subheading": "Visible results need 8 weeks of daily use — most customers pick the 2-pack.",
    "columns": 3,
    "emphasis": "popular-scale",
    "savingsDisplay": "both",
    "showPerUnit": true,
    "background": "neutral",
    "footnote": "Free shipping on all packs · COD available · 15-day returns",
    "offers": [
      {
        "id": "off_single",
        "title": "1 Bottle",
        "subtitle": "Try it for a month",
        "unitCount": 1,
        "perUnitLabel": "per bottle",
        "price": { "amount": 89900, "currency": "INR" },
        "compareAtPrice": { "amount": 149900, "currency": "INR" },
        "includes": ["30ml Kumkumadi Face Oil", "Free shipping"],
        "cta": { "label": "Buy 1 Bottle", "variant": "outline",
                 "action": { "kind": "shopify", "productId": "7781234", "variantId": "44831002", "mode": "direct-checkout" } }
      },
      {
        "id": "off_pack2",
        "title": "Pack of 2",
        "subtitle": "Best for a full 8-week course",
        "unitCount": 2,
        "perUnitLabel": "per bottle",
        "price": { "amount": 159900, "currency": "INR" },
        "compareAtPrice": { "amount": 299800, "currency": "INR" },
        "mostPopular": true,
        "badge": "Most popular",
        "badgeTone": "accent",
        "includes": ["2 × 30ml Kumkumadi Face Oil", "Free shipping", "Priority dispatch"],
        "freebies": ["+ Free jade roller (worth ₹499)"],
        "cta": { "label": "Buy Pack of 2", "sublabel": "Save ₹1,399", "variant": "solid", "tone": "brand",
                 "action": { "kind": "shopify", "productId": "7781234", "variantId": "44831003", "discountCode": "MONSOON40", "mode": "direct-checkout" } }
      },
      {
        "id": "off_pack3",
        "title": "Pack of 3",
        "subtitle": "Family pack — lowest per-bottle price",
        "unitCount": 3,
        "perUnitLabel": "per bottle",
        "price": { "amount": 219900, "currency": "INR" },
        "compareAtPrice": { "amount": 449700, "currency": "INR" },
        "badge": "Save the most",
        "includes": ["3 × 30ml Kumkumadi Face Oil", "Free shipping", "Priority dispatch"],
        "freebies": ["+ Free jade roller (worth ₹499)", "+ Free cotton pouch"],
        "cta": { "label": "Buy Pack of 3", "sublabel": "Save ₹2,298", "variant": "outline",
                 "action": { "kind": "shopify", "productId": "7781234", "variantId": "44831004", "mode": "direct-checkout" } }
      }
    ]
  }
}
```

---

### 2.5 `product-narrative`

**What it is:** The brand story / "why this exists" section — heading, prose body, a trio of proof stats,
and an optional supporting image.

**Conversion job:** Convert a price-shopper into a brand-buyer. On cold traffic this is where an unknown
brand earns the right to be trusted, and where the stat trio converts vague credibility into countable
facts. It also lowers COD refusal rates, which is a real margin line item in India.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `eyebrow` | string | ❌ | — | C | Small label, e.g. "Our story". Max 30 chars. |
| `heading` | string | ✅ | — | C | Max 80 chars. Should be a claim, not a label. |
| `body` | string | ✅ | — | C | 40–600 chars. Plain text; supports `\n\n` paragraph breaks. No HTML. |
| `stats` | `NarrativeStat[]` | ❌ | `[]` | C | Exactly 0 or 3 entries. Zod enforces this — a "stat trio" with 2 items looks broken. |
| `image` | `ImageRef \| null` | ❌ | `null` | C | Supporting visual: founder, sourcing, lab, process. |
| `imagePosition` | `"left" \| "right" \| "background" \| "none"` | ❌ | `"right"` | S | Desktop placement. |
| `signature` | `Signature \| null` | ❌ | `null` | C | Founder attribution block. |
| `cta` | `CtaSpec \| null` | ❌ | `null` | C | Optional soft CTA — usually `{ kind: "url", href: "#offer-stack" }`. |
| `background` | `ToneToken` | ❌ | `"light"` | S | Section background. |
| `maxWidth` | `"prose" \| "wide"` | ❌ | `"prose"` | S | Body measure. `prose` caps at ~68ch. |

```ts
type NarrativeStat = {
  value: string;        // "12,000+" | "4.6★" | "100%" — string, not number, so units render exactly
  label: string;        // "happy customers" — max 32 chars
  icon?: IconName;
  source?: DataSource;  // optional binding; when present the value is resolved, not typed
};

type Signature = {
  name: string;
  role: string;         // "Founder, Vedaroots"
  avatar?: ImageRef;
};
```

**Mobile behaviour:** Single column, image above text (regardless of `imagePosition`, except `background`
which stays a background). Stats render as a 3-across row of compact tiles — never stacked vertically,
because a vertical stat column reads as three unrelated numbers. Body text clamps to 5 lines with a
"Read more" toggle when over 380 chars. Font 15px minimum, line-height 1.6.

**Example**

```json
{
  "id": "blk_story_c112",
  "type": "product-narrative",
  "props": {
    "eyebrow": "Why we made this",
    "heading": "A 400-year-old Ayurvedic formula, made honestly for modern Indian skin",
    "body": "Most kumkumadi oils on the market use synthetic colour to fake the saffron glow. We source Kashmiri Mongra saffron directly from growers in Pampore, cold-press it into organic sesame oil, and bottle it in amber glass within 14 days of extraction.\n\nNo mineral oil. No fragrance. No shortcuts. Just the formula, made the way it was meant to be made.",
    "stats": [
      { "value": "18,400+", "label": "bottles sold", "icon": "package" },
      { "value": "4.6★", "label": "average rating", "icon": "star" },
      { "value": "14 days", "label": "saffron to bottle", "icon": "leaf" }
    ],
    "image": { "src": "/img/pampore-saffron.webp", "alt": "Saffron growers hand-picking Mongra saffron in Pampore, Kashmir" },
    "imagePosition": "right",
    "signature": {
      "name": "Ananya Menon",
      "role": "Founder, Vedaroots",
      "avatar": { "src": "/img/founder.webp", "alt": "Ananya Menon, founder of Vedaroots" }
    },
    "cta": { "label": "See the packs", "variant": "ghost", "action": { "kind": "url", "href": "#blk_offers_5b7c" } },
    "background": "light",
    "maxWidth": "prose"
  }
}
```

---

### 2.6 `collection-grid`

**What it is:** A responsive grid of other products from the catalogue.

**Conversion job:** Catch the visitor whose intent doesn't match the hero product before they bounce, and
give returning/warm traffic a browse path. On single-product paid campaigns this block should sit **low**
on the page — placed high, it leaks attention from the primary conversion.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `heading` | string | ❌ | `"Explore the full range"` | C | Max 60 chars. |
| `subheading` | string | ❌ | — | C | Max 120 chars. |
| `items` | `CollectionItem[]` | ✅ | — | C | 2–12 items. |
| `columns` | `2 \| 3 \| 4` | ❌ | `4` | S | Desktop columns. |
| `mobileColumns` | `1 \| 2` | ❌ | `2` | S | Mobile columns. `2` is correct for Indian D2C — thumbnail browsing beats one-up scrolling. |
| `mobileLayout` | `"grid" \| "carousel"` | ❌ | `"carousel"` | S | Carousel when `items.length > 6`. |
| `aspectRatio` | `"1:1" \| "4:5" \| "3:4"` | ❌ | `"1:1"` | S | Enforced image box; prevents CLS. |
| `showPrice` | boolean | ❌ | `true` | S | Toggle price line. |
| `showCompareAt` | boolean | ❌ | `true` | S | Toggle struck-through price. |
| `cardCta` | `"none" \| "button" \| "whole-card"` | ❌ | `"whole-card"` | S | How the card is actioned. |
| `cardCtaLabel` | string | ❌ | `"View"` | C | Used when `cardCta === "button"`. |
| `viewAll` | `CtaSpec \| null` | ❌ | `null` | C | "View all products" link under the grid. |
| `background` | `ToneToken` | ❌ | `"light"` | S | Section background. |

```ts
type CollectionItem = {
  id: string;
  image: ImageRef;              // required — a grid card with no image is dead weight
  name: string;                 // max 48 chars
  subtitle?: string;            // max 60 chars, e.g. "For dry & dull skin"
  price: Money;
  compareAtPrice?: Money;
  badge?: string;               // "Bestseller" | "New" | "Only 5 left" — max 16 chars
  badgeTone?: ToneToken;
  rating?: RatingSummary;
  soldOut?: boolean;            // default false
  action: CheckoutAction;       // required
};
```

**Mobile behaviour:** Default 2-up grid with 12px gutters; card names clamp to 2 lines; price sits on one
line with the compare-at inline after it, never on a second row. When `mobileLayout: "carousel"`, cards
are 62vw wide with snap points and a visible peek of the next card. Badges render as a corner pill at
10px. Images are `loading="lazy"` with explicit dimensions from `aspectRatio`.

**Example**

```json
{
  "id": "blk_grid_d40f",
  "type": "collection-grid",
  "props": {
    "heading": "Complete your Ayurvedic routine",
    "subheading": "Pairs perfectly with the Kumkumadi Face Oil",
    "columns": 4,
    "mobileColumns": 2,
    "mobileLayout": "carousel",
    "aspectRatio": "1:1",
    "showPrice": true,
    "showCompareAt": true,
    "cardCta": "whole-card",
    "background": "light",
    "items": [
      { "id": "p_ubtan", "image": { "src": "/img/ubtan.webp", "alt": "Vedaroots Ubtan Face Pack 100g jar" },
        "name": "Ubtan Glow Face Pack", "subtitle": "For instant brightness",
        "price": { "amount": 54900, "currency": "INR" }, "compareAtPrice": { "amount": 79900, "currency": "INR" },
        "badge": "Bestseller", "rating": { "value": 4.5, "count": 1120 },
        "action": { "kind": "url", "href": "/products/ubtan-face-pack" } },
      { "id": "p_rose", "image": { "src": "/img/rose-water.webp", "alt": "Steam distilled rose water toner 200ml" },
        "name": "Kannauj Rose Water Toner", "subtitle": "Steam distilled, no alcohol",
        "price": { "amount": 39900, "currency": "INR" }, "compareAtPrice": { "amount": 59900, "currency": "INR" },
        "rating": { "value": 4.7, "count": 2340 },
        "action": { "kind": "url", "href": "/products/rose-water-toner" } },
      { "id": "p_bhringraj", "image": { "src": "/img/bhringraj.webp", "alt": "Bhringraj hair oil 100ml bottle" },
        "name": "Bhringraj Hair Oil", "subtitle": "Reduces hairfall in 6 weeks",
        "price": { "amount": 64900, "currency": "INR" }, "compareAtPrice": { "amount": 89900, "currency": "INR" },
        "badge": "New", "badgeTone": "success",
        "action": { "kind": "url", "href": "/products/bhringraj-hair-oil" } },
      { "id": "p_kit", "image": { "src": "/img/glow-kit.webp", "alt": "Complete glow ritual kit with four products" },
        "name": "Complete Glow Ritual Kit", "subtitle": "All 4 bestsellers",
        "price": { "amount": 179900, "currency": "INR" }, "compareAtPrice": { "amount": 329600, "currency": "INR" },
        "badge": "Save ₹1,497", "badgeTone": "danger",
        "action": { "kind": "url", "href": "/products/glow-ritual-kit" } }
    ],
    "viewAll": { "label": "View all 24 products", "variant": "outline", "action": { "kind": "url", "href": "/collections/all" } }
  }
}
```

---

### 2.7 `persona-cards`

**What it is:** Two to four cards, each describing a type of buyer and pointing them at the right product
or pack.

**Conversion job:** Self-selection. Instead of one message trying to fit everyone, the visitor recognises
themselves ("dull skin after 30", "acne-prone") and is routed to the right SKU. This converts especially
well on broad-targeted Meta traffic where the audience is heterogeneous, and it reduces returns by
setting correct expectations pre-purchase.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `heading` | string | ❌ | `"Which one is right for you?"` | C | Max 70 chars. |
| `subheading` | string | ❌ | — | C | Max 120 chars. |
| `personas` | `Persona[]` | ✅ | — | C | 2–4 entries. Zod rejects 1 or >4. |
| `columns` | `2 \| 3 \| 4` | ❌ | matches `personas.length` | S | Desktop columns. |
| `cardStyle` | `"outlined" \| "filled" \| "image-top"` | ❌ | `"outlined"` | S | Card treatment. |
| `background` | `ToneToken` | ❌ | `"neutral"` | S | Section background. |

```ts
type Persona = {
  id: string;
  title: string;                 // "You're 30+ with dull, uneven skin" — max 52 chars. Second person.
  description: string;           // 40–220 chars. Names the pain before the fix.
  image?: ImageRef;
  icon?: IconName;               // used when no image
  matchPoints?: string[];        // 0–4 "This is you if…" checklist lines, max 60 chars each
  recommended: PersonaRecommendation;  // required — a persona card with no route is decoration
};

type PersonaRecommendation = {
  offerId?: string;              // preferred: references an Offer.id in offer-stack — keeps pricing single-sourced
  productName?: string;          // fallback display name when offerId is absent
  image?: ImageRef;
  price?: Money;                 // only when offerId is absent
  reason?: string;               // "Highest saffron concentration" — max 60 chars
  cta: CtaSpec;                  // required
};
```

**Resolution rule:** when `offerId` is present, the renderer pulls name, price, and image from the
referenced `offer-stack` offer. This prevents the classic bug where a marketer updates a price in the
offer stack and the persona card silently disagrees. If `offerId` does not resolve, the validator raises
an `error`.

**Mobile behaviour:** Single column stack; each card fully self-contained with its own CTA. Cards collapse
`matchPoints` to a 2-line summary with a chevron expander when there are more than 2. Minimum card
padding 16px; CTA is full-width inside the card. With 4 personas, mobile uses a snap carousel to avoid a
2000px-tall wall.

**Example**

```json
{
  "id": "blk_persona_7a3b",
  "type": "persona-cards",
  "props": {
    "heading": "Which Kumkumadi routine fits your skin?",
    "subheading": "Pick the pack that matches your concern — results timelines differ.",
    "columns": 3,
    "cardStyle": "image-top",
    "background": "neutral",
    "personas": [
      {
        "id": "per_pigment",
        "title": "You're 30+ with stubborn pigmentation",
        "description": "Melasma patches and post-acne marks that haven't faded in months. You need consistent saffron exposure over a full 8-week cycle, not a two-week trial.",
        "image": { "src": "/img/persona-pigment.webp", "alt": "Woman in her thirties applying face oil" },
        "matchPoints": ["Dark patches on cheeks or upper lip", "Marks left after acne heals", "Tried vitamin C with little change"],
        "recommended": {
          "offerId": "off_pack2",
          "reason": "8-week course — the minimum for pigmentation",
          "cta": { "label": "Get the 2-Pack", "variant": "solid",
                   "action": { "kind": "shopify", "productId": "7781234", "variantId": "44831003", "mode": "direct-checkout" } }
        }
      },
      {
        "id": "per_dull",
        "title": "You just want your glow back",
        "description": "No major concerns — skin looks tired from screen time, late nights and Delhi pollution. A single bottle over a month is enough to see the difference.",
        "image": { "src": "/img/persona-dull.webp", "alt": "Woman looking at skin in mirror in daylight" },
        "matchPoints": ["Skin looks flat in photos", "Makeup sits unevenly", "First time trying facial oils"],
        "recommended": {
          "offerId": "off_single",
          "reason": "One month is enough for radiance",
          "cta": { "label": "Get 1 Bottle", "variant": "outline",
                   "action": { "kind": "shopify", "productId": "7781234", "variantId": "44831002", "mode": "direct-checkout" } }
        }
      },
      {
        "id": "per_gift",
        "title": "You're buying it for family",
        "description": "Mum, sister, mother-in-law — everyone wants their own bottle after they try yours. The 3-pack works out cheapest per bottle and ships in one box.",
        "image": { "src": "/img/persona-gift.webp", "alt": "Gift-wrapped Vedaroots pack of three bottles" },
        "matchPoints": ["Buying for more than one person", "Want the lowest per-bottle price"],
        "recommended": {
          "offerId": "off_pack3",
          "reason": "₹733 per bottle — lowest we offer",
          "cta": { "label": "Get the 3-Pack", "variant": "outline",
                   "action": { "kind": "shopify", "productId": "7781234", "variantId": "44831004", "mode": "direct-checkout" } }
        }
      }
    ]
  }
}
```

---

### 2.8 `value-pillars`

**What it is:** A numbered or icon-led row of 3–6 core value propositions.

**Conversion job:** Answer "why this one and not the ₹299 one on Amazon" in a scannable format. This is
the block a visitor reads in 4 seconds while deciding whether to keep scrolling. Numbered variants also
serve as a "how it works" ladder.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `heading` | string | ❌ | — | C | Max 70 chars. Optional — pillars can run headless. |
| `subheading` | string | ❌ | — | C | Max 120 chars. |
| `pillars` | `Pillar[]` | ✅ | — | C | 3–6 entries. |
| `numbering` | `"none" \| "numeric" \| "roman"` | ❌ | `"numeric"` | S | Prefix style. Use `numeric` for process steps, `none` for parallel benefits. |
| `columns` | `2 \| 3 \| 4` | ❌ | `3` | S | Desktop columns. |
| `iconStyle` | `"plain" \| "circle" \| "square" \| "none"` | ❌ | `"circle"` | S | Icon container treatment. |
| `align` | `"left" \| "center"` | ❌ | `"center"` | S | Text alignment inside each pillar. |
| `divider` | boolean | ❌ | `false` | S | Rules between pillars. |
| `background` | `ToneToken` | ❌ | `"light"` | S | Section background. |

```ts
type Pillar = {
  id: string;
  icon: IconName;         // required
  title: string;          // max 36 chars. Benefit phrasing, not feature phrasing.
  description: string;    // 30–160 chars.
  image?: ImageRef;       // optional, overrides icon when present
  tone?: ToneToken;       // per-pillar icon tint
};
```

**Mobile behaviour:** 3-column collapses to 1-column stacked list with the icon inline-left and text to
the right (not icon-above-text — the horizontal form is ~40% shorter and stays scannable). 4-column
collapses to 2×2 with icons above. Titles never wrap past 2 lines. Descriptions clamp at 3 lines with no
expander — if the copy doesn't fit, the copy is wrong.

**Example**

```json
{
  "id": "blk_pillars_9e5d",
  "type": "value-pillars",
  "props": {
    "heading": "Why 18,000+ Indians switched to Vedaroots",
    "numbering": "none",
    "columns": 4,
    "iconStyle": "circle",
    "align": "center",
    "background": "light",
    "pillars": [
      { "id": "pil_saffron", "icon": "sparkles", "title": "Real Kashmiri saffron",
        "description": "24-carat Mongra saffron from Pampore — not synthetic colourant. Lab certificate on every batch." },
      { "id": "pil_clean", "icon": "leaf", "title": "No mineral oil, ever",
        "description": "Cold-pressed organic sesame base. Free from parabens, silicones, synthetic fragrance and mineral oil." },
      { "id": "pil_tested", "icon": "shield-check", "title": "Dermatologist tested",
        "description": "Patch-tested on 120 Indian volunteers across skin types. Non-comedogenic and safe for sensitive skin." },
      { "id": "pil_cod", "icon": "banknote", "title": "COD & easy returns",
        "description": "Pay cash on delivery anywhere in India. Not happy in 15 days? Full refund, no questions asked." }
    ]
  }
}
```

---

### 2.9 `spec-table`

**What it is:** A two-column key/value table of product specifications, optionally grouped.

**Conversion job:** Remove the last factual objections — volume, shelf life, ingredients, origin,
compatibility — without cluttering the hero. It also serves the "I'm comparing tabs" visitor who needs a
number to compare. Under-specified pages generate WhatsApp support load; this block reduces it.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `heading` | string | ❌ | `"Product details"` | C | Max 60 chars. |
| `subheading` | string | ❌ | — | C | Max 120 chars. |
| `groups` | `SpecGroup[]` | ✅ | — | C | 1–4 groups. Use a single unnamed group for simple products. |
| `layout` | `"two-column" \| "single-column" \| "cards"` | ❌ | `"two-column"` | S | Desktop layout of the rows. |
| `striped` | boolean | ❌ | `true` | S | Zebra row shading — materially improves scan accuracy. |
| `collapsibleGroups` | boolean | ❌ | `false` | S | Renders each group as an accordion. Recommended when total rows > 12. |
| `image` | `ImageRef \| null` | ❌ | `null` | C | Optional product/diagram image alongside. |
| `footnote` | string | ❌ | — | C | e.g. "Specifications may vary marginally by batch." |
| `background` | `ToneToken` | ❌ | `"neutral"` | S | Section background. |

```ts
type SpecGroup = {
  id: string;
  title?: string;         // omit for an ungrouped table
  rows: SpecRow[];        // 1–20
};

type SpecRow = {
  id: string;
  label: string;          // max 40 chars
  value: string;          // max 160 chars. String, not number — units must render exactly ("30 ml", "24 months").
  icon?: IconName;
  highlight?: boolean;    // default false — bolds the row for a hero spec
  tooltip?: string;       // optional explainer, max 160 chars
};
```

**Mobile behaviour:** `two-column` collapses to stacked label-over-value pairs with the label at 12px
uppercase muted and the value at 15px. Never render a horizontally scrolling table on mobile — Indian
users on 360px screens abandon side-scrolling tables. Long value strings wrap freely. When
`collapsibleGroups` is true, the first group is expanded by default and the rest are collapsed.

**Example**

```json
{
  "id": "blk_spec_2c88",
  "type": "spec-table",
  "props": {
    "heading": "Everything about this bottle",
    "layout": "two-column",
    "striped": true,
    "collapsibleGroups": true,
    "background": "neutral",
    "footnote": "Natural oils vary slightly in shade between batches — this is expected.",
    "groups": [
      {
        "id": "grp_basics",
        "title": "The basics",
        "rows": [
          { "id": "r_vol", "label": "Net volume", "value": "30 ml (approx. 60 days of use)", "highlight": true },
          { "id": "r_form", "label": "Format", "value": "Cold-pressed facial oil with glass dropper" },
          { "id": "r_skin", "label": "Suitable for", "value": "All skin types, including sensitive and acne-prone" },
          { "id": "r_shelf", "label": "Shelf life", "value": "24 months unopened · 12 months after opening" },
          { "id": "r_origin", "label": "Country of origin", "value": "India (Made in Kerala)" }
        ]
      },
      {
        "id": "grp_ingredients",
        "title": "Key ingredients",
        "rows": [
          { "id": "r_saffron", "label": "Kashmiri saffron", "value": "0.8% Mongra grade — brightens and evens tone", "highlight": true },
          { "id": "r_sesame", "label": "Cold-pressed sesame oil", "value": "Base carrier, rich in vitamin E and sesamin" },
          { "id": "r_manjistha", "label": "Manjistha extract", "value": "Traditional Ayurvedic blood purifier, supports clarity" },
          { "id": "r_free", "label": "Free from", "value": "Parabens, sulphates, mineral oil, synthetic fragrance, silicones" }
        ]
      },
      {
        "id": "grp_usage",
        "title": "How to use",
        "rows": [
          { "id": "r_when", "label": "When", "value": "Nightly, on clean damp skin, as the last step" },
          { "id": "r_amount", "label": "How much", "value": "3–4 drops, pressed (not rubbed) into skin" },
          { "id": "r_results", "label": "First results", "value": "Radiance in 7–10 days · pigmentation in 6–8 weeks" },
          { "id": "r_store", "label": "Storage", "value": "Cool, dark place. Do not refrigerate." }
        ]
      }
    ]
  }
}
```

---

### 2.10 `review-wall`

**What it is:** Aggregate rating, a star-distribution histogram, and a set of individual review cards.

**Conversion job:** The heaviest-lifting trust block on the page. Distribution bars matter more than the
average — a visible spread of 5s with a few 4s and a stray 3 reads as real, while 100% 5-star reads as
purchased. Names with Indian cities and verified badges do more for COD conversion than any copy change.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `heading` | string | ❌ | `"What our customers say"` | C | Max 60 chars. |
| `summary` | `ReviewSummary` | ✅ | — | C | Aggregate block. |
| `showDistribution` | boolean | ❌ | `true` | S | Renders the 5→1 histogram. |
| `reviews` | `Review[]` | ✅ | — | C | 3–24 entries. |
| `layout` | `"grid" \| "masonry" \| "carousel"` | ❌ | `"grid"` | S | Desktop card arrangement. |
| `columns` | `2 \| 3` | ❌ | `3` | S | Desktop columns for grid/masonry. |
| `initialCount` | number (int) | ❌ | `6` | S | Reviews shown before "Load more". |
| `sortDefault` | `"recent" \| "helpful" \| "rating-desc"` | ❌ | `"helpful"` | S | Default order applied at render. |
| `filterable` | boolean | ❌ | `false` | S | Star-filter chips. Off by default — filters invite 1-star hunting on cold traffic. |
| `showPhotos` | boolean | ❌ | `true` | S | Renders customer photos when present. |
| `cta` | `CtaSpec \| null` | ❌ | `null` | C | Post-reviews CTA back to the offer. |
| `background` | `ToneToken` | ❌ | `"light"` | S | Section background. |

```ts
type ReviewSummary = {
  value: Rating;                 // 0–5, e.g. 4.6
  count: number;                 // integer ≥ 0, total reviews
  distribution: {                // counts per star; all five keys required when showDistribution
    "5": number; "4": number; "3": number; "2": number; "1": number;
  };
  label?: string;                // "Based on 2,841 verified reviews"
  source?: DataSource;           // optional binding to a reviews API (Judge.me, Loox)
  sourceBadge?: string;          // "Verified by Judge.me"
};

type Review = {
  id: string;
  name: string;                  // "Priya S." — max 40 chars
  location?: string;             // "Pune, Maharashtra" — max 40 chars. Strongly recommended for India.
  rating: Rating;                // 1–5, integer in practice
  date: string;                  // ISO date "2026-06-14". Rendered as "14 Jun 2026".
  title?: string;                // max 60 chars
  body: string;                  // 20–600 chars
  verified?: boolean;            // default false → renders "Verified buyer" badge when true
  photos?: ImageRef[];           // 0–3 customer photos
  variantPurchased?: string;     // "Pack of 2"
  helpfulCount?: number;         // integer ≥ 0
  response?: { author: string; body: string; date?: string };  // brand reply
};
```

**Mobile behaviour:** Summary and distribution stack: big rating number + stars + count, then the 5 bars
at 6px height. Review cards become a single column at full width; bodies clamp to 4 lines with a "Read
more" inline expander. `layout: "carousel"` is recommended when `reviews.length > 8` — a snap carousel at
85vw card width. Photos render as a 3-up thumbnail row that opens a lightbox. "Load more" is a real
button, never infinite scroll (infinite scroll breaks the scroll-depth analytics the PPC team relies on).

**Example**

```json
{
  "id": "blk_reviews_6f0a",
  "type": "review-wall",
  "props": {
    "heading": "2,841 verified reviews",
    "summary": {
      "value": 4.6,
      "count": 2841,
      "distribution": { "5": 1980, "4": 612, "3": 168, "2": 51, "1": 30 },
      "label": "Based on 2,841 verified purchases",
      "sourceBadge": "Verified by Judge.me",
      "source": { "mode": "api", "endpoint": "/api/reviews/summary", "jsonPath": "$.aggregate", "refreshSeconds": 3600, "fallback": 4.6, "staleBehaviour": "show-fallback" }
    },
    "showDistribution": true,
    "layout": "grid",
    "columns": 3,
    "initialCount": 6,
    "sortDefault": "helpful",
    "filterable": false,
    "showPhotos": true,
    "background": "light",
    "reviews": [
      { "id": "rev_1", "name": "Priya S.", "location": "Pune, Maharashtra", "rating": 5, "date": "2026-06-14",
        "title": "Pigmentation finally lightening", "verified": true, "variantPurchased": "Pack of 2", "helpfulCount": 214,
        "body": "I've had melasma patches since my second pregnancy and nothing worked. Six weeks in and the patches on my cheeks are noticeably lighter. The smell is very mild and it absorbs fast — no greasy pillow.",
        "photos": [{ "src": "/img/rev-priya-1.webp", "alt": "Customer photo showing lightened cheek pigmentation after six weeks" }] },
      { "id": "rev_2", "name": "Rakesh M.", "location": "Bengaluru, Karnataka", "rating": 5, "date": "2026-06-02",
        "verified": true, "variantPurchased": "1 Bottle", "helpfulCount": 96,
        "body": "Bought it for my wife, ended up using it myself. Skin feels less dull after long days in front of a screen. Delivery took 3 days and COD worked without any trouble." },
      { "id": "rev_3", "name": "Fathima K.", "location": "Kochi, Kerala", "rating": 4, "date": "2026-05-28",
        "title": "Good but slow", "verified": true, "helpfulCount": 61,
        "body": "The glow part is real and showed up in about ten days. The dark spots are taking longer than I hoped — maybe I need the second bottle. Packaging is lovely, glass bottle feels premium.",
        "response": { "author": "Vedaroots Team", "body": "Thank you Fathima! Spots typically need the full 8-week cycle. Ping us on WhatsApp and we'll share a usage schedule.", "date": "2026-05-29" } },
      { "id": "rev_4", "name": "Sneha T.", "location": "Ahmedabad, Gujarat", "rating": 5, "date": "2026-05-21",
        "verified": true, "variantPurchased": "Pack of 3", "helpfulCount": 44,
        "body": "Ordered the 3-pack for my mum, sister and me. All three of us have completely different skin and none of us broke out. That alone was worth it." },
      { "id": "rev_5", "name": "Anjali D.", "location": "Lucknow, Uttar Pradesh", "rating": 3, "date": "2026-05-09",
        "verified": true, "helpfulCount": 28,
        "body": "It's a decent oil and my skin does look brighter, but at this price I expected faster results on acne marks. Four weeks in, only slight change." },
      { "id": "rev_6", "name": "Meera R.", "location": "Chennai, Tamil Nadu", "rating": 5, "date": "2026-04-30",
        "title": "Third bottle now", "verified": true, "variantPurchased": "Pack of 2", "helpfulCount": 137,
        "body": "This is my third bottle. Chennai humidity usually makes oils unbearable but this one sinks in within a minute. My dermatologist actually approved it when I showed her the ingredient list." }
    ],
    "cta": { "label": "Get yours — Flat 40% off", "variant": "solid", "tone": "brand",
            "action": { "kind": "url", "href": "#blk_offers_5b7c" } }
  }
}
```

---

### 2.11 `comparison-table`

**What it is:** A feature matrix comparing "us" against named or generic alternatives, ending in a price
row and a CTA row.

**Conversion job:** Close the comparison-shopping objection inside your own page rather than losing the
visitor to a new tab. Framing matters: compare against *categories* ("Ordinary market oils", "Salon
treatments") rather than named competitors — named comparisons invite fact-checking and, on Meta, invite
ad disapproval.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `heading` | string | ❌ | `"How we compare"` | C | Max 60 chars. |
| `subheading` | string | ❌ | — | C | Max 120 chars. |
| `columns` | `ComparisonColumn[]` | ✅ | — | C | 2–4 columns. Exactly one must set `isUs: true`. |
| `rows` | `ComparisonRow[]` | ✅ | — | C | 3–12 feature rows. |
| `priceRow` | `PriceRow \| null` | ❌ | `null` | C | Optional final price comparison row. |
| `ctaRow` | boolean | ❌ | `true` | S | Renders each column's `cta` in a final row. |
| `highlightUs` | boolean | ❌ | `true` | S | Tints and outlines the "us" column. |
| `stickyFirstColumn` | boolean | ❌ | `true` | S | Pins the feature-label column when scrolling horizontally. |
| `background` | `ToneToken` | ❌ | `"neutral"` | S | Section background. |
| `disclaimer` | string | ❌ | — | C | e.g. "Comparison based on publicly listed ingredients as of June 2026." |

```ts
type ComparisonColumn = {
  id: string;
  label: string;              // "Vedaroots" | "Ordinary market oils" | "Salon treatment" — max 28 chars
  sublabel?: string;          // max 32 chars
  isUs?: boolean;             // default false. Exactly one column must be true.
  logo?: ImageRef;
  cta?: CtaSpec;              // rendered in the CTA row; usually only on the "us" column
};

type ComparisonRow = {
  id: string;
  label: string;              // feature name — max 48 chars
  tooltip?: string;
  cells: ComparisonCell[];    // length MUST equal columns.length; Zod enforces
};

type ComparisonCell =
  | { type: "check" }                            // ✔ in success tone
  | { type: "cross" }                            // ✘ in muted/danger tone
  | { type: "partial" }                          // ~ in warning tone
  | { type: "text"; value: string }              // max 40 chars
  | { type: "rating"; value: Rating };

type PriceRow = {
  label: string;              // default "Price"
  values: string[];           // length MUST equal columns.length. Strings so ranges render: "₹899", "₹300–₹600", "₹3,000+ per session"
  note?: string;              // "per 30ml" etc.
};
```

**Mobile behaviour:** With 2 columns, render the full table with the label column at 45% width. With 3–4
columns, switch to **stacked comparison cards** — one card per column showing every feature with its
value — because a 4-column table on 360px is unreadable at any font size. When the table form is kept,
horizontal scroll is allowed *only* with `stickyFirstColumn: true` and a visible scroll affordance.
Cells never drop below 12px. Check/cross glyphs get `aria-label="Included"` / `"Not included"`.

**Example**

```json
{
  "id": "blk_compare_b31d",
  "type": "comparison-table",
  "props": {
    "heading": "Vedaroots vs. the alternatives",
    "subheading": "Why paying ₹899 once beats ₹3,000 a month at a clinic",
    "highlightUs": true,
    "stickyFirstColumn": true,
    "ctaRow": true,
    "background": "neutral",
    "disclaimer": "Comparison based on publicly listed ingredients and average Indian clinic pricing, June 2026.",
    "columns": [
      { "id": "col_us", "label": "Vedaroots", "sublabel": "Kumkumadi Face Oil", "isUs": true,
        "cta": { "label": "Buy Now — ₹899", "variant": "solid", "tone": "brand",
                 "action": { "kind": "shopify", "productId": "7781234", "variantId": "44831003", "mode": "direct-checkout" } } },
      { "id": "col_market", "label": "Ordinary market oils", "sublabel": "₹300–600 range" },
      { "id": "col_salon", "label": "Salon treatments", "sublabel": "Per-session clinics" }
    ],
    "rows": [
      { "id": "row_saffron", "label": "Real Kashmiri Mongra saffron",
        "cells": [{ "type": "check" }, { "type": "cross" }, { "type": "partial" }] },
      { "id": "row_mineral", "label": "Free from mineral oil",
        "cells": [{ "type": "check" }, { "type": "cross" }, { "type": "check" }] },
      { "id": "row_lab", "label": "Batch lab certificate",
        "cells": [{ "type": "check" }, { "type": "cross" }, { "type": "cross" }] },
      { "id": "row_derm", "label": "Dermatologist tested",
        "cells": [{ "type": "check" }, { "type": "cross" }, { "type": "check" }] },
      { "id": "row_time", "label": "Time to first results",
        "cells": [{ "type": "text", "value": "7–10 days" }, { "type": "text", "value": "Rarely visible" }, { "type": "text", "value": "1–2 sessions" }] },
      { "id": "row_cod", "label": "Cash on delivery",
        "cells": [{ "type": "check" }, { "type": "partial" }, { "type": "cross" }] },
      { "id": "row_refund", "label": "15-day money-back",
        "cells": [{ "type": "check" }, { "type": "cross" }, { "type": "cross" }] },
      { "id": "row_rating", "label": "Customer rating",
        "cells": [{ "type": "rating", "value": 4.6 }, { "type": "rating", "value": 3.4 }, { "type": "rating", "value": 4.1 }] }
    ],
    "priceRow": {
      "label": "What you pay",
      "values": ["₹899 for 60 days", "₹300–600 for 30 days", "₹3,000+ per session"],
      "note": "Prices inclusive of taxes"
    }
  }
}
```

---

### 2.12 `faq-accordion`

**What it is:** An expandable question-and-answer list with an optional support CTA at the end.

**Conversion job:** Kill the last-mile objections that stop a checkout: shipping time, COD availability,
returns, authenticity, side effects. In India, "Is COD available?" and "How long will delivery take to my
pincode?" are the two highest-impact FAQ entries on almost every page. This block also reduces WhatsApp
support volume, which is a direct cost saving.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `heading` | string | ❌ | `"Frequently asked questions"` | C | Max 60 chars. |
| `subheading` | string | ❌ | — | C | Max 120 chars. |
| `items` | `FaqItem[]` | ✅ | — | C | 4–15 entries. Fewer than 4 looks unfinished; more than 15 is a knowledge base, not a landing page. |
| `layout` | `"single-column" \| "two-column"` | ❌ | `"single-column"` | S | Desktop layout. `single-column` measures better. |
| `defaultOpen` | string[] | ❌ | `[items[0].id]` | S | Array of `FaqItem.id`s open on load. The first item should always be open — it teaches the interaction. |
| `allowMultipleOpen` | boolean | ❌ | `true` | S | Whether opening one closes others. |
| `groups` | `FaqGroup[] \| null` | ❌ | `null` | S | Optional category tabs, e.g. Shipping / Product / Returns. |
| `supportCta` | `SupportCta \| null` | ❌ | `null` | C | Trailing "still have questions" panel. |
| `emitJsonLd` | boolean | ❌ | `true` | S | Emits `FAQPage` structured data. Locked to true for pages with an organic path. |
| `background` | `ToneToken` | ❌ | `"light"` | S | Section background. |

```ts
type FaqItem = {
  id: string;
  question: string;        // max 110 chars. Write it in the customer's words, not the brand's.
  answer: string;          // 20–800 chars. Plain text, `\n\n` paragraphs. No HTML.
  group?: string;          // FaqGroup.id
  cta?: CtaSpec;           // optional inline CTA inside the answer
};

type FaqGroup = { id: string; label: string };

type SupportCta = {
  heading: string;         // "Still have a question?"
  body?: string;           // max 160 chars
  cta: CtaSpec;            // usually a whatsapp action
  icon?: IconName;         // default "headphones"
};
```

**Mobile behaviour:** Always single column regardless of `layout`. Each row is a 48px-minimum tap target
with the chevron on the right. Answers animate open with `max-height` transition and must not cause a
scroll jump — the renderer keeps the opened question's top edge pinned in view. Questions clamp to 2
lines. The support CTA becomes a full-width card with a full-width WhatsApp button.

**Example**

```json
{
  "id": "blk_faq_e77f",
  "type": "faq-accordion",
  "props": {
    "heading": "Questions people ask before ordering",
    "layout": "single-column",
    "allowMultipleOpen": true,
    "defaultOpen": ["faq_cod"],
    "emitJsonLd": true,
    "background": "light",
    "items": [
      { "id": "faq_cod", "question": "Is Cash on Delivery available?",
        "answer": "Yes. COD is available on 24,000+ pincodes across India at no extra charge. You pay the delivery partner in cash or by UPI when the parcel arrives. Prepaid orders (UPI, cards, wallets) get an extra 5% off at checkout." },
      { "id": "faq_ship", "question": "How long will delivery take to my city?",
        "answer": "Metro cities (Mumbai, Delhi NCR, Bengaluru, Hyderabad, Chennai, Pune, Kolkata) get delivery in 2–3 working days. Tier 2 and 3 cities take 4–6 working days. You'll get a tracking link on WhatsApp within 24 hours of ordering." },
      { "id": "faq_results", "question": "How soon will I actually see results?",
        "answer": "Most customers notice a brighter, more even skin tone in 7–10 days. Pigmentation, dark spots and post-acne marks need a full 6–8 week cycle of nightly use — that's why we recommend the 2-bottle pack for anyone treating spots." },
      { "id": "faq_acne", "question": "I have oily, acne-prone skin. Will this cause breakouts?",
        "answer": "No. The cold-pressed sesame base is non-comedogenic and the formula was patch-tested on 120 volunteers including acne-prone skin types. Use 3 drops instead of 4, and apply on damp skin. If you're on prescription retinoids, alternate nights.",
        "cta": { "label": "Ask our skin expert", "variant": "ghost",
                 "action": { "kind": "whatsapp", "phone": "919876543210", "messageTemplate": "Hi! I have acne-prone skin and want advice on using {{product}}." } } },
      { "id": "faq_authentic", "question": "How do I know the saffron is real?",
        "answer": "Every batch ships with a lab certificate number printed on the carton. Enter it on our site to see the full report, including saffron concentration and heavy-metal screening. We source directly from a growers' collective in Pampore, Kashmir." },
      { "id": "faq_returns", "question": "What if it doesn't work for me?",
        "answer": "Return it within 15 days for a full refund, even if the bottle is opened. Message us on WhatsApp, we arrange a free pickup, and the refund reaches your account within 5 working days." },
      { "id": "faq_preg", "question": "Is it safe during pregnancy?",
        "answer": "The formula contains no retinoids, hydroquinone or essential oils flagged for pregnancy. That said, please check with your doctor before adding any new product during pregnancy or while breastfeeding." },
      { "id": "faq_gst", "question": "Is the price inclusive of GST and shipping?",
        "answer": "Yes. ₹899 is the final price you pay — GST included. Shipping is free on all orders above ₹499, so every pack on this page ships free anywhere in India." }
    ],
    "supportCta": {
      "heading": "Still not sure which pack to pick?",
      "body": "Message us on WhatsApp — a skin consultant replies within 10 minutes, 9am to 9pm IST.",
      "icon": "headphones",
      "cta": { "label": "Chat on WhatsApp", "variant": "solid", "tone": "success", "icon": "smartphone",
               "action": { "kind": "whatsapp", "phone": "919876543210", "businessName": "Vedaroots Skin Desk",
                           "messageTemplate": "Hi! I'm on the {{page}} page and need help choosing a pack." } }
    }
  }
}
```

---

## 3. PAGE-LEVEL FIXTURES

Fixtures are **not** members of `page.blocks[]`. They live on `page.fixtures` as a keyed object, because
they are singletons that float above the document flow and must not be drag-reordered.

```ts
interface PageFixtures {
  stickyCta?: StickyCtaProps | null;
  socialProofPopup?: SocialProofPopupProps | null;
  trustBar?: TrustBarProps | null;
}
```

In the Puck editor these render in a separate "Page fixtures" panel, not the drag canvas.

---

### 3.1 `sticky-cta`

**What it is:** A bar pinned to the bottom of the mobile viewport carrying price and the primary CTA.

**Conversion job:** On mobile — 67%+ of Indian traffic — this is typically worth a 10–25% relative lift on
its own. It removes the "scroll back up to buy" tax. It is the single highest ROI fixture in the catalog.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `enabled` | boolean | ❌ | `true` | S | Master switch. |
| `showOn` | `"mobile" \| "always" \| "desktop"` | ❌ | `"mobile"` | S | Viewport gate. `mobile` = below 768px. |
| `trigger` | `StickyTrigger` | ❌ | `{ mode: "after-block", blockId: <hero id> }` | S | When the bar appears. |
| `productName` | string | ❌ | inherited from `hero-product.title` | C | Left-side label. Truncates to 1 line. |
| `image` | `ImageRef \| null` | ❌ | first hero gallery image | C | Small thumbnail. |
| `price` | `Money` | ❌ | inherited from `hero-product.price` | C | Displayed price. |
| `compareAtPrice` | `Money \| null` | ❌ | inherited | C | Struck-through price. |
| `savingsLabel` | string | ❌ | auto-computed | C | e.g. "Save ₹600". |
| `cta` | `CtaSpec` | ✅ | — | C | Must resolve to the same destination as the hero primary CTA. |
| `secondaryIconCta` | `CtaSpec \| null` | ❌ | `null` | C | Small icon-only button, typically WhatsApp. |
| `hideNearFooter` | boolean | ❌ | `true` | S | Hides when the final CTA section is in view so two CTAs never stack. |
| `reflectVariantSelection` | boolean | ❌ | `true` | S | Mirrors hero variant/quantity into the sticky action. |
| `tone` | `ToneToken` | ❌ | `"brand"` | S | Bar tone. |

```ts
type StickyTrigger =
  | { mode: "immediate" }
  | { mode: "scroll-percent"; percent: number }        // 1–100
  | { mode: "after-block"; blockId: string }           // appears once this block scrolls out of view
  | { mode: "delay"; seconds: number };
```

**Mobile behaviour:** Fixed to the bottom, 64–72px tall, `env(safe-area-inset-bottom)` padding for iOS
home-indicator devices. The renderer must add equivalent bottom padding to the page body so the bar never
covers the footer's last row. CTA occupies at least 55% of the bar width. Price and CTA on one line; the
product name is dropped below 360px. Must not animate on every scroll tick — one entrance transition
only. `z-index` sits below any open modal/lightbox.

**Example**

```json
{
  "stickyCta": {
    "enabled": true,
    "showOn": "mobile",
    "trigger": { "mode": "after-block", "blockId": "blk_hero_8f21a" },
    "productName": "Kumkumadi Face Oil — Pack of 2",
    "image": { "src": "/img/kumkumadi-hero.webp", "alt": "Kumkumadi Radiance Face Oil bottle" },
    "price": { "amount": 159900, "currency": "INR" },
    "compareAtPrice": { "amount": 299800, "currency": "INR" },
    "savingsLabel": "Save ₹1,399",
    "reflectVariantSelection": true,
    "hideNearFooter": true,
    "tone": "brand",
    "cta": { "label": "Buy Now", "variant": "solid",
             "action": { "kind": "shopify", "productId": "7781234", "variantId": "44831003", "discountCode": "MONSOON40", "mode": "direct-checkout" } },
    "secondaryIconCta": { "label": "WhatsApp", "icon": "smartphone", "variant": "outline",
             "action": { "kind": "whatsapp", "phone": "919876543210", "messageTemplate": "Hi! Question about {{product}}." } }
  }
}
```

---

### 3.2 `social-proof-popup`

**What it is:** Small toast notifications in a page corner: "Rohan from Jaipur just ordered Pack of 2".

**Conversion job:** Ambient, continuous social proof that costs zero scroll depth. Effective on cold
traffic and especially on COD-heavy audiences who need reassurance that real people in real Indian cities
are buying. Also the block with the highest abuse potential — hence a mandatory data source.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `enabled` | boolean | ❌ | `true` | S | Master switch. |
| `source` | `PopupSource` | ✅ | — | C/L | Where events come from. See below. |
| `position` | `"bottom-left" \| "bottom-right" \| "top-right"` | ❌ | `"bottom-left"` | S | Desktop anchor. |
| `mobilePosition` | `"top" \| "bottom" \| "hidden"` | ❌ | `"top"` | S | On mobile `bottom` collides with `sticky-cta`; default is `top`. |
| `template` | string | ❌ | `"{name} from {city} just ordered {product}"` | C | Tokens: `{name}`, `{city}`, `{product}`, `{variant}`, `{timeAgo}`, `{quantity}`. |
| `showImage` | boolean | ❌ | `true` | S | Product thumbnail in the toast. |
| `showTimeAgo` | boolean | ❌ | `true` | S | "12 minutes ago" line. |
| `initialDelaySeconds` | number | ❌ | `8` | S | Delay before the first toast. Never fire before the visitor has read the hero. |
| `intervalSeconds` | number | ❌ | `18` | S | Gap between toasts. Minimum 10 enforced by Zod. |
| `displaySeconds` | number | ❌ | `5` | S | How long each toast stays. |
| `maxPerSession` | number | ❌ | `6` | S | Hard cap. Beyond ~6 it reads as spam and hurts trust. |
| `dismissible` | boolean | ❌ | `true` | S | × closes and suppresses for the session. |
| `clickAction` | `CheckoutAction \| null` | ❌ | `null` | C | Optional tap-through, usually to the offer stack. |
| `disclosure` | string | ❌ | — | C | Required by the validator when `source.mode === "simulated"`. |

```ts
type PopupSource =
  | { mode: "orders-api"; endpoint: string; jsonPath: string; refreshSeconds?: number;
      anonymise?: "first-name-initial" | "first-name-only" | "full"; fallback: PopupEvent[] }
  | { mode: "shopify-orders"; shop: string; lookbackHours: number;
      anonymise?: "first-name-initial" | "first-name-only" | "full"; fallback: PopupEvent[] }
  | { mode: "static"; events: PopupEvent[]; verified: boolean }
  | { mode: "simulated"; events: PopupEvent[]; disclosure: string;
      shuffle?: boolean; jitterMinutes?: number };

type PopupEvent = {
  id: string;
  name: string;            // "Rohan" — already anonymised for static/simulated
  city: string;            // "Jaipur"
  product: string;         // "Kumkumadi Face Oil"
  variant?: string;        // "Pack of 2"
  quantity?: number;
  minutesAgo?: number;     // integer ≥ 1; rendered as "12 minutes ago"
  image?: ImageRef;
  verified?: boolean;
};
```

**Governance rules — identical family to `urgency-strip`:**

1. `mode: "simulated"` requires `disclosure`, and the toast renders a tiny "indicative" marker.
2. Real order data must be anonymised. `anonymise: "full"` (surname included) is **forbidden** by the
   validator — it is a live privacy exposure. Default to `"first-name-initial"`.
3. The AI generator defaults to `mode: "static"` with `verified: false` and writes a `notes` flag telling
   the marketer to bind real order data before publishing.
4. Events must never reference a product that isn't on the page.

**Mobile behaviour:** Slides in from the top under the announcement bar, full width minus 12px gutters,
max 2 lines of text. **Must never render at the bottom on mobile** — that space belongs to `sticky-cta`.
Auto-suppressed while any modal, lightbox or form is open. Respects `prefers-reduced-motion` with a fade
instead of a slide. `mobilePosition: "hidden"` is the correct choice when the page is very CTA-dense.

**Example**

```json
{
  "socialProofPopup": {
    "enabled": true,
    "position": "bottom-left",
    "mobilePosition": "top",
    "template": "{name} from {city} just ordered {variant}",
    "showImage": true,
    "showTimeAgo": true,
    "initialDelaySeconds": 10,
    "intervalSeconds": 20,
    "displaySeconds": 5,
    "maxPerSession": 5,
    "dismissible": true,
    "clickAction": { "kind": "url", "href": "#blk_offers_5b7c" },
    "source": {
      "mode": "shopify-orders",
      "shop": "vedaroots.myshopify.com",
      "lookbackHours": 24,
      "anonymise": "first-name-initial",
      "fallback": [
        { "id": "ev_1", "name": "Rohan S.", "city": "Jaipur", "product": "Kumkumadi Face Oil", "variant": "Pack of 2", "minutesAgo": 6, "verified": true,
          "image": { "src": "/img/kumkumadi-hero.webp", "alt": "Kumkumadi Face Oil" } },
        { "id": "ev_2", "name": "Divya M.", "city": "Coimbatore", "product": "Kumkumadi Face Oil", "variant": "1 Bottle", "minutesAgo": 14, "verified": true,
          "image": { "src": "/img/kumkumadi-hero.webp", "alt": "Kumkumadi Face Oil" } },
        { "id": "ev_3", "name": "Aarti K.", "city": "Indore", "product": "Kumkumadi Face Oil", "variant": "Pack of 3", "minutesAgo": 23, "verified": true,
          "image": { "src": "/img/kumkumadi-hero.webp", "alt": "Kumkumadi Face Oil" } }
      ]
    }
  }
}
```

---

### 3.3 `trust-bar`

**What it is:** A slim horizontal row of trust badges — payment logos, guarantees, certifications,
shipping promises.

**Conversion job:** Reduce transaction anxiety at the exact moment of decision. Placed just above the
footer and/or directly under the final CTA. In India, visible UPI/COD marks and an authenticity
guarantee measurably reduce checkout drop-off for unknown brands.

| Prop | Type | Req | Default | Tag | Description |
|---|---|---|---|---|---|
| `enabled` | boolean | ❌ | `true` | S | Master switch. |
| `placement` | `"above-footer" \| "below-hero" \| "both"` | ❌ | `"above-footer"` | S | Where the fixture injects itself. |
| `badges` | `TrustBadge[]` | ✅ | — | C | 3–8 badges. |
| `style` | `"icons" \| "logos" \| "mixed"` | ❌ | `"mixed"` | S | Rendering mode. |
| `showLabels` | boolean | ❌ | `true` | S | Labels under badges. Off = logos only. |
| `paymentLogos` | `PaymentLogo[]` | ❌ | `[]` | C | Payment method marks rendered as a sub-row. |
| `tone` | `ToneToken` | ❌ | `"neutral"` | S | Bar background. |
| `bordered` | boolean | ❌ | `true` | S | Top/bottom hairlines. |

```ts
type TrustBadge = {
  id: string;
  icon?: IconName;         // used when style includes icons
  image?: ImageRef;        // certification mark; overrides icon
  label: string;           // max 24 chars
  sublabel?: string;       // max 32 chars
  tooltip?: string;
};

type PaymentLogo = "upi" | "gpay" | "phonepe" | "paytm" | "visa" | "mastercard"
                 | "rupay" | "amex" | "netbanking" | "cod" | "razorpay";
```

**Mobile behaviour:** 4 badges become a 2×2 grid; 6 become 3×2; more than 6 becomes a horizontal
snap-scroll strip. Icons at 20px, labels at 11px with a 2-line clamp. The payment logo row is always a
single centred wrap row, grayscale by default so it reads as reassurance rather than decoration. Total
fixture height ≤ 140px on mobile.

**Example**

```json
{
  "trustBar": {
    "enabled": true,
    "placement": "above-footer",
    "style": "mixed",
    "showLabels": true,
    "tone": "neutral",
    "bordered": true,
    "badges": [
      { "id": "tb_ship", "icon": "truck", "label": "Free shipping", "sublabel": "On orders above ₹499" },
      { "id": "tb_cod", "icon": "banknote", "label": "Cash on Delivery", "sublabel": "24,000+ pincodes" },
      { "id": "tb_return", "icon": "rotate-ccw", "label": "15-day returns", "sublabel": "No questions asked" },
      { "id": "tb_auth", "icon": "shield-check", "label": "100% authentic", "sublabel": "Lab certificate per batch" },
      { "id": "tb_secure", "icon": "lock", "label": "Secure payments", "sublabel": "Razorpay protected" },
      { "id": "tb_support", "icon": "headphones", "label": "9am–9pm support", "sublabel": "WhatsApp in 10 mins" }
    ],
    "paymentLogos": ["upi", "gpay", "phonepe", "paytm", "rupay", "visa", "mastercard", "netbanking", "cod"]
  }
}
```

---

## 4. RECOMMENDED PAGE ORDER (cold paid traffic, D2C India)

This is the default composition the AI generator must produce unless the brief explicitly overrides it.
The logic: **confirm the promise → make the offer → prove it → remove friction → close.**

| # | Block | Rationale (why it sits here) |
|---|---|---|
| 1 | `announcement-bar` | Confirms the ad's offer in the first paint — message match happens before any scroll. |
| 2 | `hero-product` | 40–60% of paid visitors never scroll; the full buying decision must be resolvable here. |
| 3 | `urgency-strip` | Immediately after the price, while intent is hottest — compresses the decide-later window. |
| 4 | `value-pillars` | The first scroll answers "why this one?" in 4 seconds, before any long-form reading is demanded. |
| 5 | `offer-stack` | Placed after value is established so the visitor is choosing *which*, not *whether* — this is where AOV is made. |
| 6 | `review-wall` | Peer proof lands hardest immediately after a price commitment is asked for; it de-risks the number just shown. |
| 7 | `product-narrative` | Brand trust for the still-hesitant; converts a price-shopper into a brand-buyer once the offer is already known. |
| 8 | `persona-cards` | Recovers the "not sure this is for *me*" visitor by routing them to the right SKU instead of letting them bounce. |
| 9 | `comparison-table` | Closes the comparison-shopping objection inside the page rather than in a competitor's tab. |
| 10 | `spec-table` | Factual detail for the deep-scroller; deliberately low because specs suppress emotional momentum if placed early. |
| 11 | `faq-accordion` | Last-mile friction removal: COD, delivery time, returns, safety — the actual reasons carts are abandoned in India. |
| 12 | `collection-grid` | Deliberately last in the flow: it leaks attention from the primary conversion, so it only catches otherwise-lost visitors. |
| 13 | *Final CTA* (a `hero-product`-lite or `offer-stack` repeat) | A visitor who reached the bottom is qualified; give them a decision point without a scroll-back. |
| 14 | `trust-bar` (fixture) | Sits just above the footer, adjacent to the final CTA, at the exact moment of decision anxiety. |
| — | `sticky-cta` (fixture) | Floats from the moment the hero leaves the viewport; removes the scroll-back tax on mobile. |
| — | `social-proof-popup` (fixture) | Ambient throughout, from ~10s in; costs zero scroll depth. |

**Variants of this order that are acceptable:**

- **Lead-gen pages** (`kind: "form"` checkout): move `faq-accordion` above `comparison-table`, and drop
  `collection-grid` entirely — a lead page must have exactly one exit.
- **High-consideration / high-ticket (> ₹3,000):** move `comparison-table` and `product-narrative` up
  to positions 5 and 6, before the offer stack. Expensive purchases need justification before price.
- **Retargeting / warm traffic:** drop `product-narrative` and `persona-cards`, move `offer-stack` to
  position 3. They already know the brand; they need a reason to act now.
- **Single-SKU brands:** omit `collection-grid` and `persona-cards`.

**Order rules the generator must enforce:**

1. `announcement-bar`, if present, is always index 0.
2. `hero-product` is always present and always the first non-announcement block.
3. `urgency-strip` must be adjacent to a price-bearing block (`hero-product` or `offer-stack`).
4. `collection-grid` must never appear above `offer-stack`.
5. There must be a conversion point (an `offer-stack`, hero, or final CTA) within every ~2.5 viewport
   heights of scroll — never make a qualified visitor hunt for a button.

---

## 5. CONVERSION RULES FOR THE GENERATOR

These are hard constraints on the AI composition pass. The validator implements each of them; violations
surface as `error` (blocks publish) or `warn` (requires acknowledgement).

**Rule 1 — Message match is mandatory. (error)**
The hero `title` or `subtitle` must contain the campaign's primary keyword, and the `announcement-bar`
text must restate the ad's headline offer verbatim in substance (same discount, same terms). A visitor
who clicked "Flat 40% off Kumkumadi Oil" must see "40%" and "Kumkumadi" without scrolling. Mismatch
between the ad and the page is the single largest cause of high-CPC/low-CVR campaigns.

**Rule 2 — A primary CTA must be reachable within 400px of scroll on a 360×640 viewport. (error)**
Measured against the mobile render, not desktop. If the hero copy or gallery pushes the button below
that line, the generator must shorten `bullets`, drop `eyebrow`, or cap the gallery height. Above-the-
fold CTA presence outweighs every aesthetic consideration.

**Rule 3 — One primary action per page. (error)**
Every primary CTA on the page — hero, offer cards, final CTA, sticky bar — must resolve to the same
`CheckoutAction.kind` and the same destination. Secondary CTAs may differ (typically WhatsApp for
questions), but a page may not present two co-equal ways to buy. Split intent is lost intent.

**Rule 4 — Mobile-first sizing and copy. (error)**
Assume 360px wide, 4G, one thumb. Body copy ≥ 15px, tap targets ≥ 44px, no horizontal scroll anywhere
except intentional carousels, and no block that renders taller than ~2.2 viewports on mobile without an
internal collapse. Write every string to fit a 360px line box first; desktop will always accommodate it.

**Rule 5 — Grade 6 reading level, second person, benefit-first. (warn)**
Short sentences. Active voice. "You" not "customers". Lead with the outcome ("Fades dark spots in 4
weeks"), not the mechanism ("contains 0.8% Mongra saffron") — the mechanism belongs in `spec-table` and
`value-pillars`. Avoid jargon a first-time buyer would have to look up. Indian English conventions:
"₹" prefix, Indian digit grouping (₹1,49,900 style in prose; ₹1,499 for four digits).

**Rule 6 — Every claim must be attributable. (error for numeric claims)**
Any number the page asserts — units sold, viewers, stock, rating, review counts — must carry a
`DataSource`. `mode: "static"` is permitted but ships `verified: false` and raises a `warn`.
`mode: "simulated"` requires a `disclosure` string and blocks publish until a human acknowledges it. The
generator must never invent a specific number and present it as measured fact.

**Rule 7 — Price integrity across the page. (error)**
`compareAtPrice` must always exceed `price`. All savings figures must be arithmetically derivable from
the price pair. Prices shown in `hero-product`, `offer-stack`, `persona-cards`, `comparison-table` and
`sticky-cta` must agree — `persona-cards` should reference `offerId` rather than restating a price, and
`sticky-cta` should inherit from the hero rather than duplicate.

**Rule 8 — Objection coverage before the close. (error)**
The page must answer, somewhere above the final CTA, all five India-critical objections: COD
availability, delivery timeline, returns/refund policy, product authenticity, and safety/suitability.
`faq-accordion` is the usual home; `trust-bar` and hero `trustChips` may carry the short form. A page
missing COD and delivery answers will underperform on cold traffic regardless of creative quality.

**Rule 9 — Proof density before the second ask. (warn)**
There must be at least one proof block (`review-wall`, `product-narrative` stats, or `comparison-table`)
between the hero and the `offer-stack`, or immediately after it. Never present two price asks in a row
with no evidence in between.

**Rule 10 — Restraint on urgency. (warn)**
Maximum one `urgency-strip` per page, maximum 4 signals within it, maximum one countdown on the whole
page (announcement bar *or* urgency strip, not both), and `socialProofPopup.maxPerSession ≤ 6`.
Stacked, unbounded urgency reads as a scam site and destroys the trust the rest of the page builds —
especially for an unknown brand asking for a COD order.

**Rule 11 — Accessibility is a conversion feature, not a checkbox. (error)**
Every `ImageRef.alt` non-empty and descriptive. Every check/cross cell in `comparison-table` carries an
aria-label. Colour is never the sole carrier of meaning (discount, sold-out, verified all need text or
an icon too). All animation respects `prefers-reduced-motion`. Contrast ≥ 4.5:1 for body text.

**Rule 12 — Block count discipline. (warn)**
A cold-traffic page should carry 8–13 flow blocks. Below 8 it lacks the proof to close an unknown-brand
COD sale; above 13 the scroll cost exceeds the marginal persuasion of each additional section. If the
generator wants a 14th block, it must drop one first.

---

## 6. Validator severity summary

| Severity | Behaviour |
|---|---|
| `error` | Page cannot be saved or published. The generator must retry composition. |
| `warn` | Page saves; publish requires an explicit human acknowledgement recorded in `page.meta.acknowledgements[]`. |
| `info` | Advisory only; surfaced in the Puck sidebar as a CRO hint. |

Every rule above maps to a validator id of the form `cro/<rule-slug>` (e.g. `cro/message-match`,
`cro/cta-above-fold`, `cro/unattributed-claim`) so failures are machine-addressable and can be reported
back into the AI edit loop by id.
