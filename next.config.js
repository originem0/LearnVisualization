/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/learn',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
