import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A leading underscore marks a name as intentionally unused.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "coverage/**",
    "db/migrations/**",
    // Built docs (banana-docs, copied in before the OpenNext build): generated output.
    "public/docs/**",
    "next-env.d.ts",
    "cloudflare-env.d.ts",
  ]),
]);
