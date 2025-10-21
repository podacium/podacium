/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // enables static export
  eslint: {
    ignoreDuringBuilds: true, // ignore all ESLint errors during build
  },
};

module.exports = nextConfig;

