/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Source image URLs are referenced, not rehosted; allow any https source host
      // but keep this list narrow in production if you restrict to licensed sources.
      { protocol: "https", hostname: "**" },
    ],
  },
};
export default nextConfig;
