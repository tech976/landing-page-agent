---
name: cro-landing-builder
description: "Build a CRO-optimized landing page for ANY vertical (fitness, fashion, beauty, food, SaaS, finance, and more) from a product brief. Produces a domain-aware page scaffold — block order, proof strategy, objection handling, credible urgency, and ad-policy guardrails tuned to the vertical — that the Landing Agent's Claude API generator then fills with real copy and offers. Use when creating a new landing page, scaffolding a page for a specific niche, or making an existing page more conversion-optimized. Triggers: create landing page, build landing page, new landing page, CRO landing page, page for fitness/fashion/beauty/etc, landing page template, conversion-optimized page."
metadata:
  version: 1.0.0
  author: Landing Agent
---

# CRO Landing Builder

## Purpose

Turn a product brief into a **CRO-optimized, vertical-aware landing page** — for any market
(fitness, fashion, beauty, food, home, electronics, jewelry, SaaS, finance, education, health,
baby & kids, and anything else via a generic fallback).

This is the playbook the Landing Agent uses so that **every generated page is conversion-optimized
by construction, not audited afterward**. It encodes three things:

1. **What converts differently per vertical** — the proof a supplement buyer trusts (third-party
   lab results) is not the proof a fashion buyer trusts (fit, returns, real-customer photos), and
   the urgency that is credible on a fitness launch cohort reads as a scam on a ₹499 tee.
2. **The evidence base** — every recommendation anchors to `.claude/skills/_shared/benchmarks/patterns.json`
   and the anti-patterns file, so "best practice" is never applied where the evidence says it backfires.
3. **The ad-policy guardrails** — the health-claim, before/after, and finance-disclosure landmines
   that get Meta and Google ad accounts disapproved or suspended.

## How this fits the two-part architecture

Read this once — it corrects the most common misconception.

```
  BRIEF  ──▶  [ this skill / domain profile ]  ──▶  Claude API generation  ──▶  validated page JSON
  (what the         the CRO + vertical                 fills in real copy,          (rendered + editable
   marketer          scaffold: which blocks,            offers, proof from            in the Puck editor)
   supplies)         in what order, with what           the brief
                     proof/objection/urgency
                     strategy for this vertical
```

- **The skill provides the CRO brain** (this file + the domain profiles). It decides the *shape* of
  the page for the vertical.
- **The Claude API generator fills the content** — real copy, real prices, real proof from the brief —
  by calling `render_page` against the locked block registry.

Two consumers, one source of truth. The machine-readable version of this playbook lives at
`src/lib/generate/domains.ts` (the `DomainProfile` for each vertical) and is injected into the API
generation prompt at `src/lib/generate/prompt.ts` as the **Vertical Playbook** section. **Editing a
profile in `domains.ts` changes what every generated page in that vertical does.** Keep this file and
`domains.ts` in agreement — this is the human-facing playbook, that is the machine-facing one.

## When to Use

- Creating a new landing page for a product in a specific vertical
- Scaffolding the block structure before generation
- Deciding proof strategy, objection order, and credible urgency for a niche
- Reviewing whether a generated page is optimized *for its vertical* (not just generically)
- Adding a new vertical to the generator

## Before You Start

1. **Identify the vertical.** Ask the user, or infer from the product ("whey protein" → fitness,
   "silk saree" → fashion, "vitamin C serum" → beauty). If it matches no built-in profile, the
   generic profile applies — still CRO-optimized, just not vertical-specialised.
2. **Get the brief essentials.** Product + price + compare-at, the ad headline and primary keyword
   (message match depends on it), the checkout destination (Shopify / WhatsApp / form / URL), and
   the real proof the brand can evidence (rating, reviews, certifications, claims).
3. **Confirm what proof is REAL.** The single rule that overrides everything: a number the page
   asserts must come from the brief. A vertical that "expects" clinical proof does not license
   inventing a clinical result the brand does not have. See DATA INTEGRITY below.
4. **Read the shared frameworks** (they are the evidence this skill stands on):
   - `../_shared/frameworks/anti-patterns.md` — where canonical best-practice backfires
   - `../_shared/benchmarks/patterns.json` — 54 patterns with A/B-test lift ranges and citations
   - `../_shared/frameworks/ice-confidence-rubric.md` — anchor confidence on evidence, not familiarity

## The block vocabulary (fixed registry)

The generator composes pages from exactly these blocks — nothing else. A page is a `blocks[]` array
of FLOW blocks plus three FIXTURES.

**Flow blocks** (reorderable, each has a stable id):
`announcement-bar` · `hero-product` · `urgency-strip` · `offer-stack` · `product-narrative` ·
`collection-grid` · `persona-cards` · `value-pillars` · `spec-table` · `review-wall` ·
`comparison-table` · `faq-accordion`

**Fixtures** (page-level singletons, never in the flow order):
`stickyCta` (mobile price + CTA bar) · `socialProofPopup` (recent-purchase toasts) ·
`trustBar` (payment + guarantee marks)

The default cold-traffic flow is: *confirm the promise → make the offer → prove it → remove friction
→ close.* Each vertical adapts this — see the domain profiles.

## Domain profiles — the vertical playbooks

Full machine-readable profiles: `src/lib/generate/domains.ts`. Each profile carries: the buyer's real
decision, the realistic conversion goal, hero emphasis, proof that converts / proof that backfires,
the real objections, CTA style, credible urgency, trust signals, copy tone, visual guidance, price
framing, vertical cautions, and ad-policy notes. Highlights:

| Vertical | Hero leads with | Proof that converts | Watch out for |
|---|---|---|---|
| **fitness** | credible outcome + timeline, backed by testing | before/after (mid-page), third-party lab/COA, real results | Meta negative-self-perception + health-claim disapprovals; fake timers on evergreen SKUs |
| **fashion** | the product worn, in motion / on-body | fit + real-customer photos (UGC), easy returns, size guide | hero video hurts mobile CVR; returns anxiety is the #1 objection |
| **beauty** | the concern it solves + mechanism/ingredient | before/after, dermatologist-tested, ingredient transparency | unsubstantiated "clinically proven"; allergen/patch-test omissions |
| **food** | taste + what's *not* in it | FSSAI, real reviews, ingredient sourcing | health claims on packaged food; unverified "sugar-free"/"natural" |
| **electronics** | the spec that matters + what it does for you | spec clarity, warranty, real reviews, comparison | spec-dump before benefit; warranty/service ambiguity |
| **jewelry** | craftsmanship + material certainty | hallmark/certification, real photos, guarantee | discount-screaming cheapens luxury; authenticity doubt |
| **saas** | the outcome + time-to-value | logos (only if recognised), case studies with numbers, free trial | logo walls that fail the recognition test (DoWhatWorks: usually LOST) |
| **finance** | the concrete benefit + trust | regulatory registration, security marks, transparent terms | **mandatory disclosures**; "guaranteed returns" is a ban trigger |
| **health** | the outcome + credentials | practitioner credentials, certifications, real outcomes | **highest ad-policy sensitivity** — disease/cure claims, before/after limits |
| **education** | the career/skill outcome + proof it works | outcome stats (if real), alumni results, curriculum clarity | fabricated placement numbers; vague "transform your life" |
| **baby_kids** | safety first, then benefit | safety certifications, parent reviews, non-toxic proof | any safety claim must be evidenced; parents fact-check hard |
| **fashion/food/etc.** | see `domains.ts` | — | — |
| **generic** | clarity + the single most credible proof | whatever the brief can evidence, review distribution | applies when no profile matches — still fully CRO-structured |

To scaffold a page for a vertical: pull its profile, use its `recommendedFlowOrder` as the starting
structure, lead the hero with its `heroEmphasis`, prioritise its `proofThatConverts`, answer its
`topObjections` above the final CTA, and respect its `croCautions` and `adPolicyNotes`.

## Cross-vertical rules (apply to EVERY page)

These hold regardless of vertical and are enforced by the generator's validators:

1. **Message match is the highest-leverage lever.** The announcement bar and hero confirm the ad's
   exact promise (same offer, same keyword) in the first paint. Ad-to-page mismatch outranks every
   creative tweak as a cause of high-CPC, low-CVR campaigns.
2. **Primary CTA reachable within ~400px of scroll on a 360×640 mobile viewport.** ~67% of Indian
   paid traffic is mobile; 40–60% never scroll past the hero.
3. **One primary action per page.** Every primary CTA resolves to the same destination. Secondary
   CTAs may differ (WhatsApp for questions). Split intent is lost intent.
4. **Real proof only — distribution beats average.** A 4.2–4.7 rating spread converts better than a
   flat 5.0 (Spiegel Research Center). Generic/stock testimonials are net-negative (DoWhatWorks).
   Never fabricate — the invented number is the one a sceptic tests, and it drags the real ones down.
5. **Credible urgency only, at most once.** Real scarcity can lift +8–22%; manufactured/perpetual
   urgency swings negative and is an ad-policy and (in India) a CCPA risk. One countdown per page.
6. **Mobile-first sizing and copy.** Write every string to a 360px line box first. No autoplay hero
   video on mobile — an image slider beat hero video by +35% in the Device Magic test.
7. **5th–7th grade reading level, second person, benefit first.** Lead with the outcome, not the
   mechanism. Indian English (pincode, COD, UPI, EMI, ₹ with Indian digit grouping).
8. **Objection coverage before the close.** Answer COD, delivery time, returns, authenticity, and
   safety above the final CTA. In India, "Is COD available?" and "How long to my pincode?" are the
   two highest-impact FAQ entries.
9. **Fast LCP.** The hero image is priority-loaded, never lazy; everything else lazy. Speed is a
   conversion lever (redBus India: CLS fix → +80–100% mobile CVR).

## DATA INTEGRITY — the rule that overrides the playbook

**A number the page asserts as fact must come from the brief.** Not from what a page in this vertical
"usually says." If the brief has it → use it exactly. If the brief lacks it → **omit the element.**
Omitting is always correct. This governs ratings, review counts, units sold, "X% saw results",
certifications, lab tests, awards, and press mentions. A vertical playbook that says "beauty pages
convert on clinical proof" is telling you *what to feature when the brief supports it* — never a
licence to invent it.

## Output Format (when scaffolding a page for a user)

1. **Vertical** — which profile applies, and why
2. **Page structure** — the flow-block order for this vertical, with a one-line rationale per block
3. **Hero strategy** — what the hero leads with, and the message-match hook to the ad
4. **Proof plan** — which proof blocks, in what order, drawn from what the brief can evidence
5. **Objection map** — the vertical's top objections and where each is answered
6. **Urgency & trust** — what is credible here, and the ad-policy cautions to respect
7. **What's missing** — proof or fields the brief lacks that would lift conversion if added

## Related Skills

- **page-cro** — audit an existing/generated page against the same framework
- **copywriting** — write or rewrite the actual block copy
- **_shared frameworks** — the evidence base every recommendation anchors to

## Shared Frameworks (REQUIRED reading)

- `../_shared/frameworks/anti-patterns.md` — read before recommending any "best practice" element
- `../_shared/benchmarks/patterns.json` — match every recommendation to a `pattern_id` + lift range
- `../_shared/frameworks/ice-confidence-rubric.md` — anchor confidence on evidence quality
- `../_shared/frameworks/preflight-checklist.md` — verify vertical, goal, audience, and message match first
