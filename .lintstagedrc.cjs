/**
 * lint-staged configuration.
 *
 * Commands run from the repository root, but ESLint must run inside the
 * `apps/web` workspace (that is where its flat config, plugins and the
 * `@/` path alias live). lint-staged therefore hands us repo-relative paths
 * and we rewrite them to workspace-relative ones before invoking ESLint —
 * passing `apps/web/src/foo.tsx` into `apps/web` matches no files and used to
 * make the pre-commit lint silently pass.
 */
const path = require("node:path");

const WEB_ROOT = path.join(__dirname, "apps", "web");

module.exports = {
  "*.md": "prettier --check --write",
  "*.py": ["ruff check --fix", "ruff format"],
  "*.csv": [],
  "apps/web/**/*.{js,jsx,ts,tsx}": (files) => {
    const list = files
      .map((file) => `"${path.relative(WEB_ROOT, file)}"`)
      .join(" ");
    // A function task does not get the file list appended, and lint-staged
    // spawns commands without a shell, so the `cd` needs an explicit `bash -c`.
    return `bash -c 'cd apps/web && npx eslint ${list}'`;
  },
  "*.{js,jsx,ts,tsx}": "prettier --write",
};
