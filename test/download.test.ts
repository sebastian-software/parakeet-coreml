import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { areModelsDownloaded, getDefaultModelDir } from "../src/download.js"

describe("download", () => {
  describe("getDefaultModelDir", () => {
    it("returns a path in the user cache directory", () => {
      const dir = getDefaultModelDir()
      expect(dir).toContain(".cache")
      expect(dir).toContain("parakeet-coreml")
      expect(dir).toContain("models")
    })
  })

  describe("areModelsDownloaded", () => {
    const testDir = join(tmpdir(), "parakeet-test-" + Date.now())

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true })
      }
    })

    it("returns false for non-existent directory", () => {
      expect(areModelsDownloaded("/non/existent/path")).toBe(false)
    })

    it("returns false for empty directory", () => {
      expect(areModelsDownloaded(testDir)).toBe(false)
    })

    it("returns false when only some models exist", () => {
      mkdirSync(join(testDir, "Encoder.mlmodelc"), { recursive: true })
      expect(areModelsDownloaded(testDir)).toBe(false)
    })

    it("returns true when all required models exist", () => {
      // Create required model directories
      mkdirSync(join(testDir, "Encoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "Decoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "JointDecision.mlmodelc"), { recursive: true })
      writeFileSync(join(testDir, "parakeet_vocab.json"), "{}")

      expect(areModelsDownloaded(testDir)).toBe(true)
    })

    it("accepts alternative model names", () => {
      // Use alternative names
      mkdirSync(join(testDir, "ParakeetEncoder_15s.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "ParakeetDecoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "JointDecision.mlmodelc"), { recursive: true })
      writeFileSync(join(testDir, "vocab.txt"), "")

      expect(areModelsDownloaded(testDir)).toBe(true)
    })
  })
})
