/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Geist ships as an npm package that may need transpilation on Next < 15.
  transpilePackages: ["geist"]
};

export default nextConfig;
