import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["bindings"],
  // Shim require for ESM builds
  shims: true,
  // Suppress import.meta warning for CJS (we handle it with shims)
  esbuildOptions(options) {
    options.logOverride = {
      "empty-import-meta": "silent"
    }
  }
})
