import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Two lockfiles exist on this machine (one in the user home, one here), so Next's
   * workspace-root inference picks the wrong directory and warns. Pin it.
   */
  turbopack: {
    root: path.resolve(__dirname),
  },

  images: {
    /**
     * PROTOTYPE SETTING — allow any https host.
     *
     * Generated pages reference whatever CDN the brand already uses (cdn.shopify.com,
     * Cloudinary, S3, the client's own domain), and a brief does not know that host
     * ahead of time. Enumerating hosts would mean a code change per campaign, which
     * defeats the point of a self-serve generator.
     *
     * Narrow this to the approved brand CDNs before anything ships publicly: an open
     * remote-image allowlist lets a third party serve arbitrary bytes through our own
     * optimizer endpoint.
     */
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
