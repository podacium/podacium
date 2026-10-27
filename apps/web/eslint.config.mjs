import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import security from "eslint-plugin-security";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  security.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "**/next-env.d.ts",
    ],
  },
  {
    rules: {
      // Legacy debt: 1400+ pre-existing occurrences (mostly API payload maps).
      // Kept visible as warnings so the lint gate can fail on everything else;
      // burn down per directory and flip back to "error" when it reaches zero.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
