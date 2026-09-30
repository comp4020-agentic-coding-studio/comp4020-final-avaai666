import { configDefaults, defineConfig } from "vitest/config";

// Two projects. "unit" (spec/unit/) is pure logic and the store: it needs no
// running app, so it has no global setup. "app" is every other test in spec/,
// run against the running app, which spec/global-setup.ts finds. `pnpm test`
// runs both; `pnpm test:unit` runs only the first. A test outside spec/ needs
// adding to an `include`.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["spec/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "app",
          include: ["spec/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "spec/unit/**"],
          globalSetup: ["./spec/global-setup.ts"],
        },
      },
    ],
  },
});
