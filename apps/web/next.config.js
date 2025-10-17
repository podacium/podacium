/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // Remove "experimental.appDir"
  // Keep webpack alias for src/app
  webpack(config) {
    const path = require('path');
    config.resolve.alias['@app'] = path.resolve(__dirname, 'src/app');
    return config;
  },

  // Recognize files under src/
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
};

module.exports = nextConfig;

