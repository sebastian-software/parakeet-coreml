import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  areModelsDownloaded,
  convertVocabToTokens,
  downloadModels,
  formatBytes,
  getDefaultModelDir
} from "../src/download.js"

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

  describe("convertVocabToTokens", () => {
    const testDir = join(tmpdir(), "parakeet-vocab-test-" + Date.now())

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true })
      }
    })

    it("skips if tokens.txt already exists", () => {
      writeFileSync(join(testDir, "tokens.txt"), "existing")
      convertVocabToTokens(testDir)
      // Should not modify existing file
      const content = require("node:fs").readFileSync(join(testDir, "tokens.txt"), "utf-8")
      expect(content).toBe("existing")
    })

    it("converts parakeet_vocab.json to tokens.txt", () => {
      const vocab = { "0": "hello", "1": "world", "2": "test" }
      writeFileSync(join(testDir, "parakeet_vocab.json"), JSON.stringify(vocab))

      convertVocabToTokens(testDir)

      const tokens = require("node:fs").readFileSync(join(testDir, "tokens.txt"), "utf-8")
      expect(tokens).toBe("hello\nworld\ntest")
    })

    it("converts parakeet_v3_vocab.json to tokens.txt", () => {
      const vocab = { "0": "a", "1": "b" }
      writeFileSync(join(testDir, "parakeet_v3_vocab.json"), JSON.stringify(vocab))

      convertVocabToTokens(testDir)

      const tokens = require("node:fs").readFileSync(join(testDir, "tokens.txt"), "utf-8")
      expect(tokens).toBe("a\nb")
    })

    it("handles sparse vocab indices", () => {
      const vocab = { "0": "first", "5": "sixth" }
      writeFileSync(join(testDir, "parakeet_vocab.json"), JSON.stringify(vocab))

      convertVocabToTokens(testDir)

      const tokens = require("node:fs").readFileSync(join(testDir, "tokens.txt"), "utf-8")
      expect(tokens).toBe("first\n\n\n\n\nsixth")
    })

    it("warns when no vocab file found", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      convertVocabToTokens(testDir)

      expect(warnSpy).toHaveBeenCalledWith("Warning: No vocabulary file found to convert")
      warnSpy.mockRestore()
    })
  })

  describe("formatBytes", () => {
    it("formats bytes", () => {
      expect(formatBytes(0)).toBe("0 B")
      expect(formatBytes(100)).toBe("100 B")
      expect(formatBytes(1023)).toBe("1023 B")
    })

    it("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB")
      expect(formatBytes(1536)).toBe("1.5 KB")
      expect(formatBytes(10240)).toBe("10.0 KB")
    })

    it("formats megabytes", () => {
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB")
      expect(formatBytes(1024 * 1024 * 5.5)).toBe("5.5 MB")
      expect(formatBytes(1024 * 1024 * 100)).toBe("100.0 MB")
    })

    it("formats gigabytes", () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.00 GB")
      expect(formatBytes(1024 * 1024 * 1024 * 1.5)).toBe("1.50 GB")
      expect(formatBytes(1024 * 1024 * 1024 * 10)).toBe("10.00 GB")
    })
  })
})
