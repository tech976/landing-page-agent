/**
 * Landing Agent — domain (vertical) CRO profiles.
 *
 * The generator produces pages for many verticals (fitness, fashion, beauty, food, ...).
 * What converts differs by vertical: the proof a supplement buyer trusts (third-party lab
 * results) is not the proof a fashion buyer trusts (fit, returns, UGC), and the urgency that
 * is credible on a launch-cohort fitness program reads as a scam on a Rs 499 tee.
 *
 * Each DomainProfile is an evidence-informed brief for ONE vertical: how the hero should lead,
 * which proof converts and which backfires, the real objections, the credible urgency, the
 * trust marks that matter, and the ad-policy landmines (health/finance especially).
 *
 * OPEN BY DESIGN. The set below covers the top verticals; resolveDomain falls back to the
 * "generic" profile for anything else, so a user can type any vertical and still get a
 * CRO-optimized, sensibly-structured page. Add a profile here to specialise a new vertical.
 *
 * SINGLE SOURCE OF TRUTH. This module is consumed by the API generation prompt
 * (src/lib/generate/prompt.ts) AND documented by the cro-landing-builder skill. Editing a
 * profile here changes what every generated page in that vertical does.
 *
 * Fixtures note: recommendedFlowOrder lists FLOW blocks only. The three fixtures
 * (trustBar, stickyCta, socialProofPopup) are page.fixtures singletons and are always
 * considered, never part of the flow order.
 */

export interface DomainProfile {
  /** Canonical vertical key. */
  domain: string;
  /** Words a user might type that map to this vertical. */
  aliases: string[];
  /** What a buyer in this vertical is really deciding. */
  oneLine: string;
  /** The realistic conversion goal for cold paid traffic here. */
  primaryGoal: string;
  /** Suggested FLOW-block order for this vertical (flow blocks only; a strong default, not a mandate). */
  recommendedFlowOrder: string[];
  /** What the hero must lead with in this vertical. */
  heroEmphasis: string;
  /** Proof types that move this buyer, most persuasive first. */
  proofThatConverts: string[];
  /** Proof types that are weak or backfire here. */
  proofToAvoid: string[];
  /** The real objections a cold buyer has, in their words. */
  topObjections: string[];
  /** CTA friction level and phrasing that fits. */
  ctaStyle: string;
  /** What urgency/scarcity is believable here vs what reads as fake. */
  urgencyCredibility: string;
  /** Certifications, badges and guarantees that matter in this vertical. */
  trustSignals: string[];
  /** The voice that fits this buyer. */
  copyTone: string;
  /** Imagery and gallery guidance. */
  visualNotes: string;
  /** How price/discount should be framed. */
  priceFraming: string;
  /** Vertical-specific anti-patterns to avoid. */
  croCautions: string[];
  /** Google/Meta landing-page policy sensitivity for this vertical. */
  adPolicyNotes: string;
}

export const DOMAIN_PROFILES: DomainProfile[] = [
  {
    domain: "fitness",
    aliases: ["supplements","supplement","protein","whey","gym","home fitness","home gym","workout","wellness","weight loss","fat loss","muscle","preworkout","nutrition","yoga"],
    oneLine: "Buyers are deciding 'will this actually change my body/energy, how fast, and is it safe to put in my body' — they are buying a believable outcome, not a product.",
    primaryGoal: "Buy Now (single unit or multi-month pack) for supplements/equipment; Start plan / Book free trial for programs and gyms. Subscription (monthly replenishment) is the AOV lever. WhatsApp order as COD-trust secondary in India.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","review-wall","product-narrative","offer-stack","persona-cards","comparison-table","spec-table","faq-accordion"],
    heroEmphasis: "Lead with the transformation outcome tied to a credible timeline ('visible fat loss in 8–12 weeks'), NOT the ingredient. Immediately back it with the credibility hook that survives scepticism: third-party lab tested / COA, and real customer results. Before/after belongs high but see ad_policy_notes — safe on organic pages, risky as an ad destination.",
    proofThatConverts: ["real customer before/after with a stated timeline","third-party lab test / Certificate of Analysis / Informed-Sport (removes 'is it fake/laced' fear)","review volume with a natural 4.2–4.7 spread (Spiegel Research Center: purchase likelihood peaks 4.2–4.7; a flat 5.0 reads as bought)","UGC video of real users","coach/athlete/nutritionist endorsement with credentials","per-serving cost math vs competitor"],
    proofToAvoid: ["airbrushed model physiques that clearly aren't customers (reads as stock/aspirational, not evidence)","'clinically proven' with no study linked — invites Meta disapproval and buyer distrust","100% 5-star walls","celebrity endorsements without a substance claim"],
    topObjections: ["Does this actually work or is it just hype?","Is it safe / third-party tested / not laced with banned stuff?","How long until I see results?","Is it worth the price vs the ₹599 tub on Amazon?","Will it taste bad / cause bloating?"],
    ctaStyle: "Medium friction, outcome-worded. 'Start my 30-day plan', 'Get my 3-month supply', 'Buy Now — COD available'. For programs/gyms: 'Start free trial', 'Book my intro session'. Avoid bare 'Add to Cart' for cold traffic — it skips the commitment framing.",
    urgencyCredibility: "Launch/challenge cohorts and batch-based programs are genuinely credible ('next 12-week batch starts Monday'). Subscription price-locks are credible. A ticking timer on an evergreen protein tub is not — use daily-reset offer framing or real stock, never a fake fixed deadline (patterns.json urgency_manufactured_perpetual: non-trivial share of urgency tests go negative and detected-fake urgency damages LTV).",
    trustSignals: ["FSSAI licence number (mandatory for nutraceuticals in India — FSS Nutraceuticals Regs 2022)","third-party lab test / COA / Informed-Sport / Labdoor","GMP / ISO manufacturing","vegetarian/vegan mark, 'no banned substances'","money-back / results guarantee","COD + secure payment"],
    copyTone: "Motivating, plain-spoken coach. Second person, benefit-first, honest about effort ('this works if you take it daily'). No pseudo-science jargon.",
    visualNotes: "Supplements need: product + label legible (dosage transparency), lifestyle/in-use, results/before-after, and the lab report. Equipment needs in-use-at-home footage and dimensions. Real bodies over models. Avoid heavy autoplay hero video on mobile (anti-patterns.md: 1s load delay ≈ -20% CVR; image slider beat hero video +35% in the Device Magic test).",
    priceFraming: "Per-serving cost is the strongest lever ('₹42 a day'). Multi-month packs framed as a full transformation cycle ('8 weeks needs 2 tubs'). Subscribe-and-save for replenishment. Rupee savings over percentage (offer-stack savingsDisplay 'both').",
    croCautions: ["Unsubstantiated health/disease claims ('cures diabetes', 'melts fat') get Meta/Google disapprovals AND kill trust","Fake timers on evergreen SKUs","over-claiming timelines you can't defend","body-shaming 'before' framing triggers Meta's negative-self-perception policy"],
    adPolicyNotes: "HIGH sensitivity. Meta restricts personal-health attributes (copy that implies the viewer has a weight/health condition) and weight-loss/before-after imagery under its negative-self-perception and personal-attributes policies; Google mirrors this. Keep claims structure/function level and substantiated; avoid 'guaranteed results', disease claims, and idealized-body before/afters as the ad-linked LP hero. Directional: safer to put before/after mid-page and lead the ad LP with mechanism + testing.",
  },
  {
    domain: "fashion",
    aliases: ["fashion","apparel","clothing","clothes","footwear","shoes","sneakers","accessories","bags","ethnic wear","streetwear","activewear","denim"],
    oneLine: "Buyers are deciding 'will it look good on ME and will it fit' — desire is visual and instant; the killer is fit/return anxiety, not price.",
    primaryGoal: "Buy Now / Add to Cart. Fit and size selection are part of the conversion. COD + easy exchange are decisive in India. Collection-grid browse path matters more here than in single-SKU verticals.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","review-wall","offer-stack","persona-cards","product-narrative","spec-table","faq-accordion","collection-grid"],
    heroEmphasis: "Visual/lookbook first: garment on a real body + scale reference ('model is 5'8\", wearing M'), with a fast-loading multi-image gallery (on-body, flat-lay, detail/fabric, back). Fit and size guide reachable immediately. The hero sells the look; fit reassurance sells the click.",
    proofThatConverts: ["UGC / real customers wearing it (styled on varied body types and Indian skin tones)","reviews that mention fit ('true to size', 'runs small') — Spiegel: review presence lifts purchase up to ~270%","photo reviews","styling/lookbook context","'X sold' volume for trend validation"],
    proofToAvoid: ["single flawless model shot with no scale or fit info","obviously stock/agency imagery","fake scarcity on a low-value tee (reads as a scam)","review walls with zero fit commentary"],
    topObjections: ["Will it fit me / what size am I?","Will it look like the photo (colour, fabric, quality)?","How do returns/exchanges work if the size is wrong?","Is the fabric quality worth it?","How long is delivery?"],
    ctaStyle: "Low friction, desire-led. 'Add to Cart', 'Shop the Look', 'Get it in your size'. Secondary: 'Check my size'. Keep it fast — fashion is impulse.",
    urgencyCredibility: "Size-level low stock is genuinely believable ('Only 2 left in M') because sizes really do sell out (patterns.json scarcity_inventory_depletion_visual: real inventory bars +8–22%). Drop/limited-edition framing is credible. A generic countdown on a basic tee is not.",
    trustSignals: ["easy exchange / free returns badge","COD + secure payment (UPI marks)","authentic-product / no-counterfeit assurance","secure checkout","'X happy customers'"],
    copyTone: "Aspirational but friendly, trend-aware, concise. Let the imagery carry desire; copy handles fit and logistics.",
    visualNotes: "Fashion needs the trio+: on-body model, flat-lay, fabric/detail macro, and a scale/fit reference. Multiple body types and real skin tones convert broader Meta audiences. CRITICAL: no autoplay hero video on mobile — it hurts LCP (anti-patterns.md hero-video: net-negative on mobile). Use a swipe gallery.",
    priceFraming: "Discount codes and free-shipping thresholds drive it; bundle 'complete the look' for AOV. EMI only for premium/footwear above ~₹3,000. Don't over-discount premium/designer — it cheapens perceived quality.",
    croCautions: ["Missing/weak size guidance is the #1 conversion and return killer","autoplay hero video tanks mobile LCP","fake timers on cheap SKUs","hiding return/exchange terms","colour that misrepresents the actual product invites returns"],
    adPolicyNotes: "LOW policy sensitivity generally. Watch counterfeit/IP claims (Meta & Google prohibit counterfeit), and avoid body-image 'before/after' framing for shapewear/activewear (triggers personal-attributes/negative-self-perception review). Product images must have real alt text for policy review.",
  },
  {
    domain: "beauty",
    aliases: ["beauty","skincare","skin care","cosmetics","makeup","haircare","hair care","serum","cream","sunscreen","anti-aging","cosmetic","face wash"],
    oneLine: "Buyers are deciding 'will this fix my specific skin/hair concern without breaking me out or being unsafe' — it's a concern-to-solution match backed by ingredient credibility.",
    primaryGoal: "Buy Now, with strong pull toward regimen bundles and subscription/replenishment. Concern-based self-selection (persona-cards) lifts both conversion and repeat.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","persona-cards","review-wall","product-narrative","offer-stack","spec-table","comparison-table","faq-accordion"],
    heroEmphasis: "Ingredient + clinical + concern: name the concern ('fades dark spots'), the hero active ('2% alpha arbutin'), and the credibility marker ('dermatologically tested', clinical %). Before/after supports but is policy-sensitive as an ad LP hero. Texture/swatch shot matters.",
    proofThatConverts: ["clinical result % with a defined study ('87% saw fewer dark spots in 8 weeks, n=32')","dermatologist endorsement/credentials","before/after (organic-safe; see policy)","UGC swatches and results on varied skin tones","ingredient transparency + INCI/percentages","review distribution 4.2–4.7 (Spiegel)"],
    proofToAvoid: ["'miracle overnight' claims (policy + credibility risk)","before/after as the ad-linked hero for skin/acne (Meta personal-attributes landmine)","unattributed 'clinically proven'","flawless-model imagery with no real-skin evidence"],
    topObjections: ["Will it work for MY skin concern/type?","Will it break me out / is it safe for sensitive skin?","Are the ingredients legit and at effective strength?","How long until I see results?","Is it worth it vs a drugstore option?"],
    ctaStyle: "Low–medium friction, concern-led. 'Start my routine', 'Get my serum', 'Fix my dark spots'. Subscription: 'Never run out — subscribe & save'.",
    urgencyCredibility: "Restock/limited-batch (fresh actives) is credible; launch pricing is credible. Avoid ticking timers on evergreen SKUs. Replenishment reminders read as helpful, not pushy.",
    trustSignals: ["dermatologically / clinically tested","cruelty-free / vegan marks","'no parabens/sulphates/mineral oil' where true","CDSCO cosmetic registration (India) / FDA-facility (US)","FSSAI if ingestible beauty","patch-test guidance","secure payment + easy returns"],
    copyTone: "Knowledgeable but warm skin-coach; specific about ingredients without alienating first-timers. Educate, don't hype.",
    visualNotes: "Skincare needs: product + legible label, texture/swatch, ingredient hero shot, results, and on-skin across tones. Consistent, science-forward art direction builds credibility. Keep hero light for LCP.",
    priceFraming: "Per-use cost and regimen bundles ('AM/PM routine'), replenishment subscription. Rupee savings on bundles. Avoid deep discounting that undermines a 'clinical/premium' positioning.",
    croCautions: ["Disease/drug-level claims ('cures acne', 'removes wrinkles permanently') are policy + legal risk","before/after as ad LP hero for skin","overstating clinical results without a study","ingredient fear-mongering about competitors"],
    adPolicyNotes: "MEDIUM-HIGH. Meta restricts before/after imagery and personal-attribute copy for skin conditions (acne, pigmentation); Google restricts exaggerated cosmetic claims. Keep claims cosmetic (appearance) not therapeutic; substantiate percentages; move before/after off the ad-linked hero. Ingestible beauty inherits food/supplement claim rules.",
  },
  {
    domain: "food",
    aliases: ["food","packaged food","gourmet","snacks","beverages","drinks","coffee","tea","health food","healthy snacks","organic food","chocolate","spices","meal"],
    oneLine: "Buyers are deciding 'will it taste good AND is it genuinely as healthy/clean/fresh as it claims' — appetite appeal opens the sale, credibility (FSSAI, ingredients) closes it.",
    primaryGoal: "Buy Now, with sampler/variety packs and subscription (replenishment) as AOV levers. Low-ticket impulse — keep the path short.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","review-wall","offer-stack","product-narrative","spec-table","persona-cards","faq-accordion","collection-grid"],
    heroEmphasis: "Appetite-first photography + the one credibility claim that matters for the category ('no preservatives', 'FSSAI-certified', 'cold-pressed', 'high-protein'). Taste is the promise; clean-label is the proof.",
    proofThatConverts: ["taste reviews with volume ('12,000+ love the flavour')","UGC / real people eating it","nutritionist/chef endorsement","certifications (FSSAI, organic — India Organic/Jaivik Bharat, USDA, vegan, no-added-sugar)","ingredient panel transparency","'X sold' freshness signal"],
    proofToAvoid: ["health claims implying disease cure/detox (policy + FSSAI violation)","stock food photography that looks nothing like the product","unverifiable 'superfood' hype","5.0 review walls"],
    topObjections: ["Will it actually taste good?","Is it really healthy / is the 'healthy' claim real?","How fresh is it / what's the shelf life?","Is it safe / certified?","Is delivery reliable and will it arrive intact?"],
    ctaStyle: "Low friction, appetite-led. 'Order now', 'Try the variety pack', 'Taste it — COD available'. Subscription: 'Subscribe & save 15%'.",
    urgencyCredibility: "Freshness/small-batch and seasonal limited runs are credible ('this week's roast'). Subscription framing is natural. Avoid fake countdowns on shelf-stable staples.",
    trustSignals: ["FSSAI licence (mandatory in India)","organic/vegan/no-added-sugar/gluten-free certifications","'no preservatives/no palm oil' where true","batch-fresh / hygiene certifications","COD + easy replacement for damaged items"],
    copyTone: "Warm, sensory, honest. Make the mouth water, then reassure the label-reader. Avoid clinical over-claiming.",
    visualNotes: "Food needs: hero appetite shot (styled but true-to-product), texture/close-up, ingredient/sourcing, lifestyle in-use, and the pack/label. Sourcing story imagery (farm, roastery) builds premium trust.",
    priceFraming: "Per-serving cost and variety/sampler packs lower first-order risk; subscription for consumables. Bundle by occasion ('gifting box'). Rupee savings on multi-packs.",
    croCautions: ["Therapeutic/weight-loss/detox claims on food are a FSSAI + ad-policy violation","misrepresentative food styling drives returns and complaints","overusing 'superfood'/'immunity' without basis","fake freshness urgency on shelf-stable goods"],
    adPolicyNotes: "MEDIUM. India: FSSAI regulates health/nutrition claims (no disease-cure, no misleading 'health' claims); ASCI polices misleading food ads. Meta/Google restrict weight-loss and unrealistic-health claims on food/beverages. Keep claims to permitted nutrition/structure statements with substantiation.",
  },
  {
    domain: "home",
    aliases: ["home","home decor","decor","furniture","kitchenware","cookware","home improvement","furnishings","bedding","appliances small","lighting","organization"],
    oneLine: "Buyers are deciding 'will it fit and look right in MY space, is the quality real, and can I deal with delivery/assembly/returns of something bulky' — spatial fit and durability dominate.",
    primaryGoal: "Buy Now for decor/kitchenware (mid-ticket); for furniture (high-ticket) expect more consideration — EMI, and a stronger justify-before-price flow. Free delivery/installation is decisive.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","product-narrative","comparison-table","review-wall","offer-stack","spec-table","persona-cards","faq-accordion","collection-grid"],
    heroEmphasis: "Show it in-context (styled room scene) so buyers picture it in their home, plus explicit dimensions and material. For furniture (high-ticket) lead with durability/quality justification and EMI, not discount. Scale reference is essential.",
    proofThatConverts: ["in-situ customer photos (real homes, real light)","dimension diagrams / to-scale imagery / AR","material & durability detail + warranty","reviews mentioning quality and assembly ease","'X homes' volume"],
    proofToAvoid: ["renders that look nothing like the delivered item","no-scale glamour shots that misrepresent size","hidden dimensions (top complaint driver)","stock interior photography"],
    topObjections: ["Will it fit / look right in my space?","Is the quality/material actually good and durable?","How does delivery and (for furniture) assembly work?","What if it's damaged or I don't like it — returns on bulky items?","Is it worth the price?"],
    ctaStyle: "Medium friction. Decor/kitchenware: 'Buy Now'. Furniture: 'Buy on EMI', 'Book with free installation', secondary 'Chat on WhatsApp' for made-to-order/measurement queries.",
    urgencyCredibility: "Genuine limited stock on imported/handmade pieces is credible; festive/seasonal decor deadlines are credible. Avoid fake timers on catalogue furniture. Real inventory bars OK.",
    trustSignals: ["warranty (years) + quality/material certifications","free delivery + installation","secure payment + no-cost EMI","damage-replacement guarantee","BIS/ISI marks for electricals; food-grade for cookware"],
    copyTone: "Aspirational-practical. Help them visualize the finished room, then reassure on quality, size, and logistics.",
    visualNotes: "Home needs: styled in-context room scene, scale/dimension diagram, material macro, and detail/craftsmanship. For furniture add assembly/usage. AR/'view in your room' is a strong differentiator.",
    priceFraming: "No-cost EMI is the primary lever for furniture in India; bundle sets for kitchenware/decor ('dinner set of 6'); free delivery/installation as value not discount. For premium, justify-then-price (narrative + comparison above offer-stack).",
    croCautions: ["Missing dimensions = returns + abandonment","under-communicating delivery/assembly for bulky items","over-discounting premium furniture (cheapens it)","renders that overstate quality"],
    adPolicyNotes: "LOW. Standard e-commerce compliance (real alt text, accurate representation). Electrical/gas items should reference BIS/ISI safety marks. No special restricted-category constraints.",
  },
  {
    domain: "electronics",
    aliases: ["electronics","gadgets","gadget","appliances","tech","devices","accessories","earbuds","smartwatch","speaker","charger","kitchen appliances","home appliances"],
    oneLine: "Buyers are deciding 'is this genuine, does it out-spec the alternatives, and is warranty/after-sales real' — specs, authenticity and service anxiety dominate.",
    primaryGoal: "Buy Now, often after comparison. Exchange offers and no-cost EMI drive appliance conversions. Authenticity + warranty are decisive for unknown brands.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","spec-table","comparison-table","review-wall","offer-stack","product-narrative","persona-cards","faq-accordion","collection-grid"],
    heroEmphasis: "Lead with the headline capability/spec that beats the alternative ('40h battery, ANC, IPX7') plus the trust triad: genuine-product, warranty, service. Spec-table sits high here (unusual) because this buyer compares numbers.",
    proofThatConverts: ["head-to-head spec comparison (vs category/'ordinary' alternatives, not necessarily named)","expert/tech-reviewer endorsement","review volume + ratings with real usage detail","warranty + service-network proof","demo of the key feature"],
    proofToAvoid: ["vague 'premium quality' with no numbers","fabricated competitor specs (invites fact-checking + Meta disapproval)","stock renders passing as real product","5.0 walls"],
    topObjections: ["Is it genuine / not a cheap knockoff?","Is the warranty real and is service available near me?","Do the specs actually beat the bigger brand for the price?","Is it compatible with my devices?","What if it's defective on arrival?"],
    ctaStyle: "Medium friction, value-led. 'Buy Now', 'Buy on no-cost EMI', 'Get it with 2-yr warranty'. Exchange: 'Exchange & save'.",
    urgencyCredibility: "Genuine launch/early-bird and real limited stock are credible; price-drop windows tied to a real sale are credible. Avoid perpetual fake timers. Real inventory bars fit the category (stockouts plausible).",
    trustSignals: ["brand warranty + authorized-seller / genuine-product badge","BIS registration (mandatory for many electronics in India)","service-network / support availability","secure payment + no-cost EMI","DOA/replacement guarantee"],
    copyTone: "Confident, spec-literate but benefit-translated ('40h battery = a full week without charging'). Respect the comparison-shopper.",
    visualNotes: "Electronics need: product on clean ground, key-feature callouts/exploded view, in-use lifestyle, ports/spec close-ups, and box contents. A short muted demo clip helps but must not block LCP on mobile.",
    priceFraming: "No-cost EMI and exchange offers are the primary India levers; bundle accessories; frame against the bigger brand's price for the same spec. Rupee savings on bundles.",
    croCautions: ["Inventing competitor specs/prices (fact-checkable, Meta-risky)","hiding warranty/service reality","counterfeit/IP issues","spec-dumping without benefit translation kills momentum"],
    adPolicyNotes: "LOW–MEDIUM. Counterfeit and IP-infringement are prohibited (Meta/Google). Avoid unverifiable superlatives ('world's best'). India: reference BIS registration for regulated devices. Comparative claims should compare to categories, not fabricated named-competitor numbers.",
  },
  {
    domain: "jewelry",
    aliases: ["jewelry","jewellery","fine jewelry","fashion jewelry","watches","luxury","gold","diamond","silver","rings","necklace","earrings","luxury accessories"],
    oneLine: "Buyers are deciding 'is it authentic/certified, is it worth this much, and will it hold value/last' — for fine jewelry it's trust + investment; for fashion jewelry it's look + value.",
    primaryGoal: "Buy Now for fashion jewelry/watches; for fine/high-ticket expect consideration — EMI, certification, and often a WhatsApp/appointment secondary. Gifting is a major buying occasion.",
    recommendedFlowOrder: ["announcement-bar","hero-product","product-narrative","value-pillars","review-wall","offer-stack","spec-table","comparison-table","faq-accordion","persona-cards","collection-grid"],
    heroEmphasis: "Aspirational, craftsmanship-led imagery + the authenticity marker (BIS Hallmark / IGI-GIA certificate / purity). Lead with desire and provenance, not discount. Detail/close-up macro is essential.",
    proofThatConverts: ["certification (BIS Hallmark for gold, IGI/GIA for diamonds, purity assay)","craftsmanship/provenance story","secure & insured shipping proof","buyback/exchange/lifetime-warranty policy","tasteful reviews + gifting testimonials","hallmark/serial verification"],
    proofToAvoid: ["loud discount urgency (erodes luxury perception)","fake scarcity timers","generic model shots with no detail/certification","'70% OFF' banners on fine jewelry (signals fake)"],
    topObjections: ["Is it real / certified / the stated purity?","Is it worth this price / making charges fair?","Will it tarnish or last?","Can I return/exchange/buy back — and is shipping safe/insured?","Is it a safe purchase from an unknown brand?"],
    ctaStyle: "Fashion jewelry: low friction 'Buy Now', 'Shop the collection'. Fine/high-ticket: 'Buy on EMI', 'Book a video viewing', secondary 'Chat with a jewelry expert on WhatsApp'.",
    urgencyCredibility: "Genuine limited/handcrafted editions and festive/gifting-occasion deadlines are credible. AVOID discount countdowns on fine jewelry — luxury shouldn't scream discount. Fashion jewelry can use modest real-stock signals.",
    trustSignals: ["BIS Hallmark (mandatory for gold in India), IGI/GIA diamond certificate","purity/assay certificate","insured & secure shipping","buyback / lifetime exchange","secure payment; certificate of authenticity"],
    copyTone: "Elegant, restrained, confident. Provenance and craftsmanship over hype. For fashion jewelry, playful and trend-aware. Never bargain-bin.",
    visualNotes: "Jewelry needs: hero on clean/luxe ground, on-body/scale, macro detail (stone, setting, hallmark), certificate, and packaging (gifting cue). Consistent premium lighting. Zoom is essential for perceived quality.",
    priceFraming: "Fine: transparent making charges + per-gram + no-cost EMI; frame as investment/heirloom. Fashion: bundles and modest offers. NEVER lead premium with deep discounts — use added value (free certification, insured shipping, gift box).",
    croCautions: ["Discount-shouting on luxury destroys brand equity and reads as counterfeit","fake urgency","opaque making charges (top fine-jewelry objection)","weak/absent certification for an unknown brand"],
    adPolicyNotes: "LOW policy risk, but Meta/Google restrict promotion of certain 'luxury goods' counterfeits and prohibit fake authenticity claims. Ensure hallmark/certification claims are truthful. Insured-shipping and buyback claims must be honoured (consumer-protection exposure).",
  },
  {
    domain: "saas",
    aliases: ["saas","software","app","apps","subscription","tool","tools","platform","b2b software","productivity","crm","api"],
    oneLine: "Buyers are deciding 'will this solve my specific problem, is it worth the switch/cost, and is my data safe' — it's a value/ROI + risk decision, not an impulse buy.",
    primaryGoal: "Start free trial (self-serve) or Book a demo (higher-ticket/B2B) — NOT 'Buy Now'. Match CTA friction to awareness. Note: this vertical bends the e-commerce block model — hero shows the product UI, offer-stack becomes pricing tiers, spec-table becomes a feature matrix, review-wall becomes testimonials/logos.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","review-wall","comparison-table","offer-stack","persona-cards","spec-table","faq-accordion"],
    heroEmphasis: "Clarity over cleverness: what it does, for whom, and the quantified outcome, plus a product screenshot/short demo. Audience-qualified headline lifts relevance for cold paid traffic (patterns.json headline_audience_qualified +15–30%; clever/wordplay headlines are an anti-pattern, -5 to -30%).",
    proofThatConverts: ["testimonial with name+photo+company+quantified result near the CTA (patterns.json testimonial_above_cta: median +30–35%)","quantified case studies / ROI","compliance badges as procurement gates (SOC 2 / ISO 27001 / GDPR)","segment-matched customer logos","usage-scale stat ('10,000+ teams')"],
    proofToAvoid: ["mismatched customer logos (DoWhatWorks: logos LOST in most A/B tests without segment match; can act as anti-proof)","generic/anonymized testimonials","vanity metrics with no outcome","aggressive consumer-style scarcity"],
    topObjections: ["Will it actually solve MY problem / work for my stack?","Is it worth the price vs what I use now?","How hard is it to set up / migrate?","Is my data secure and compliant?","Will I get locked in / can I cancel?"],
    ctaStyle: "Match to awareness: 'Start free trial' (self-serve), 'Book a demo' / 'Get a custom quote' (enterprise), 'See how it works' (secondary, low-commitment). Specific sticky-CTA copy beats 'Get Started' (patterns.json sticky_cta).",
    urgencyCredibility: "Consumer urgency mostly BACKFIRES here — countdown timers on B2B pricing are null/negative (patterns.json urgency_real_deadline_timer). Credible only: real onboarding-cohort slots, genuine annual-plan promo windows, beta caps. Prefer value-of-annual over urgency.",
    trustSignals: ["SOC 2 Type II / ISO 27001 / GDPR compliance","uptime SLA / security page","recognizable segment-matched logos","G2/Capterra ratings","'no credit card required' for trials"],
    copyTone: "Clear, specific, outcome-led, professional. Lead with the job-to-be-done and the number. No jargon soup; pass the 5-second clarity test.",
    visualNotes: "Show the actual product UI (annotated screenshots, short muted loop) — not abstract illustrations. Real dashboards with realistic data build credibility. Keep demo assets light for LCP.",
    priceFraming: "3 tiers, middle 'recommended' highlighted, outcome-based names (Starter/Growth/Scale). Annual-vs-monthly toggle emphasizing annual (retention +24pp; involuntary churn far lower — baselines.json). Free trial: CC-required converts trial→paid far higher but taxes signups (baselines).",
    croCautions: ["Clever/vague headlines that fail the clarity test","4+ pricing tiers (choice paralysis, patterns.json pricing_tier_proliferation)","consumer scarcity on infinite-capacity digital goods","logo walls without segment match","over-collecting on the trial signup form (field-count cliff)"],
    adPolicyNotes: "LOW. Standard claims-substantiation. Avoid deceptive 'free' when a card is required (be explicit). Data/privacy claims must be truthful (regulatory + platform risk). If handling sensitive categories (health/finance data), inherit those verticals' constraints.",
  },
  {
    domain: "finance",
    aliases: ["finance","fintech","insurance","investing","investment","loans","loan","credit","mutual funds","stocks","trading","banking","payments","tax","wealth"],
    oneLine: "Buyers are deciding 'is this legitimate/regulated, is my money and data safe, and what are the REAL terms' — trust and compliance dominate every other lever.",
    primaryGoal: "Lead-gen / qualification: 'Check eligibility', 'Get a free quote', 'Apply now', 'Start investing' — rarely a direct 'buy'. Keep the form short but capture qualification. Trust must be earned before the ask.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","product-narrative","comparison-table","review-wall","spec-table","persona-cards","faq-accordion"],
    heroEmphasis: "Lead with the concrete benefit stated in compliant, specific terms ('personal loans up to ₹5 lakh, interest from X% p.a., approval in 24h') + the regulatory/security marker (RBI-registered NBFC / IRDAI / SEBI, bank-grade encryption). Credibility IS the hero.",
    proofThatConverts: ["regulatory registration (RBI/NBFC number, IRDAI, SEBI, ISO 27001)","security proof (256-bit encryption, data protection)","scale/AUM/customers-served + years in business","named, credible testimonials","press/ratings/awards","transparent terms upfront"],
    proofToAvoid: ["guaranteed-returns claims (SEBI-prohibited for investments; instant disapproval)","fake urgency/scarcity (policy + trust landmine)","unverifiable 'India's #1'","fabricated testimonials (regulated-sector legal risk)"],
    topObjections: ["Is this legitimate and regulated / will I get scammed?","Is my money and personal data safe?","What are the hidden charges / real interest/fees?","Am I eligible and how long does it take?","Why should I trust an unknown brand with money?"],
    ctaStyle: "Low-friction lead capture with reassurance. 'Check your eligibility — free, no impact', 'Get my quote in 2 min', 'Apply now — secure'. Sublabels carry the trust ('No effect on credit score', 'RBI-registered').",
    urgencyCredibility: "Mostly AVOID. Real rate-valid-till or offer-end dates are the only credible urgency, and even then use sparingly. Manufactured urgency in finance is both a platform-policy violation and a trust destroyer.",
    trustSignals: ["RBI / NBFC / SEBI / IRDAI registration numbers","ISO 27001 / bank-grade encryption / data-protection compliance","secure-payment + recognized security seal (Norton/PayPal read as more trustworthy than obscure seals — Baymard)","insurer/lender partner logos","clear grievance/redressal + regulatory disclosures"],
    copyTone: "Trustworthy, precise, plain-language. Explain terms simply; never hype returns. Compliance language present but human. Transparency is persuasion here.",
    visualNotes: "Clean, credible, uncluttered — trust through design restraint. Show the product/app UI, security/regulatory badges, and real-person testimonials. Avoid stock 'money rain' imagery; it reads as scammy.",
    priceFraming: "Transparent APR/fees/premiums upfront (required). For loans, show representative example (amount, rate, tenure, EMI). For investing, show costs and mandatory risk disclosures. No 'free money' framing.",
    croCautions: ["Guaranteed/assured returns (SEBI-illegal + instant ad ban)","hidden charges revealed late","fake urgency/scarcity","missing regulatory disclosures","aggressive social-proof popups read as manipulation in a regulated context"],
    adPolicyNotes: "VERY HIGH — flag clearly. Google 'Financial products & services' policy REQUIRES disclosure of APR, fees, and full terms on the LP; personal loans/crypto often need certification. Meta 'Credit' is a Special Ad Category restricting targeting; financial-scam and misleading-claim rules are strict. India: RBI/SEBI/IRDAI advertising norms; SEBI bans guaranteed-return claims; mandatory risk disclosures ('mutual funds are subject to market risks'). Build LP with disclosures visible, not buried; never imply guaranteed outcomes.",
  },
  {
    domain: "education",
    aliases: ["education","courses","course","coaching","edtech","upskilling","training","bootcamp","certification","online learning","classes","tutoring","exam prep"],
    oneLine: "Buyers are deciding 'will this get me the OUTCOME (job/skill/score), is the teacher credible, and can I afford/finish it' — they're buying a future result, so outcome proof and credibility rule.",
    primaryGoal: "Enroll / Book a free counselling call / Attend a free demo class / Download syllabus — friction depends on ticket size. High-ticket programs convert via a call; low-ticket courses via direct enroll. EMI is decisive in India.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","product-narrative","review-wall","offer-stack","persona-cards","comparison-table","spec-table","faq-accordion"],
    heroEmphasis: "Lead with the outcome + credibility: 'Become a Data Analyst in 6 months — learn from ex-Google mentors', with a substantiable outcome hook (placement/skill) and instructor credentials. Curriculum and cohort dates support.",
    proofThatConverts: ["learner-outcome proof (placements, salary hikes, portfolios) — MUST be substantiable (ASCI/regulator scrutiny)","named learner testimonials with photo + specific result","instructor credentials / industry pedigree","curriculum depth + certification value","cohort/community proof","'X learners' scale"],
    proofToAvoid: ["unverifiable earnings/placement claims ('₹20L guaranteed' — ASCI + Meta/Google violation)","stock 'happy student' photos","vague 'transform your career' with no outcome data","anonymous testimonials"],
    topObjections: ["Will I actually get the outcome (job/skill/score)?","Is it worth the money and time?","Is the instructor/institute credible?","Will I be able to complete it / get support?","Can I afford it / is there EMI or a guarantee?"],
    ctaStyle: "Match to ticket: low-ticket 'Enroll now', 'Start free trial lesson'; high-ticket 'Book a free counselling call', 'Attend the free demo class', secondary 'Download syllabus'. Sublabels: 'EMI from ₹X/mo', 'Next batch starts Aug 5'.",
    urgencyCredibility: "GENUINELY credible: cohort/batch start dates, enrollment deadlines, scholarship/early-bird windows, limited seats per batch. These are real capacity constraints — among the most legitimate urgency in any vertical. Avoid perpetual fake countdowns.",
    trustSignals: ["placement/outcome stats (substantiated) + hiring-partner logos","instructor credentials / accreditation / affiliation","certification recognition","refund/job guarantee with clear terms","secure payment + no-cost EMI","learner reviews on external platforms"],
    copyTone: "Aspirational but grounded and mentor-like. Sell the transformation, prove the path. Respect the buyer's fear of wasting money/time.",
    visualNotes: "Education needs: instructor/mentor faces (credibility), curriculum snapshots, learner-outcome cards (before/after career), sample lesson/platform UI, and cohort/community shots. Real people over stock.",
    priceFraming: "No-cost EMI is the primary India lever; scholarship/early-bird framing; money-back or job guarantee to de-risk. Frame total cost against outcome value ('₹X now for a ₹Y salary jump'). Show monthly EMI prominently.",
    croCautions: ["Inflated/unverifiable placement or salary claims (ASCI edtech guidelines + Meta/Google 'unrealistic outcomes')","guaranteed-job language without honest terms","fake seat scarcity","hiding total cost behind EMI"],
    adPolicyNotes: "MEDIUM-HIGH. India: ASCI's edtech advertising guidelines (2022) crack down on misleading outcome/placement/earnings claims and require substantiation and clear disclaimers. Meta/Google prohibit unrealistic income/outcome promises. Keep placement stats defensible and dated, disclose guarantee terms, avoid 'guaranteed job/₹X salary' unless contractually backed.",
  },
  {
    domain: "health",
    aliases: ["health","clinic","clinics","medical","medical devices","telehealth","telemedicine","therapeutics","healthcare","doctor","diagnostics","hospital","treatment","therapy","dental","hair transplant","IVF"],
    oneLine: "Buyers are deciding 'is this safe, effective, and run by qualified/legitimate professionals, and is my privacy protected' — clinical trust and legitimacy dominate, under the strictest ad-policy regime of any vertical.",
    primaryGoal: "Book a consultation / Book a test / Start teleconsult / Request a callback — appointment/lead-gen, essentially never a hard product sale. Trust and credentials must precede the ask.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","product-narrative","review-wall","spec-table","persona-cards","comparison-table","faq-accordion"],
    heroEmphasis: "Lead with the service + clinical credibility + qualified people: 'Consult certified dermatologists online — reports in 24h', with accreditation and doctor credentials front and centre. Reassurance and legitimacy over persuasion.",
    proofThatConverts: ["doctor/clinician credentials + registrations (MCI/NMC reg. numbers)","accreditation (NABH hospitals, NABL labs in India)","real (consented, compliant) patient outcomes/testimonials","clinical evidence / study references","privacy/data-security assurance","volume ('50,000+ consultations')"],
    proofToAvoid: ["before/after imagery as ad-linked hero (major Meta/Google landmine for medical/body)","guaranteed-cure or exaggerated efficacy claims","fear-mongering ('you may have X — click now')","fake urgency on a health decision","unconsented patient photos"],
    topObjections: ["Is it safe and clinically effective?","Are the doctors/clinicians actually qualified and legitimate?","Is my health data private?","How much does it cost / is it covered?","Does this really work for my condition?"],
    ctaStyle: "Low-friction, reassuring, appointment-led. 'Book a free consultation', 'Talk to a doctor now', 'Book your test', secondary 'Request a callback'. Sublabels: 'Certified doctors', '100% confidential'. Never pushy.",
    urgencyCredibility: "Mostly AVOID — health decisions plus platform policy make urgency a liability. The only credible form is genuine appointment-slot availability. No countdowns, no manufactured scarcity, no fear-driven urgency.",
    trustSignals: ["clinician credentials + NMC/medical-council registration","NABH/NABL accreditation (India); LegitScript certification for telehealth/pharmacy on ad platforms","data-privacy/confidentiality (HIPAA-equivalent) assurance","clinical governance / partner hospitals","secure payment"],
    copyTone: "Calm, professional, empathetic, evidence-based. Inform and reassure; never alarm or over-promise. Careful, qualified language.",
    visualNotes: "Real doctors/clinicians and actual (or clearly labelled representative) facilities — credibility through authenticity. Clean, clinical, trustworthy design. AVOID before/after and graphic medical imagery as ad LP heroes; keep any such content off the ad-linked path.",
    priceFraming: "Transparent consultation/test/procedure pricing; insurance/EMI/package options where relevant. No discount-driven pressure on medical decisions. Package clarity ('consultation + report + follow-up').",
    croCautions: ["Before/after and exaggerated efficacy claims risk ad bans","fear-based copy triggers policy + erodes trust","implying diagnosis/cure without qualification","fake urgency on health services","non-consented or non-compliant patient content"],
    adPolicyNotes: "HIGHEST sensitivity — flag prominently. Meta restricts/prohibits: personal-health attributes, before/after imagery, misleading health claims, and prescription-drug promotion (requires certification); Google's Healthcare & Medicines policy restricts many categories and requires LegitScript certification for telehealth/pharmacy and some devices. India: Drugs & Magic Remedies Act (bans ads claiming cure for listed conditions), teleconsultation guidelines, ASCI. Keep the ad-linked LP claims-conservative, credential-forward, no before/after, no cure guarantees; verify certification before running ads.",
  },
  {
    domain: "baby_kids",
    aliases: ["baby","baby products","kids","children","toys","toy","kids apparel","children's clothing","infant","toddler","nursery","diapers","baby care","maternity"],
    oneLine: "Parents are deciding 'is it SAFE and non-toxic, is it right for my child's age/stage, and is the quality worth it' — safety and trust override price; the buyer is a protective, research-heavy parent.",
    primaryGoal: "Buy Now, with bundles/value-packs and subscription (diapers/wipes/consumables) as AOV and repeat levers. Age/stage self-selection reduces wrong-purchase returns.",
    recommendedFlowOrder: ["announcement-bar","hero-product","value-pillars","persona-cards","review-wall","offer-stack","product-narrative","spec-table","faq-accordion","collection-grid"],
    heroEmphasis: "Lead with SAFETY + age-appropriateness: 'BPA-free, non-toxic, dermatologically tested — for 6–12 months', with the safety certifications visible immediately. Emotional warmth (happy baby) + hard safety proof together.",
    proofThatConverts: ["safety certifications (non-toxic, BPA/phthalate-free, BIS/ISI, ASTM/CE, hypoallergenic, dermatologically tested)","parent reviews/UGC with real babies","pediatrician/expert endorsement","material transparency","age/stage suitability guidance","'trusted by X parents' scale"],
    proofToAvoid: ["fear-mongering health claims about babies (policy + ethics risk)","stock baby photos that feel inauthentic","unverified 'doctor recommended'","5.0 walls","anything implying a formula/health cure (see policy)"],
    topObjections: ["Is it genuinely safe and non-toxic for my baby?","Is it right for my child's age/stage/size?","Is the quality good and durable?","Is it worth the price?","How fast is delivery / can I return it?"],
    ctaStyle: "Low-medium friction, reassuring. 'Buy Now', 'Shop by age', 'Get the value pack'. Subscription for consumables: 'Never run out of diapers — subscribe & save'. Sublabels carry safety ('Non-toxic · COD available').",
    urgencyCredibility: "Modest and honest only. Age-stage relevance ('they grow fast — size up'), genuine restocks, and consumable-replenishment reminders are credible. Avoid aggressive fake scarcity — protective parents are especially trust-sensitive.",
    trustSignals: ["safety marks: BIS/ISI (India), ASTM/CE, non-toxic/BPA-free, hypoallergenic, dermatologically tested","OEKO-TEX / organic cotton for apparel","pediatrician-endorsed (if genuine)","secure payment + COD","easy returns"],
    copyTone: "Warm, reassuring, parent-to-parent. Empathetic to safety anxiety without exploiting it. Clear on age/stage and materials.",
    visualNotes: "Baby/kids need: product + safety-cert callouts, in-use with real happy babies/kids, material/close-up, age/size reference, and packaging. Soft, warm, trustworthy art direction. Authenticity beats studio-perfect.",
    priceFraming: "Value/multi-packs and bundles by stage; subscription for consumables (diapers, wipes, formula-adjacent — see policy). Frame as safety-worth-it, not cheapest. Rupee savings on packs.",
    croCautions: ["Exploitative fear-based safety copy","under-stating age/size guidance (drives returns)","weak/absent safety certification for an unknown brand","advertising infant milk substitutes/feeding bottles in India (legally prohibited — see policy)"],
    adPolicyNotes: "MEDIUM, with a hard landmine: India's IMS Act prohibits advertising/promotion of infant milk substitutes, feeding bottles, and infant foods (WHO Code) — do NOT build ad LPs promoting these. Meta/Google restrict some baby-health claims. Otherwise standard e-commerce compliance; avoid exaggerated health/safety claims and keep certifications truthful.",
  },
  {
    domain: "generic",
    aliases: ["*","other","misc","general","default","d2c","ecommerce","direct to consumer"],
    oneLine: "Buyers are deciding 'is this worth it, does it deliver what the ad promised, and can I trust this brand enough to pay' — the universal cold-traffic calculus of value, message-match, and trust.",
    primaryGoal: "Buy Now for products; Book a call / Start trial / WhatsApp order where the offer is a service or lead. Default to the single realistic action the ad implied; keep one primary path.",
    recommendedFlowOrder: ["announcement-bar","hero-product","urgency-strip","value-pillars","offer-stack","review-wall","product-narrative","persona-cards","comparison-table","spec-table","faq-accordion","collection-grid"],
    heroEmphasis: "Confirm the ad's promise instantly (message-match) and make the whole buying decision fit one screen: what it is, what it costs, what they save, who trusts it, how to buy. Lead with the primary benefit/outcome, not the mechanism.",
    proofThatConverts: ["reviews with a natural 4.2–4.7 spread (Spiegel Research Center: displaying reviews lifts purchase up to ~270%)","named testimonials with photos + specific results","UGC","aggregate scale ('X sold / X customers')","relevant certifications/guarantees"],
    proofToAvoid: ["generic/anonymized or stock-photo testimonials (actively erode trust)","mismatched customer logos (DoWhatWorks: often net-negative)","100% 5-star walls","any fabricated number"],
    topObjections: ["Is it worth the price?","Will it actually work / is it good quality?","Can I trust this (unknown) brand?","What if it's wrong — returns/refund?","How and when do I get it (COD, delivery)?"],
    ctaStyle: "Match friction to offer and awareness. Verb-first, specific, under ~20 chars: 'Buy Now', 'Start free trial', 'Book a call', 'Order on WhatsApp'. Sublabel carries the friction-killer ('COD available · Ships in 24h').",
    urgencyCredibility: "Use only real, believable urgency: genuine limited stock, a real campaign deadline, cohort/batch dates. At most one countdown per page. Manufactured/perpetual urgency risks going negative and damages LTV once detected (patterns.json urgency_manufactured_perpetual).",
    trustSignals: ["secure payment + recognized seal (Norton/PayPal outperform obscure seals — Baymard) or a simple in-house padlock (Baymard: homemade padlock beat several real SSL seals)","money-back / returns guarantee","COD + UPI marks (India)","relevant category certification","real customer count"],
    copyTone: "Clear, benefit-first, 5th–7th grade reading level, second person, active voice (NN/g readability). Indian English for India-first pages. Specific over clever.",
    visualNotes: "Product + in-use/lifestyle + detail + scale/label, in a fast-loading swipe gallery. First image is the LCP and must be light. Avoid autoplay hero video on mobile. Real alt text on every image (accessibility + ad-policy review).",
    priceFraming: "Rupee savings over percentages in India; bundles/multi-packs for AOV; per-unit or per-serving math where it clarifies value; no-cost EMI for higher tickets; subscription for consumables.",
    croCautions: ["Message mismatch between ad and LP (single largest cause of high-CPC/low-CVR)","no CTA reachable above the fold on mobile","fabricated proof/urgency","slow LCP","burying returns/COD/delivery answers"],
    adPolicyNotes: "LOW-MEDIUM baseline: accurate representation, truthful claims, real alt text, honoured guarantees, no fake urgency. If the specific product touches health, finance, weight-loss, or before/after imagery, escalate to those verticals' stricter rules before running ads.",
  },
];

/** The fallback used when a brief's domain matches no built-in profile. */
export const GENERIC_DOMAIN = "generic";

const BY_KEY = new Map<string, DomainProfile>();
for (const p of DOMAIN_PROFILES) {
  BY_KEY.set(p.domain.toLowerCase(), p);
  for (const alias of p.aliases) BY_KEY.set(alias.toLowerCase(), p);
}

const normalize = (value: string): string =>
  value.toLowerCase().trim().replace(/[_\s]+/g, " ");

/**
 * Resolves a free-text domain to a profile.
 *
 * Matching is: exact key/alias, then whole-word match either direction (so
 * "protein supplements" -> fitness). Anything unrecognised returns the generic profile —
 * never null, so the caller always has guidance.
 */
export function resolveDomain(input: string | undefined | null): DomainProfile {
  const generic = BY_KEY.get(GENERIC_DOMAIN)!;
  if (!input) return generic;

  const q = normalize(input);
  if (!q) return generic;

  const direct = BY_KEY.get(q);
  if (direct) return direct;

  const words = new Set(q.split(" ").filter(Boolean));
  for (const [key, profile] of BY_KEY) {
    if (profile.domain === GENERIC_DOMAIN) continue;
    const k = normalize(key);
    if (words.has(k)) return profile;
    const kw = k.split(" ").filter(Boolean);
    if (kw.length > 1 && kw.every((w) => words.has(w))) return profile;
  }
  for (const [key, profile] of BY_KEY) {
    if (profile.domain === GENERIC_DOMAIN) continue;
    const k = normalize(key);
    if (q.includes(k) || k.includes(q)) return profile;
  }

  return generic;
}

/** The canonical vertical list for the intake wizard (generic excluded — it is the fallback). */
export const DOMAIN_OPTIONS: { value: string; label: string }[] = DOMAIN_PROFILES
  .filter((p) => p.domain !== GENERIC_DOMAIN)
  .map((p) => ({ value: p.domain, label: p.domain }));

/**
 * Renders a profile as a prompt section. Kept here (not in prompt.ts) so the profile shape
 * and its rendering evolve together.
 */
export function renderDomainProfile(profile: DomainProfile): string {
  const list = (items: string[]): string =>
    items.length ? items.map((i) => `  - ${i}`).join("\n") : "  (none)";

  return [
    `VERTICAL: ${profile.domain}`,
    `What the buyer is deciding: ${profile.oneLine}`,
    `Realistic conversion goal:  ${profile.primaryGoal}`,
    "",
    `HERO MUST LEAD WITH: ${profile.heroEmphasis}`,
    "",
    "PROOF THAT CONVERTS HERE (most persuasive first — prioritise these blocks/content):",
    list(profile.proofThatConverts),
    "",
    "PROOF THAT IS WEAK OR BACKFIRES HERE (do not lean on these):",
    list(profile.proofToAvoid),
    "",
    "REAL OBJECTIONS TO ANSWER ABOVE THE FINAL CTA:",
    list(profile.topObjections),
    "",
    `CTA STYLE: ${profile.ctaStyle}`,
    `CREDIBLE URGENCY: ${profile.urgencyCredibility}`,
    "",
    "TRUST SIGNALS THAT MATTER IN THIS VERTICAL (use only those the brief can evidence):",
    list(profile.trustSignals),
    "",
    `COPY TONE:      ${profile.copyTone}`,
    `VISUAL/GALLERY: ${profile.visualNotes}`,
    `PRICE FRAMING:  ${profile.priceFraming}`,
    "",
    "VERTICAL CAUTIONS (anti-patterns specific to this vertical):",
    list(profile.croCautions),
    "",
    `AD-POLICY SENSITIVITY: ${profile.adPolicyNotes}`,
    "",
    "SUGGESTED FLOW ORDER for this vertical (a strong default — deviate only on a brief signal):",
    `  ${profile.recommendedFlowOrder.join(" -> ")}`,
  ].join("\n");
}
