import { configDefaults, defineConfig } from "vitest/config";

// Three projects. "unit" (spec/unit/) is pure logic and the store: it needs
// no running app, so it has no global setup. "unit-play" is the /play mode
// tests that play whole matches: they run after "unit" (groupOrder) and one
// file at a time, so they never starve the other unit tests of CPU. "app" is
// every other test in spec/, run against the running app, which
// spec/global-setup.ts finds. `pnpm test` runs all three; `pnpm test:unit`
// runs the first two. A test outside spec/ needs adding to an `include`.
const PLAY_UNIT = ["spec/unit/game-platform.test.ts", "spec/unit/rush.test.ts", "spec/unit/poach.test.ts", "spec/unit/party.test.ts", "spec/unit/hold.test.ts", "spec/unit/boat-hub.test.ts"];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["spec/unit/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...PLAY_UNIT],
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: "unit-play",
          include: PLAY_UNIT,
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
      {
        test: {
          name: "app",
          include: ["spec/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "spec/unit/**"],
          globalSetup: ["./spec/global-setup.ts"],
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});
