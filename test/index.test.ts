import { describe, expect, it } from "vitest"

import {
  areModelsDownloaded,
  downloadModels,
  getDefaultModelDir,
  isAvailable,
  ParakeetAsrEngine
} from "../src/index.js"

describe("index", () => {
  describe("isAvailable", () => {
    it("returns true on macOS, false otherwise", () => {
      const result = isAvailable()
      expect(typeof result).toBe("boolean")

      if (process.platform === "darwin") {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })
  })

  describe("re-exports from download", () => {
    it("exports getDefaultModelDir", () => {
      expect(typeof getDefaultModelDir).toBe("function")
      const dir = getDefaultModelDir()
      expect(typeof dir).toBe("string")
      expect(dir).toContain("parakeet-coreml")
    })

    it("exports areModelsDownloaded", () => {
      expect(typeof areModelsDownloaded).toBe("function")
      const result = areModelsDownloaded("/non/existent")
      expect(result).toBe(false)
    })

    it("exports downloadModels", () => {
      expect(typeof downloadModels).toBe("function")
    })
  })

  describe("ParakeetAsrEngine", () => {
    it("can be instantiated with default options", () => {
      const engine = new ParakeetAsrEngine()
      expect(engine).toBeInstanceOf(ParakeetAsrEngine)
    })

    it("can be instantiated with custom modelDir", () => {
      const engine = new ParakeetAsrEngine({ modelDir: "/custom/path" })
      expect(engine).toBeInstanceOf(ParakeetAsrEngine)
    })

    it("can be instantiated with autoDownload disabled", () => {
      const engine = new ParakeetAsrEngine({ autoDownload: false })
      expect(engine).toBeInstanceOf(ParakeetAsrEngine)
    })

    it("isReady returns false before initialization", () => {
      const engine = new ParakeetAsrEngine()
      expect(engine.isReady()).toBe(false)
    })

    it("cleanup can be called before initialization without error", () => {
      const engine = new ParakeetAsrEngine()
      expect(() => engine.cleanup()).not.toThrow()
    })

    it("transcribe throws before initialization", () => {
      const engine = new ParakeetAsrEngine()
      const samples = new Float32Array(16000)
      expect(() => engine.transcribe(samples)).toThrow("not initialized")
    })

    // Platform-specific tests
    if (process.platform !== "darwin") {
      it("getVersion throws on non-macOS platforms", () => {
        const engine = new ParakeetAsrEngine()
        expect(() => engine.getVersion()).toThrow("only supported on macOS")
      })

      it("initialize throws on non-macOS when models missing", async () => {
        const engine = new ParakeetAsrEngine({
          modelDir: "/non/existent/path",
          autoDownload: false
        })
        await expect(engine.initialize()).rejects.toThrow()
      })
    }

    it("transcribeFile throws before initialization", () => {
      const engine = new ParakeetAsrEngine()
      expect(() => engine.transcribeFile("/some/file.wav")).toThrow("not initialized")
    })
  })
})
