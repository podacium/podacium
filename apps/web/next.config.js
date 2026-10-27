const path = require("path");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const isStandalone = process.env.STANDALONE === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [85],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "*.b-cdn.net",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "*.storage.googleapis.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/**",
      },
      {
        protocol: "https",
        hostname: "d2qgqs0mo0pjkv.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "backend-api.podacium.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "cdn.podacium.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "files.podacium.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "media.licdn.com",
        pathname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "**",
      },
    ],
  },
  eslint: {
    // Linting runs separately via npm run lint.
    dirs: ["src"],
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type checking is enforced in CI via `tsc --noEmit`
    tsconfigPath: "./tsconfig.json",
  },
  output: isStandalone ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname),
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{ kebabCase member }}",
    },
  },
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS
      ? parseInt(process.env.NEXT_BUILD_CPUS, 10)
      : undefined,
  },
  webpack: (config, { dev, isServer }) => {
    // Ensure production minification and tree-shaking are strictly enabled for production builds
    if (!dev) {
      config.optimization = config.optimization || {};
      config.optimization.minimize = true;

      // Enforce Core Web Vitals budgets on initial JS entrypoints while accounting for pre-Brotli chunk sizes
      if (!isServer) {
        config.performance = {
          hints: "warning",
          maxAssetSize: 2600000, // ~2.5 MB uncompressed limit for lazy-loaded vendor chunks (e.g., 3D/charts/Mux player)
          maxEntrypointSize: 1200000, // ~1.2 MB uncompressed (~280 KB Brotli) entrypoint budget
          assetFilter: (assetFilename) =>
            !assetFilename.endsWith(".map") &&
            !/\.(png|jpe?g|webp|avif|gif|svg|woff2?)$/i.test(assetFilename),
        };
      }
    }
    return config;
  },
  async rewrites() {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "https://backend-api.podacium.com";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/auth/login/",
        permanent: true,
      },
      {
        source: "/signup",
        destination: "/auth/signup/",
        permanent: true,
      },
      {
        source: "/learn/modules/:id*",
        destination: "/learn/courses/:id*",
        permanent: true,
      },
      {
        source: "/bi/organizations",
        destination: "/organizations/",
        permanent: true,
      },
      {
        source: "/bi/organizations/:path*",
        destination: "/organizations/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
