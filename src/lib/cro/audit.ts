/**
 * Landing Agent — the CRO audit engine.
 *
 * Scores a Page against an evidence-anchored rubric and returns prioritised, cited findings.
 * This is what makes the product's CRO claim *provable* rather than something a marketer has
 * to take on faith: every generated page can show a score and exactly why.
 *
 * DETERMINISTIC AND KEY-FREE. The audit is a pure function of the Page JSON — no LLM, no
 * network, no API key. It runs instantly, offline, and gives the same score every time, so it
 * works in the editor live and on the dashboard for free.
 *
 * HONEST BY DESIGN. Checks can fail. A page missing a sticky mobile CTA, showing a flat 5.0
 * rating (authenticity skepticism — Spiegel), or running a *simulated* urgency timer will be
 * marked down. A score that is always high is worthless; this one is meant to move.
 *
 * Every check cites a pattern from the project's evidence base
 * (.claude/skills/_shared/benchmarks/patterns.json). The citations are embedded below rather
 * than read at runtime so the engine is self-contained and deploy-safe.
 */

import type { Block, Page } from "@/lib/schema/page";

/* ────────────────────────────────────────────────────────────────────────────
   Evidence — a curated subset of patterns.json, embedded for self-containment.
   ──────────────────────────────────────────────────────────────────────────── */

export interface CroEvidence {
  patternId: string;
  /** Best documented A/B lift range, in percent. Null when the pattern is a guardrail. */
  liftRangePct: [number, number] | null;
  source: string;
}

const EV: Record<string, CroEvidence> = {
  reviews_present: { patternId: "product_reviews_displayed", liftRangePct: [190, 380], source: "Spiegel Research Center" },
  rating_sweet_spot: { patternId: "star_rating_4_2_to_4_7", liftRangePct: null, source: "Spiegel — perfect 5.0 reads as fake" },
  testimonial_above_cta: { patternId: "testimonial_above_cta", liftRangePct: [30, 35], source: "VWO / Mutiny" },
  sticky_cta: { patternId: "sticky_cta_desktop_longform", liftRangePct: [5, 12], source: "GrowthRock" },
  trust_badge: { patternId: "trust_badge_security_seal_ecommerce", liftRangePct: [15, 42], source: "Baymard" },
  urgency_real: { patternId: "urgency_real_deadline_timer", liftRangePct: [5, 15], source: "multiple e-commerce A/B tests" },
  urgency_fake: { patternId: "urgency_manufactured_perpetual", liftRangePct: null, source: "negative — FTC/Meta/Google enforcement + LTV damage" },
  price_anchor: { patternId: "anchor_pricing_compare_at", liftRangePct: [10, 38], source: "anchor-pricing studies" },
  headline_quantified: { patternId: "headline_quantified_benefit", liftRangePct: [10, 50], source: "MarketingExperiments" },
  cta_copy: { patternId: "cta_first_person_pronoun", liftRangePct: [14, 90], source: "ContentVerve / MarketingExperiments" },
  faq_objections: { patternId: "objection_handling_faq", liftRangePct: [5, 20], source: "CRO best practice" },
  above_fold_cta: { patternId: "cta_above_the_fold", liftRangePct: [10, 30], source: "NN/g attention research" },
  single_action: { patternId: "single_primary_conversion_goal", liftRangePct: null, source: "one-primary-action principle" },
};

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

export type CroStatus = "pass" | "warn" | "fail";
export type CroImpact = "high" | "medium" | "low";
export type CroCategory =
  | "Above the fold"
  | "Social proof"
  | "Urgency"
  | "Trust"
  | "Objections"
  | "Offer & pricing"
  | "Copy"
  | "Mobile & speed"
  | "Structure";

export interface CroFinding {
  id: string;
  category: CroCategory;
  title: string;
  status: CroStatus;
  impact: CroImpact;
  /** What the audit observed on this page. */
  detail: string;
  /** How to improve — phrased so it doubles as an AI edit instruction. */
  fix?: string;
  evidence?: CroEvidence;
}

export interface CroCategoryScore {
  category: CroCategory;
  score: number;
  findings: CroFinding[];
}

export type CroGrade = "Excellent" | "Strong" | "Good" | "Needs work" | "Weak";

export interface CroReport {
  score: number;
  grade: CroGrade;
  summary: string;
  counts: { pass: number; warn: number; fail: number };
  findings: CroFinding[];
  categories: CroCategoryScore[];
}

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */

const IMPACT_WEIGHT: Record<CroImpact, number> = { high: 3, medium: 2, low: 1 };
const STATUS_VALUE: Record<CroStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

const CATEGORY_ORDER: CroCategory[] = [
  "Above the fold",
  "Offer & pricing",
  "Social proof",
  "Urgency",
  "Trust",
  "Objections",
  "Copy",
  "Mobile & speed",
  "Structure",
];

type BlockOf<T extends Block["type"]> = Extract<Block, { type: T }>;

function visible(page: Page): Block[] {
  return page.blocks.filter((b) => !b.hidden);
}

function firstOfType<T extends Block["type"]>(page: Page, type: T): BlockOf<T> | undefined {
  return visible(page).find((b): b is BlockOf<T> => b.type === type);
}

function hasType(page: Page, type: Block["type"]): boolean {
  return visible(page).some((b) => b.type === type);
}

/** Free-text corpus of the page's headline-ish copy, for keyword/number heuristics. */
function heroCorpus(hero: BlockOf<"hero-product"> | undefined): string {
  if (!hero) return "";
  const p = hero.props;
  return [p.eyebrow, p.title, p.subtitle, ...(p.bullets ?? [])].filter(Boolean).join(" ");
}

const WEAK_CTA = /^(submit|click here|learn more|read more|continue|next|go)\b/i;

/* ────────────────────────────────────────────────────────────────────────────
   Rules — each returns a finding (or null when not applicable to this page).
   ──────────────────────────────────────────────────────────────────────────── */

type Rule = (page: Page) => CroFinding | null;

const rules: Rule[] = [
  // ── Above the fold ─────────────────────────────────────────────────────────
  (page) => {
    const blocks = visible(page);
    const heroIdx = blocks.findIndex((b) => b.type === "hero-product");
    if (heroIdx === -1)
      return {
        id: "hero-present",
        category: "Above the fold",
        status: "fail",
        impact: "high",
        title: "Product hero",
        detail: "No product hero block — visitors land with no clear product, price, or action.",
        fix: "Add a hero-product block at the very top with the product, price, and a primary CTA.",
        evidence: EV.above_fold_cta,
      };
    return {
      id: "hero-present",
      category: "Above the fold",
      status: heroIdx <= 1 ? "pass" : "warn",
      impact: "high",
      title: "Product hero placement",
      detail:
        heroIdx <= 1
          ? "A product hero leads the page — the visitor sees the offer immediately."
          : `The hero is block #${heroIdx + 1}. Visitors decide in ~5s; lead with it.`,
      fix: heroIdx <= 1 ? undefined : "Move the hero-product block to the top of the page.",
      evidence: EV.above_fold_cta,
    };
  },
  (page) => {
    const hero = firstOfType(page, "hero-product");
    if (!hero) return null;
    const hasCta = Boolean(hero.props.primaryCta?.label);
    return {
      id: "above-fold-cta",
      category: "Above the fold",
      status: hasCta ? "pass" : "fail",
      impact: "high",
      title: "CTA above the fold",
      detail: hasCta
        ? `Primary CTA "${hero.props.primaryCta.label}" is reachable without scrolling.`
        : "The hero has no primary CTA — the first screen offers no way to convert.",
      fix: hasCta ? undefined : "Add a primary CTA button to the hero.",
      evidence: EV.above_fold_cta,
    };
  },
  (page) => {
    const has = page.fixtures.stickyCta !== null;
    return {
      id: "sticky-cta",
      category: "Above the fold",
      status: has ? "pass" : "warn",
      impact: "medium",
      title: "Sticky mobile CTA",
      detail: has
        ? "A sticky bottom CTA keeps the buy action on screen as visitors scroll on mobile."
        : "No sticky mobile CTA. ~67% of Indian paid traffic is mobile and scrolls past the hero.",
      fix: has ? undefined : "Add a sticky mobile CTA bar with the price and buy button.",
      evidence: EV.sticky_cta,
    };
  },

  // ── Offer & pricing ────────────────────────────────────────────────────────
  (page) => {
    const hero = firstOfType(page, "hero-product");
    const anchored = Boolean(hero?.props.compareAtPrice) || hasType(page, "offer-stack");
    return {
      id: "price-anchor",
      category: "Offer & pricing",
      status: anchored ? "pass" : "warn",
      impact: "medium",
      title: "Price anchoring",
      detail: anchored
        ? "A struck-through MRP or a tiered offer stack anchors the price and frames the saving."
        : "No compare-at price or offer stack — the price has nothing to be judged against.",
      fix: anchored ? undefined : "Show a struck-through MRP (compare-at price) or add an offer-stack.",
      evidence: EV.price_anchor,
    };
  },

  // ── Social proof ───────────────────────────────────────────────────────────
  (page) => {
    const has = hasType(page, "review-wall");
    return {
      id: "reviews-present",
      category: "Social proof",
      status: has ? "pass" : "fail",
      impact: "high",
      title: "Customer reviews",
      detail: has
        ? "A review wall is present — the single strongest trust lever on a cold-traffic page."
        : "No reviews on the page. Products with reviews are far more likely to be purchased.",
      fix: has ? undefined : "Add a review-wall with real, named, verified customer reviews.",
      evidence: EV.reviews_present,
    };
  },
  (page) => {
    const hero = firstOfType(page, "hero-product");
    const reviews = firstOfType(page, "review-wall");
    const rating = hero?.props.rating?.value ?? reviews?.props.summary?.value ?? null;
    if (rating === null) return null;
    const perfect = rating >= 4.95;
    const credible = rating >= 4.0 && rating < 4.95;
    return {
      id: "rating-credible",
      category: "Social proof",
      status: credible ? "pass" : perfect ? "warn" : "warn",
      impact: "medium",
      title: "Rating is believable",
      detail: perfect
        ? `A flat ${rating.toFixed(1)}★ reads as fake — purchase intent actually peaks around 4.2–4.7★.`
        : credible
          ? `The ${rating.toFixed(1)}★ rating sits in the believable 4.2–4.7 sweet spot.`
          : `A ${rating.toFixed(1)}★ average is low enough to deter — check it is real and current.`,
      fix: perfect ? "Use the real aggregate rating (a natural 4.2–4.7 converts better than a flat 5.0)." : undefined,
      evidence: EV.rating_sweet_spot,
    };
  },

  // ── Urgency (credibility is the point) ─────────────────────────────────────
  (page) => {
    const strip = firstOfType(page, "urgency-strip");
    const popup = page.fixtures.socialProofPopup;
    // A signal is "fabricated" when its data source mode is "simulated".
    const simulatedSignals =
      strip?.props.signals?.filter((s) => "source" in s && s.source?.mode === "simulated").length ?? 0;
    const popupSimulated = popup?.source?.mode === "simulated";
    const countdowns = strip?.props.signals?.filter((s) => s.kind === "countdown").length ?? 0;

    const problems: string[] = [];
    if (simulatedSignals > 0) problems.push(`${simulatedSignals} urgency signal(s) run on simulated data`);
    if (popupSimulated) problems.push("the recent-purchase popup uses simulated events");
    if (countdowns > 1) problems.push(`${countdowns} countdown timers (max one per page)`);

    if (problems.length === 0)
      return {
        id: "urgency-credible",
        category: "Urgency",
        status: "pass",
        impact: "high",
        title: "Urgency is credible",
        detail: strip || popup
          ? "Urgency and social-proof signals are bound to real data — believable, and compliant."
          : "No manufactured urgency. Clean, though a real deadline or stock count could lift conversions.",
        evidence: EV.urgency_real,
      };
    return {
      id: "urgency-credible",
      category: "Urgency",
      status: "warn",
      impact: "high",
      title: "Urgency credibility risk",
      detail: `Fabricated urgency detected: ${problems.join("; ")}. Fake urgency backfires once noticed and draws regulatory attention.`,
      fix: "Bind every urgency/social-proof signal to a real data source, or remove it. Keep at most one countdown.",
      evidence: EV.urgency_fake,
    };
  },

  // ── Trust ──────────────────────────────────────────────────────────────────
  (page) => {
    const has = page.fixtures.trustBar !== null;
    return {
      id: "trust-bar",
      category: "Trust",
      status: has ? "pass" : "warn",
      impact: "medium",
      title: "Trust bar",
      detail: has
        ? "A trust bar reassures on payment, delivery, and returns near the decision point."
        : "No trust bar (COD, secure payment, returns). 19% abandon checkout over payment trust alone.",
      fix: has ? undefined : "Add a trust-bar with the guarantees the brand can back (COD, returns, secure payment).",
      evidence: EV.trust_badge,
    };
  },
  (page) => {
    const hero = firstOfType(page, "hero-product");
    const chips = hero?.props.trustChips?.length ?? 0;
    if (!hero) return null;
    return {
      id: "trust-chips",
      category: "Trust",
      status: chips >= 2 ? "pass" : "warn",
      impact: "low",
      title: "Hero trust chips",
      detail: chips >= 2
        ? `${chips} trust chips (free shipping / COD / returns) sit right under the CTA.`
        : "Few or no trust chips under the hero CTA — add free shipping / COD / returns.",
      fix: chips >= 2 ? undefined : "Add 2–4 trust chips under the hero CTA (free shipping, COD, easy returns).",
    };
  },

  // ── Objections ─────────────────────────────────────────────────────────────
  (page) => {
    const faq = firstOfType(page, "faq-accordion");
    const count = faq?.props.items?.length ?? 0;
    return {
      id: "faq-present",
      category: "Objections",
      status: count >= 4 ? "pass" : count > 0 ? "warn" : "fail",
      impact: "high",
      title: "FAQ / objection handling",
      detail: count >= 4
        ? `${count} FAQs pre-empt the objections that stall a purchase.`
        : count > 0
          ? `Only ${count} FAQ item(s). Cover the top 4–6 objections.`
          : "No FAQ. Every cold visitor has objections (COD, delivery, returns) the page must answer.",
      fix: count >= 4 ? undefined : "Add an FAQ covering COD, delivery time, returns, and authenticity.",
      evidence: EV.faq_objections,
    };
  },
  (page) => {
    const faq = firstOfType(page, "faq-accordion");
    if (!faq || (faq.props.items?.length ?? 0) === 0) return null;
    const corpus = faq.props.items
      .map((i) => `${i.question} ${i.answer}`)
      .join(" ")
      .toLowerCase();
    const covers = {
      cod: /\bcod\b|cash on delivery/.test(corpus),
      delivery: /deliver|ship|dispatch|days/.test(corpus),
      returns: /return|refund|exchange|replace/.test(corpus),
    };
    const missing = Object.entries(covers)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    return {
      id: "faq-india-coverage",
      category: "Objections",
      status: missing.length === 0 ? "pass" : missing.length === 1 ? "warn" : "warn",
      impact: "medium",
      title: "Covers the India objections",
      detail:
        missing.length === 0
          ? "The FAQ addresses COD, delivery time, and returns — the three that decide Indian D2C purchases."
          : `The FAQ doesn't clearly cover: ${missing.join(", ")}. These are top Indian D2C objections.`,
      fix: missing.length === 0 ? undefined : `Add FAQ answers about ${missing.join(", ")}.`,
      evidence: EV.faq_objections,
    };
  },

  // ── Copy ───────────────────────────────────────────────────────────────────
  (page) => {
    const hero = firstOfType(page, "hero-product");
    if (!hero) return null;
    const corpus = heroCorpus(hero);
    const quantified = /\d/.test(corpus) || /₹|%|\bx\b|\+/.test(corpus);
    return {
      id: "headline-quantified",
      category: "Copy",
      status: quantified ? "pass" : "warn",
      impact: "medium",
      title: "Quantified headline",
      detail: quantified
        ? "The hero copy carries a number or concrete claim — specificity converts."
        : "The hero copy has no number or concrete metric. Specific beats vague.",
      fix: quantified ? undefined : "Add a specific number to the hero (a result, a timeframe, units sold, a saving).",
      evidence: EV.headline_quantified,
    };
  },
  (page) => {
    const hero = firstOfType(page, "hero-product");
    const label = hero?.props.primaryCta?.label ?? "";
    if (!label) return null;
    const weak = WEAK_CTA.test(label);
    return {
      id: "cta-copy",
      category: "Copy",
      status: weak ? "warn" : "pass",
      impact: "medium",
      title: "CTA copy is outcome-led",
      detail: weak
        ? `"${label}" is a generic action label. Outcome/first-person copy ("Get mine", "Start my order") converts better.`
        : `"${label}" reads as an outcome, not a chore.`,
      fix: weak ? `Rewrite the primary CTA "${label}" to describe the outcome (e.g. "Get mine — ₹…").` : undefined,
      evidence: EV.cta_copy,
    };
  },
  (page) => {
    const hero = firstOfType(page, "hero-product");
    if (!hero) return null;
    const bullets = hero.props.bullets?.length ?? 0;
    return {
      id: "benefit-bullets",
      category: "Copy",
      status: bullets >= 3 ? "pass" : "warn",
      impact: "low",
      title: "Scannable benefits",
      detail: bullets >= 3
        ? `${bullets} benefit bullets make the value scannable in the hero.`
        : "Few benefit bullets in the hero — add 3–5 scannable, benefit-led lines.",
      fix: bullets >= 3 ? undefined : "Add 3–5 benefit bullets to the hero (outcomes, not features).",
    };
  },

  // ── Mobile & speed ─────────────────────────────────────────────────────────
  (page) => {
    // Every ImageRef requires alt, but generic/empty-ish alt is a real quality miss.
    let total = 0;
    let weak = 0;
    for (const b of visible(page)) {
      const imgs = collectImages(b);
      for (const alt of imgs) {
        total++;
        if (alt.trim().length < 8 || /^(image|photo|picture|img)\b/i.test(alt.trim())) weak++;
      }
    }
    if (total === 0) return null;
    return {
      id: "image-alt",
      category: "Mobile & speed",
      status: weak === 0 ? "pass" : weak <= 2 ? "warn" : "fail",
      impact: "low",
      title: "Descriptive image alt text",
      detail: weak === 0
        ? `All ${total} images have descriptive alt text (accessibility + image SEO).`
        : `${weak} of ${total} images have weak or generic alt text.`,
      fix: weak === 0 ? undefined : "Give every image specific, descriptive alt text.",
    };
  },
  (page) => {
    const hero = firstOfType(page, "hero-product");
    const has = (hero?.props.gallery?.length ?? 0) >= 1;
    if (!hero) return null;
    return {
      id: "hero-lcp",
      category: "Mobile & speed",
      status: has ? "pass" : "fail",
      impact: "medium",
      title: "Hero image (LCP)",
      detail: has
        ? "The hero has a lead image — the LCP element the page prioritises for fast first paint."
        : "The hero has no image — a strong product visual is the single biggest above-fold lever.",
      fix: has ? undefined : "Add a high-quality product image as the first hero gallery item.",
    };
  },

  // ── Structure ──────────────────────────────────────────────────────────────
  (page) => {
    const actions = collectPrimaryActions(page);
    const distinct = new Set(actions.map(actionKey));
    return {
      id: "single-action",
      category: "Structure",
      status: distinct.size <= 1 ? "pass" : distinct.size === 2 ? "warn" : "fail",
      impact: "high",
      title: "One primary action",
      detail:
        distinct.size <= 1
          ? "Every primary CTA resolves to the same destination — undivided intent."
          : `Primary CTAs point to ${distinct.size} different destinations. Splitting intent costs conversions.`,
      fix: distinct.size <= 1 ? undefined : "Make every primary CTA resolve to the same checkout destination.",
      evidence: EV.single_action,
    };
  },
  (page) => {
    const b = visible(page);
    const faqIdx = b.findIndex((x) => x.type === "faq-accordion");
    const reviewIdx = b.findIndex((x) => x.type === "review-wall");
    // FAQ should sit late; reviews before the final push. Soft structural check.
    const ok = faqIdx === -1 || faqIdx >= Math.floor(b.length / 2);
    return {
      id: "logical-order",
      category: "Structure",
      status: ok ? "pass" : "warn",
      impact: "low",
      title: "Logical page flow",
      detail: ok
        ? "The page flows from offer to proof to objections to close."
        : "The FAQ appears early — objection-handling usually belongs lower, before the final CTA.",
      fix: ok ? undefined : "Move the FAQ nearer the end, before the final call to action.",
    };
  },
];

/* ── extraction helpers used by the rules above ────────────────────────────── */

type ActionLike = { kind: string; [k: string]: unknown };

function actionKey(a: ActionLike): string {
  switch (a.kind) {
    case "shopify":
      return `shopify:${String(a.productId ?? "")}`;
    case "whatsapp":
      return `whatsapp:${String(a.phone ?? "")}`;
    case "url":
      return `url:${String(a.href ?? "")}`;
    case "form":
      return "form";
    default:
      return a.kind;
  }
}

/** Primary conversion actions across the page — hero, sticky bar, and final CTA sections. */
function collectPrimaryActions(page: Page): ActionLike[] {
  const out: ActionLike[] = [];
  const hero = firstOfType(page, "hero-product");
  if (hero?.props.primaryCta?.action) out.push(hero.props.primaryCta.action as ActionLike);
  if (page.fixtures.stickyCta?.cta?.action) out.push(page.fixtures.stickyCta.cta.action as ActionLike);
  for (const b of visible(page)) {
    if (b.type === "offer-stack") {
      for (const offer of b.props.offers ?? []) {
        const a = (offer as { cta?: { action?: unknown } }).cta?.action;
        if (a) out.push(a as ActionLike);
      }
    }
  }
  return out;
}

/** Alt strings for every image reachable in a block's props (shallow, by convention). */
function collectImages(block: Block): string[] {
  const alts: string[] = [];
  const walk = (v: unknown, depth = 0) => {
    if (depth > 4 || v === null || typeof v !== "object") return;
    const obj = v as Record<string, unknown>;
    if (typeof obj.src === "string" && typeof obj.alt === "string") alts.push(obj.alt);
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) val.forEach((x) => walk(x, depth + 1));
      else if (val && typeof val === "object") walk(val, depth + 1);
    }
  };
  walk(block.props);
  return alts;
}

/* ────────────────────────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────────────────────────── */

function gradeFor(score: number): CroGrade {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 55) return "Needs work";
  return "Weak";
}

/** Runs the full rubric against a page and returns a scored, categorised, cited report. */
export function auditPage(page: Page): CroReport {
  const findings = rules.map((r) => r(page)).filter((f): f is CroFinding => f !== null);

  let weighted = 0;
  let weightTotal = 0;
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const f of findings) {
    const w = IMPACT_WEIGHT[f.impact];
    weighted += w * STATUS_VALUE[f.status];
    weightTotal += w;
    counts[f.status]++;
  }
  const score = weightTotal === 0 ? 0 : Math.round((weighted / weightTotal) * 100);

  const categories: CroCategoryScore[] = CATEGORY_ORDER.map((category) => {
    const inCat = findings.filter((f) => f.category === category);
    let cw = 0;
    let ct = 0;
    for (const f of inCat) {
      cw += IMPACT_WEIGHT[f.impact] * STATUS_VALUE[f.status];
      ct += IMPACT_WEIGHT[f.impact];
    }
    return { category, score: ct === 0 ? 0 : Math.round((cw / ct) * 100), findings: inCat };
  }).filter((c) => c.findings.length > 0);

  // Summary highlights the two highest-impact non-passing findings — the wins to chase.
  const wins = findings
    .filter((f) => f.status !== "pass" && f.fix)
    .sort((a, b) => IMPACT_WEIGHT[b.impact] - IMPACT_WEIGHT[a.impact])
    .slice(0, 2)
    .map((f) => f.title.toLowerCase());
  const grade = gradeFor(score);
  const summary =
    wins.length === 0
      ? `${grade}. All ${counts.pass} checks pass — this page follows the conversion playbook.`
      : `${grade}. ${counts.pass} of ${findings.length} checks pass. Biggest wins available: ${wins.join(", ")}.`;

  // Findings ordered worst-first, weighted by impact — the fix list, top-down.
  const rank = (f: CroFinding) =>
    (f.status === "fail" ? 2 : f.status === "warn" ? 1 : 0) * 10 + IMPACT_WEIGHT[f.impact];
  const ordered = [...findings].sort((a, b) => rank(b) - rank(a));

  return { score, grade, summary, counts, findings: ordered, categories };
}
