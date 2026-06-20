// .eslintrc.cjs
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2021, sourceType: "module" },
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { browser: true, es2021: true, node: true },
  ignorePatterns: ["dist", "coverage", "*.cjs"],
  rules: { "@typescript-eslint/no-explicit-any": "warn" },
};
