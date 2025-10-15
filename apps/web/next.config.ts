import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export', // tells Next.js to generate a static site
  eslint: {
    ignoreDuringBuilds: true, // ignore ESLint errors
  },
  typescript: {
    ignoreBuildErrors: true, // ignore TS errors
  },
}

export default nextConfig

