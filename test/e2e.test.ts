import { describe, expect, it, beforeAll, afterAll } from "vitest"

import {
  ParakeetAsrEngine,
  isAvailable,
  areModelsDownloaded,
  getDefaultModelDir
} from "../src/index.js"

/**
 * E2E tests for the Parakeet ASR engine.
 * These tests require macOS and downloaded models.
 */
describe.runIf(isAvailable())("E2E: ParakeetAsrEngine", () => {
  let engine: ParakeetAsrEngine

  beforeAll(async () => {
    // Skip if models not downloaded (they're ~6GB)
    if (!areModelsDownloaded()) {
      console.log(`Models not found at ${getDefaultModelDir()}`)
      console.log('Run "pnpm parakeet-coreml download" to enable E2E tests')
      return
    }

    engine = new ParakeetAsrEngine({ autoDownload: false })
    await engine.initialize()
  }, 60000) // 60s timeout for initialization

  afterAll(() => {
    engine?.cleanup()
  })

  it("should load the native addon on macOS", () => {
    expect(isAvailable()).toBe(true)
  })

  describe.runIf(areModelsDownloaded())("with models", () => {
    it("should initialize the engine", () => {
      expect(engine.isReady()).toBe(true)
    })

    it("should return version info", () => {
      const version = engine.getVersion()
      expect(version).toHaveProperty("addon")
      expect(version).toHaveProperty("model")
      expect(version).toHaveProperty("coreml")
    })

    it("should transcribe silence to empty or minimal text", () => {
      // Generate 1 second of silence at 16kHz
      const sampleRate = 16000
      const duration = 1
      const samples = new Float32Array(sampleRate * duration)

      const result = engine.transcribe(samples, sampleRate)

      expect(result).toHaveProperty("text")
      expect(result).toHaveProperty("durationMs")
      expect(typeof result.text).toBe("string")
      expect(result.durationMs).toBeGreaterThan(0)
    })

    it("should transcribe a sine wave tone", () => {
      // Generate 1 second of 440Hz sine wave (A4 note)
      const sampleRate = 16000
      const duration = 1
      const frequency = 440
      const samples = new Float32Array(sampleRate * duration)

      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.5
      }

      const result = engine.transcribe(samples, sampleRate)

      expect(result).toHaveProperty("text")
      expect(result).toHaveProperty("durationMs")
      expect(result.durationMs).toBeGreaterThan(0)
      // A tone shouldn't produce meaningful speech, but the engine should handle it
    })

    it("should handle longer audio segments", () => {
      // Generate 5 seconds of silence
      const sampleRate = 16000
      const duration = 5
      const samples = new Float32Array(sampleRate * duration)

      const result = engine.transcribe(samples, sampleRate)

      expect(result).toHaveProperty("text")
      expect(result.durationMs).toBeGreaterThan(0)
    })
  })
})
