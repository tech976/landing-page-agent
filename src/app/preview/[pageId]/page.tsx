/**
 * Landing Agent — clean full-page preview.
 *
 * No editor chrome, no Puck, no toolbar. This is exactly what a visitor arriving from
 * a Meta or Google ad would see, rendered from the same `page.json` the editor writes
 * — which is the point of the whole architecture: preview is not an approximation of
 * production, it IS production, minus the publish flag.
 *
 * Server component. Reads straight from the JSON store on disk rather than round-
 * tripping through the API, so a draft is visible the instant it is saved.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PageRenderer from "@/components/PageRenderer";
import type { Page } from "@/lib/schema/page";
import { getPage } from "@/lib/store";

/** Drafts change constantly during an editing session — never serve a cached preview. */
export const dynamic = "force-dynamic";

interface PreviewRouteProps {
  params: Promise<{ pageId: string }>;
}

export async function generateMetadata({ params }: PreviewRouteProps): Promise<Metadata> {
  const { pageId } = await params;
  const page: Page | null = await getPage(pageId);

  if (!page) return { title: "Page not found" };

  const { meta } = page;

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords.length > 0 ? meta.keywords : undefined,
    // A preview URL must never be indexed, whatever the page's own noindex setting is.
    robots: { index: false, follow: false },
    openGraph: {
      title: meta.ogTitle ?? meta.title,
      description: meta.ogDescription ?? meta.description,
      images: meta.ogImage ? [{ url: meta.ogImage.src, alt: meta.ogImage.alt }] : undefined,
      locale: meta.locale,
      type: "website",
    },
  };
}

export default async function PreviewPage({ params }: PreviewRouteProps) {
  const { pageId } = await params;
  const page: Page | null = await getPage(pageId);

  if (!page) notFound();

  return <PageRenderer page={page} />;
}
