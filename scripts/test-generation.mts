/**
 * Landing Agent — end-to-end generation + edit harness.
 *
 *   npx tsx scripts/test-generation.mts
 *
 * Exercises the real provider (whatever LLM_PROVIDER selects) against a realistic Indian D2C
 * brief, then runs a conversational edit over the result.
 *
 * THE ASSERTION THAT MATTERS is the last one: every block id present after generation must
 * still be present after the edit. The whole architecture — AI generates, human edits in Puck,
 * AI edits again — is lossless only because ids are stable addresses. `stickyCta.trigger.blockId`,
 * `persona.recommended.offerId`, anchor CTAs and `data-cta-id` analytics all point at them. If
 * this harness reports a lost id, the round-trip is broken regardless of how good the copy is.
 *
 * Exits non-zero on any failure, so it can gate a deploy.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { editPage } from "../src/lib/generate/edit";
import { PageGenerationError } from "../src/lib/generate/errors";
import { generatePage } from "../src/lib/generate/generate";
import { describeProvider } from "../src/lib/generate/provider";
import { type Brief, BriefSchema } from "../src/lib/schema/brief";
import { type Page, PageSchema } from "../src/lib/schema/page";

/* ────────────────────────────────────────────────────────────────────────────
   .env.local — Next loads this automatically, a bare tsx process does not.
   ──────────────────────────────────────────────────────────────────────────── */

function loadEnvLocal(): void {
  let contents: string;
  try {
    contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return; // No .env.local; rely on the ambient environment.
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // A real environment variable always wins over the file.
    if (key !== "" && process.env[key] === undefined) process.env[key] = value;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   The fixture brief — Kaaru, a Kanpur leather-goods brand running Meta cold traffic
   to WhatsApp. Prices in whole rupees; the generator converts to paise.
   ──────────────────────────────────────────────────────────────────────────── */

function buildBrief(): Brief {
  return BriefSchema.parse({
    brand: {
      name: "Kaaru Leather Co.",
      primaryColor: "#7A3B1F",
      accentColor: "#D9A441",
      tagline: "Full-grain leather, made in Kanpur since 1998",
    },
    product: {
      name: "Rani Full-Grain Leather Tote",
      description:
        "A hand-finished full-grain leather tote cut for the daily commute. Fits a 14-inch " +
        "laptop, a lunch box and a one-litre bottle, and still zips shut. The strap is 4.5 cm " +
        "wide so it does not dig into your shoulder on a crowded local. Vegetable-tanned in " +
        "Kanpur, so it darkens into your own patina over about a year. Rain-resistant finish, " +
        "cotton-canvas lining, one padded laptop sleeve and two zip pockets inside.",
      images: [
        {
          src: "/images/rani-tote-hero.webp",
          alt: "Tan full-grain leather tote standing upright, brass zip closed, on a desk",
        },
        {
          src: "/images/rani-tote-open.webp",
          alt: "Tote open showing a 14-inch laptop, a lunch box and a water bottle inside",
        },
        {
          src: "/images/rani-tote-strap.webp",
          alt: "Close-up of the 4.5 cm wide shoulder strap and hand-stitched edge",
        },
      ],
      price: 3499,
      compareAtPrice: 5999,
      currency: "INR",
      variants: [
        { group: "Colour", label: "Tan", shopifyVariantId: "4411", soldOut: false },
        { group: "Colour", label: "Espresso Brown", shopifyVariantId: "4412", soldOut: false },
        { group: "Colour", label: "Ink Black", shopifyVariantId: "4413", soldOut: true },
      ],
      specs: [
        { label: "Leather", value: "Full-grain, vegetable-tanned", group: "The basics" },
        { label: "Dimensions", value: "38 cm x 30 cm x 12 cm", group: "The basics" },
        { label: "Laptop fit", value: "Up to 14 inches, padded sleeve", group: "The basics" },
        { label: "Weight", value: "820 g", group: "The basics" },
        { label: "Hardware", value: "Solid brass, YKK zip", group: "Build" },
        { label: "Lining", value: "Cotton canvas", group: "Build" },
        { label: "Warranty", value: "24 months on stitching and hardware", group: "Build" },
        { label: "Made in", value: "Kanpur, Uttar Pradesh", group: "Build" },
      ],
      category: "Bags",
    },
    offer: {
      headline: "Flat 42% off the Rani Leather Tote",
      discount: "42% OFF",
      discountCode: "RANI42",
      terms: "Offer valid on prepaid and COD orders until stocks last.",
      freeShippingThreshold: 999,
      codAvailable: true,
      returnWindowDays: 14,
    },
    proof: {
      rating: 4.6,
      reviewCount: 1284,
      reviews: [
        {
          name: "Sneha Kulkarni",
          location: "Pune, Maharashtra",
          rating: 5,
          date: "2026-05-18",
          title: "Finally a bag that survives the local",
          body:
            "I take the Pune local twice a day and this is the first bag whose strap has not " +
            "frayed in six months. Laptop, tiffin and bottle all fit. The tan has darkened a " +
            "little and honestly it looks better now than when it arrived.",
          verified: true,
          variantPurchased: "Tan",
        },
        {
          name: "Arjun Menon",
          location: "Bengaluru, Karnataka",
          rating: 4,
          date: "2026-04-02",
          title: "Great leather, slightly heavy",
          body:
            "Leather quality is genuinely full-grain, you can smell it. Docked one star because " +
            "at 820 g it is heavier than my old canvas bag, so it takes a week to get used to. " +
            "COD was smooth and it reached Bengaluru in three days.",
          verified: true,
          variantPurchased: "Espresso Brown",
        },
        {
          name: "Fatima Sheikh",
          location: "Hyderabad, Telangana",
          rating: 5,
          date: "2026-06-11",
          title: "Worth every rupee",
          body:
            "Bought it for office and ended up using it for a Goa trip too. Zip is solid brass, " +
            "not the flimsy kind. My only regret is not ordering the black one before it went " +
            "out of stock.",
          verified: true,
          variantPurchased: "Tan",
        },
        {
          name: "Rohit Bansal",
          location: "Delhi NCR",
          rating: 3,
          date: "2026-03-27",
          title: "Good bag, delivery was slow",
          body:
            "No complaints about the tote itself, the stitching is neat and it holds shape. " +
            "But delivery took eight days to Gurugram against the four they mentioned. Support " +
            "did respond on WhatsApp within an hour, which helped.",
          verified: true,
          variantPurchased: "Tan",
        },
        {
          name: "Meera Iyer",
          location: "Chennai, Tamil Nadu",
          rating: 5,
          date: "2026-06-29",
          title: "Rain-tested and fine",
          body:
            "Got caught in a proper Chennai downpour on day three. Wiped it down, no water " +
            "marks, no smell. The padded laptop sleeve kept my MacBook dry. Very happy.",
          verified: true,
          variantPurchased: "Espresso Brown",
        },
      ],
      trustBadges: [
        { label: "COD available", sublabel: "All India" },
        { label: "14-day returns", sublabel: "No questions" },
        { label: "24-month warranty", sublabel: "Stitching & hardware" },
      ],
      claims: [
        "Vegetable-tanned full-grain leather from Kanpur",
        "Family-run tannery since 1998",
        "24-month warranty on stitching and hardware",
      ],
      certifications: ["Leather Working Group audited tannery"],
    },
    audience: {
      description:
        "Salaried women and men aged 25-40 in Indian metros who commute daily and carry a " +
        "laptop. They have owned two or three synthetic bags that fell apart within a year and " +
        "are now willing to pay more once — but they have never heard of this brand, so they " +
        "are sceptical about whether the leather is genuinely full-grain at this price.",
      personas: [
        {
          title: "You commute daily with a laptop",
          description:
            "Local train or metro, five days a week, laptop plus lunch. You need a bag that " +
            "holds shape and a strap that does not cut into your shoulder.",
          recommendedVariant: "Tan",
          painPoints: ["Straps fray in months", "Bag sags out of shape"],
        },
        {
          title: "You want one bag that lasts years",
          description:
            "You are done replacing a synthetic tote every season and would rather buy real " +
            "leather once, provided you can verify it is actually full-grain.",
          recommendedVariant: "Espresso Brown",
          painPoints: ["Fake 'genuine leather' claims", "No warranty on cheap bags"],
        },
      ],
      objections: [
        "Is this really full-grain leather or bonded leather at this price?",
        "Is Cash on Delivery available in my city?",
        "How many days will delivery take to a tier-2 pincode?",
        "Can I return it if the colour looks different from the photos?",
        "Will the strap hold up to a daily commute?",
      ],
      geoFocus: ["Mumbai", "Pune", "Bengaluru", "Hyderabad", "Delhi NCR", "Chennai"],
    },
    campaign: {
      adHeadline: "Flat 42% Off Full-Grain Leather Totes — Made in Kanpur",
      adBody:
        "Fits a 14-inch laptop. 24-month warranty. COD available all over India. Only until " +
        "stocks last.",
      keywords: ["full-grain leather tote", "leather laptop bag", "leather tote India"],
      destination: {
        kind: "whatsapp",
        phone: "919876543210",
        messageTemplate:
          "Hi Kaaru! I want to order the {{product}} ({{variant}}) at {{price}}. " +
          "Please confirm COD availability for my pincode.",
        businessName: "Kaaru Leather Co.",
      },
      platform: "meta",
      temperature: "cold",
      utmCampaign: "rani-tote-monsoon-42",
    },
    style: {
      personality: "premium-minimal",
      referenceNotes:
        "Warm, earthy and understated. Let the leather photography carry the page. Avoid " +
        "neon urgency banners and avoid stacking countdowns — this brand sells on craft and " +
        "longevity, not panic.",
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   Reporting helpers
   ──────────────────────────────────────────────────────────────────────────── */

const PASS = "PASS";
const FAIL = "FAIL";

let failed = false;

function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failed = true;
  console.log(`  [${ok ? PASS : FAIL}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function heading(text: string): void {
  console.log(`\n${"─".repeat(78)}\n${text}\n${"─".repeat(78)}`);
}

/** Prints a PageGenerationError's stage and the first 10 issue paths, then marks the run failed. */
function reportFailure(context: string, error: unknown): void {
  failed = true;
  console.log(`\n  [${FAIL}] ${context}`);

  if (error instanceof PageGenerationError) {
    console.log(`         stage:   ${error.stage}`);
    console.log(`         message: ${error.message}`);

    if (error.issues.length > 0) {
      console.log(`         issues:  ${error.issues.length} total, first 10:`);
      for (const issue of error.issues.slice(0, 10)) {
        console.log(`           - ${issue}`);
      }
    }
    return;
  }

  console.log(`         ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
}

const blockIds = (page: Page): string[] => page.blocks.map((block) => block.id);

/* ────────────────────────────────────────────────────────────────────────────
   Run
   ──────────────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  loadEnvLocal();

  const { provider, model, apiKeyEnvVar } = describeProvider();

  heading("Landing Agent — end-to-end generation harness");
  console.log(`  provider:  ${provider}`);
  console.log(`  model:     ${model}`);
  console.log(`  key:       ${process.env[apiKeyEnvVar] ? `${apiKeyEnvVar} present` : `${apiKeyEnvVar} MISSING`}`);

  const brief = buildBrief();
  console.log(`  brief:     ${brief.brand.name} / ${brief.product.name}`);
  console.log(
    `             ₹${brief.product.price} (was ₹${brief.product.compareAtPrice}), ` +
      `${brief.proof.reviews.length} reviews, destination ${brief.campaign.destination.kind}`,
  );

  /* ── Pass 1: generate ──────────────────────────────────────────────────── */

  heading("1. generatePage(brief)");

  const generateStartedAt = Date.now();
  let page: Page;
  try {
    page = await generatePage(brief);
  } catch (error) {
    reportFailure(`generatePage failed after ${Date.now() - generateStartedAt} ms`, error);
    process.exit(1);
  }
  const generateMs = Date.now() - generateStartedAt;

  console.log(`  wall clock: ${generateMs} ms (${(generateMs / 1000).toFixed(1)} s)`);

  // generatePage returns an already-validated Page, so this re-parse is a belt-and-braces
  // assertion that what it handed back really does satisfy the contract.
  const revalidated = PageSchema.safeParse(page);
  check("PageSchema validation", revalidated.success);
  if (!revalidated.success) {
    console.log(`         first 10 of ${revalidated.error.issues.length} issue(s):`);
    for (const issue of revalidated.error.issues.slice(0, 10)) {
      console.log(`           - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  }

  const originalIds = blockIds(page);
  const blockTypes = page.blocks.map((block) => block.type);

  console.log(`  block count: ${page.blocks.length}`);
  check("block count within 8-13", page.blocks.length >= 8 && page.blocks.length <= 13, `${page.blocks.length} blocks`);

  console.log("  block types:");
  page.blocks.forEach((block, index) => {
    console.log(`    ${String(index).padStart(2, " ")}  ${block.type.padEnd(20, " ")}  ${block.id}`);
  });

  const idlessBlocks = page.blocks.filter(
    (block) => typeof block.id !== "string" || block.id.trim().length === 0,
  );
  check(
    "every block has a non-empty stable id",
    idlessBlocks.length === 0,
    idlessBlocks.length === 0 ? `${originalIds.length} ids` : `${idlessBlocks.length} block(s) id-less`,
  );

  const uniqueIds = new Set(originalIds);
  check(
    "every block id is unique",
    uniqueIds.size === originalIds.length,
    `${uniqueIds.size} unique / ${originalIds.length} blocks`,
  );

  console.log(`  types produced: ${[...new Set(blockTypes)].join(", ")}`);

  /* ── Pass 2: edit ──────────────────────────────────────────────────────── */

  heading("2. editPage(page, ...) — the id-stability round-trip");

  const instruction =
    "Make the hero headline shorter and add a Cash on Delivery trust chip";
  console.log(`  instruction: "${instruction}"`);

  const editStartedAt = Date.now();
  let edited: Page;
  try {
    const editResult = await editPage(page, instruction);
    edited = editResult.page;
    console.log(`  routed to: ${editResult.model} (${editResult.complexity}${editResult.escalated ? ", escalated" : ""})`);
  } catch (error) {
    reportFailure(`editPage failed after ${Date.now() - editStartedAt} ms`, error);
    process.exit(1);
  }
  const editMs = Date.now() - editStartedAt;

  console.log(`  wall clock: ${editMs} ms (${(editMs / 1000).toFixed(1)} s)`);

  const survivingIds = new Set(blockIds(edited));
  const lostIds = originalIds.filter((id) => !survivingIds.has(id));

  check("edited page passes PageSchema", PageSchema.safeParse(edited).success);
  check(
    "page identity preserved (id + createdAt)",
    edited.id === page.id && edited.createdAt === page.createdAt,
  );

  // THE assertion. Everything else on this page can be regenerated; a lost id cannot.
  check(
    "ALL original block ids survived the edit",
    lostIds.length === 0,
    lostIds.length === 0
      ? `${originalIds.length}/${originalIds.length} preserved`
      : `LOST ${lostIds.length}/${originalIds.length}: ${lostIds.join(", ")}`,
  );

  const addedIds = [...survivingIds].filter((id) => !originalIds.includes(id));
  if (addedIds.length > 0) {
    console.log(`  note: ${addedIds.length} new block id(s) added by the edit: ${addedIds.join(", ")}`);
  }

  /* ── Summary ───────────────────────────────────────────────────────────── */

  heading(failed ? "RESULT: FAIL" : "RESULT: PASS");
  console.log(
    `  ${provider}/${model} · generate ${(generateMs / 1000).toFixed(1)}s · ` +
      `edit ${(editMs / 1000).toFixed(1)}s · ${page.blocks.length} blocks · ` +
      `${originalIds.length - lostIds.length}/${originalIds.length} ids preserved\n`,
  );

  if (failed) process.exit(1);
}

main().catch((error: unknown) => {
  reportFailure("Harness crashed", error);
  process.exit(1);
});
