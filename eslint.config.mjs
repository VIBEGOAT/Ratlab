import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/dist-prof/**", "**/node_modules/**", "**/test-results/**", "**/playwright-report/**", "apps/web/public/**", "docs/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // the simulation uses non-null assertions on indexed arrays under noUncheckedIndexedAccess
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // diagnostic scripts: quick exploration code, node only
    files: ["scripts/**"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unused-vars": "off" },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
);
