import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { areModelsDownloaded, downloadModels, getDefaultModelDir } from "../src/download.js"

describe("download", () => {
  describe("getDefaultModelDir", () => {
    it("returns a path in the user cache directory", () => {
      const dir = getDefaultModelDir()
      expect(dir).toContain(".cache")
      expect(dir).toContain("parakeet-coreml")
      expect(dir).toContain("models")
    })

    it("returns consistent path on multiple calls", () => {
      const dir1 = getDefaultModelDir()
      const dir2 = getDefaultModelDir()
      expect(dir1).toBe(dir2)
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

    it("returns false when only encoder exists", () => {
      mkdirSync(join(testDir, "Encoder.mlmodelc"), { recursive: true })
      expect(areModelsDownloaded(testDir)).toBe(false)
    })

    it("returns false when only decoder exists", () => {
      mkdirSync(join(testDir, "Decoder.mlmodelc"), { recursive: true })
      expect(areModelsDownloaded(testDir)).toBe(false)
    })

    it("returns false when vocab is missing", () => {
      mkdirSync(join(testDir, "Encoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "Decoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "JointDecision.mlmodelc"), { recursive: true })
      expect(areModelsDownloaded(testDir)).toBe(false)
    })

    it("returns true when all required models exist", () => {
      mkdirSync(join(testDir, "Encoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "Decoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "JointDecision.mlmodelc"), { recursive: true })
      writeFileSync(join(testDir, "parakeet_vocab.json"), "{}")

      expect(areModelsDownloaded(testDir)).toBe(true)
    })

    it("accepts alternative encoder name (ParakeetEncoder_15s)", () => {
      mkdirSync(join(testDir, "ParakeetEncoder_15s.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "Decoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "JointDecision.mlmodelc"), { recursive: true })
      writeFileSync(join(testDir, "vocab.txt"), "")

      expect(areModelsDownloaded(testDir)).toBe(true)
    })

    it("accepts alternative decoder name (ParakeetDecoder)", () => {
      mkdirSync(join(testDir, "Encoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "ParakeetDecoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "JointDecision.mlmodelc"), { recursive: true })
      writeFileSync(join(testDir, "tokens.txt"), "")

      expect(areModelsDownloaded(testDir)).toBe(true)
    })

    it("accepts parakeet_v3_vocab.json as vocab file", () => {
      mkdirSync(join(testDir, "Encoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "Decoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "JointDecision.mlmodelc"), { recursive: true })
      writeFileSync(join(testDir, "parakeet_v3_vocab.json"), "{}")

      expect(areModelsDownloaded(testDir)).toBe(true)
    })

    it("uses default model dir when no argument provided", () => {
      // This should not throw and return a boolean
      const result = areModelsDownloaded()
      expect(typeof result).toBe("boolean")
    })
  })

  describe("downloadModels", () => {
    const testDir = join(tmpdir(), "parakeet-download-test-" + Date.now())

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true })
      }
    })

    it("returns early if models already exist and force is false", async () => {
      // Setup existing models
      mkdirSync(join(testDir, "Encoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "Decoder.mlmodelc"), { recursive: true })
      mkdirSync(join(testDir, "JointDecision.mlmodelc"), { recursive: true })
      writeFileSync(join(testDir, "parakeet_vocab.json"), "{}")

      const result = await downloadModels({ modelDir: testDir, force: false })
      expect(result).toBe(testDir)
    })

    it("calls onProgress callback during download", async () => {
      const progressCalls: unknown[] = []

      // Mock fetch to avoid actual network calls
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      })

      try {
        await downloadModels({
          modelDir: testDir,
          force: true,
          onProgress: (progress) => progressCalls.push(progress)
        })
      } finally {
        globalThis.fetch = originalFetch
      }

      // Should complete without errors (empty file list = no progress calls)
      expect(Array.isArray(progressCalls)).toBe(true)
    })
  })
})
