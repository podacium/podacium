const LHCI_CONFIG = {
  ci: {
    collect: {
      staticDistDir: ".next/server/pages",
      url: [
        "http://localhost/",
        "http://localhost/learn",
        "http://localhost/dashboard",
        "http://localhost/auth/login",
      ],
      numberOfRuns: 3,
    },
    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        "categories:performance": ["error", { minScore: 0.6 }],
        "categories:accessibility": ["error", { minScore: 0.85 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "first-contentful-paint": ["error", { maxNumericValue: 3000 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.25 }],
        "total-blocking-time": ["warn", { maxNumericValue: 500 }],
        "interaction-to-next-paint": ["warn", { maxNumericValue: 500 }],
        "server-response-time": ["error", { maxNumericValue: 1800 }],
        "csp-xss": "warn",
        "unused-javascript": "warn",
        "uses-responsive-images": "warn",
        "offscreen-images": "warn",
        "render-blocking-resources": "warn",
        "legacy-javascript": "warn",
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
    server: {
      port: 9001,
    },
  },
};

if (process.env.LHCI_TOKEN) {
  LHCI_CONFIG.ci.upload = {
    target: "lhci",
    serverBaseUrl: process.env.LHCI_SERVER_URL || "https://lhci.podacium.com",
    token: process.env.LHCI_TOKEN,
  };
}

module.exports = LHCI_CONFIG;
