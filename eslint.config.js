import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const layerRule = (patterns) => [
  "error",
  {
    patterns,
  },
];

export default tseslint.config(
  {
    ignores: ["dist/**", "src-tauri/target/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerRule([
        "**/app/**",
        "**/widgets/**",
        "**/features/**",
        "**/entities/**",
      ]),
    },
  },
  {
    files: ["src/entities/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerRule([
        "**/app/**",
        "**/widgets/**",
        "**/features/**",
        "**/entities/**",
      ]),
    },
  },
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerRule([
        "**/app/**",
        "**/widgets/**",
        "**/features/**",
      ]),
    },
  },
  {
    files: ["src/widgets/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerRule([
        "**/app/**",
        "**/widgets/**",
      ]),
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.api.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='invoke']",
          message: "Use a dedicated *.api.ts wrapper for Tauri invoke calls.",
        },
        {
          selector: "CallExpression[callee.name='spawn']",
          message: "Use a dedicated *.api.ts wrapper for PTY spawn calls.",
        },
        {
          selector: "CallExpression[callee.object.name='Database'][callee.property.name='load']",
          message: "Use a dedicated *.api.ts wrapper for database bootstrap and access.",
        },
      ],
    },
  },
  {
    files: ["src/**/*.presentational.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='useEffect']",
          message: "Presentational components cannot use useEffect.",
        },
        {
          selector: "CallExpression[callee.name='useLayoutEffect']",
          message: "Presentational components cannot use useLayoutEffect.",
        },
        {
          selector: "CallExpression[callee.name='useInsertionEffect']",
          message: "Presentational components cannot use useInsertionEffect.",
        },
        {
          selector:
            "CallExpression[callee.object.name='React'][callee.property.name='useEffect']",
          message: "Presentational components cannot use React.useEffect.",
        },
        {
          selector:
            "CallExpression[callee.object.name='React'][callee.property.name='useLayoutEffect']",
          message: "Presentational components cannot use React.useLayoutEffect.",
        },
        {
          selector:
            "CallExpression[callee.object.name='React'][callee.property.name='useInsertionEffect']",
          message: "Presentational components cannot use React.useInsertionEffect.",
        },
        {
          selector: "CallExpression[callee.name='invoke']",
          message: "Presentational components cannot call invoke.",
        },
        {
          selector: "CallExpression[callee.name='fetch']",
          message: "Presentational components cannot perform fetch requests.",
        },
        {
          selector: "CallExpression[callee.name='spawn']",
          message: "Presentational components cannot spawn PTY processes.",
        },
        {
          selector: "ImportDeclaration[source.value=/^@tauri-apps\\//]",
          message: "Presentational components cannot import Tauri APIs directly.",
        },
        {
          selector: "ImportDeclaration[source.value='tauri-pty']",
          message: "Presentational components cannot import PTY transport directly.",
        },
      ],
    },
  }
);
