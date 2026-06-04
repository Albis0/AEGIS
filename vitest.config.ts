import {defineConfig} from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        benchmark: {
            include: ["tests/**/*.bench.ts"],
        },
        globals: false,
    },
    resolve: {
        alias: {
            electron: path.resolve(__dirname, "tests/__mocks__/electron.ts"),
        },
    },
});
