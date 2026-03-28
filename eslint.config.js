import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const browserGlobals = {
    console: "readonly",
    localStorage: "readonly",
    window: "readonly"
};

const nodeGlobals = {
    console: "readonly",
    process: "readonly"
};

export default tseslint.config(
    {
        ignores: [
            "coverage/**",
            "dist/**",
            "node_modules/**",
            ".yarn/**",
            "src/buildInfo.json"
        ]
    },
    {
        files: ["**/*.{js,mjs,cjs}"],
        ...js.configs.recommended,
        languageOptions: {
            ...js.configs.recommended.languageOptions,
            ecmaVersion: "latest",
            sourceType: "module",
            globals: nodeGlobals
        }
    },
    {
        files: ["src/**/*.{ts,tsx}"],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        plugins: {
            "react-hooks": reactHooks
        },
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                warnOnUnsupportedTypeScriptVersion: false,
                ecmaFeatures: {
                    jsx: true
                }
            },
            globals: browserGlobals
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "no-console": "off"
        }
    }
);

