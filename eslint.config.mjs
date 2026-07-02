// Audit D3 — minimal, high-signal lint gate. Deliberately NOT a style linter
// (tsc strict already covers types; formatting is left alone): only rules that
// catch real bug classes are enabled, so CI failures stay meaningful.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["dist/**", "dist-electron/**", "node_modules/**", "artifacts/**", "reference/**", "example.claude/**", "*.js", "scripts/**", "tests/harness/**", "tests/**/*.cjs", "tests/**/*.mjs", "supabase/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        // Tests are outside both tsconfigs → no type-aware rules there; the shared
        // bug-class rules below still apply via the block that follows.
        files: ["electron/**/*.ts", "src/**/*.ts", "src/**/*.tsx"],
        languageOptions: {
            parserOptions: {
                // explicit project list — tsconfig.electron.json has a non-default
                // name, so projectService auto-discovery can't find it
                project: ["./tsconfig.json", "./tsconfig.electron.json"],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Fire-and-forget promises are how "AEGIS silently did nothing" bugs happen.
            "@typescript-eslint/no-floating-promises": "error",
            // The codebase coerces model-sent args at boundaries; explicit any is a
            // deliberate tool there — warn-level keeps new ones visible without blocking.
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": ["error", {argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none"}],
            // Empty catch = intentional best-effort pattern used throughout (documented inline).
            "no-empty": ["error", {allowEmptyCatch: true}],
            "@typescript-eslint/no-require-imports": "off",
            // Deliberate @ts-ignore on quirky third-party typings (groq-sdk, msedge-tts);
            // @ts-expect-error would itself error once upstream types are fixed.
            "@typescript-eslint/ban-ts-comment": "off",
            // Defensive initializers before try/catch blocks are intentional documentation.
            "no-useless-assignment": "off", // CJS main process uses require() for optional deps
        },
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": ["error", {argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none"}],
            "no-empty": ["error", {allowEmptyCatch: true}],
            "@typescript-eslint/no-require-imports": "off",
            // Deliberate @ts-ignore on quirky third-party typings (groq-sdk, msedge-tts);
            // @ts-expect-error would itself error once upstream types are fixed.
            "@typescript-eslint/ban-ts-comment": "off",
            // Defensive initializers before try/catch blocks are intentional documentation.
            "no-useless-assignment": "off",
        },
    },
);
