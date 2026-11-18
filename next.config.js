/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve the app under /agent-inspector/ on the production server
  basePath: "/agent-inspector",
  // Rewrite all non-API, non-static requests through the app
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
