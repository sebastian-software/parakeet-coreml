import { describe, expect, it } from "vitest"

import { isAvailable } from "../src/index.js"

describe("index", () => {
  describe("isAvailable", () => {
    it("returns true on macOS", () => {
      // This test verifies the function works
      // The actual result depends on the platform running the test
      const result = isAvailable()
      expect(typeof result).toBe("boolean")

      if (process.platform === "darwin") {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })
  })
})
