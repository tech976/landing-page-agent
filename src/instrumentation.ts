/**
 * Next.js instrumentation hook — runs once per server process, before any request.
 *
 * Used here purely to seed the example page. The seeding module touches node:fs, so it is
 * imported lazily and only on the Node.js runtime: this file is also evaluated for the
 * Edge runtime, where node:fs does not exist and a static import would fail the build.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { seedExamplePage } = await import("@/lib/seed");
  await seedExamplePage();
}
