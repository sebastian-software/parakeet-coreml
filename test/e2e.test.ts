import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, beforeAll, afterAll } from "vitest"

import {
  ParakeetAsrEngine,
  isAvailable,
  areModelsDownloaded,
  getDefaultModelDir
} from "../src/index.js"

/**
 * Load WAV file as Float32Array (16-bit PCM to float)
 */
function loadWav(path: string): Float32Array {
  const buffer = readFileSync(path)
  const pcm16 = new Int16Array(buffer.buffer, 44) // Skip 44-byte header
  const samples = new Float32Array(pcm16.length)
  for (let i = 0; i < pcm16.length; i++) {
    samples[i] = pcm16[i] / 32768.0
  }
  return samples
}

/**
 * E2E tests for the Parakeet ASR engine.
 * These tests require macOS and downloaded models.
 */
describe.runIf(isAvailable())("E2E: ParakeetAsrEngine", () => {
  let engine: ParakeetAsrEngine

  beforeAll(async () => {
    // Skip if models not downloaded
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

    it("should detect no speech in silence", async () => {
      const samples = new Float32Array(16000 * 2) // 2s silence

      const result = await engine.transcribe(samples)

      expect(result.segments).toHaveLength(0)
      expect(result.text).toBe("")
      expect(result.durationMs).toBeGreaterThan(0)
    })

    it("should handle sine wave tone (no speech detected)", async () => {
      // Generate 1 second of 440Hz sine wave (A4 note)
      const sampleRate = 16000
      const frequency = 440
      const samples = new Float32Array(sampleRate)

      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.5
      }

      const result = await engine.transcribe(samples)

      // VAD should not detect pure tones as speech
      expect(result).toHaveProperty("text")
      expect(result).toHaveProperty("segments")
      expect(result.durationMs).toBeGreaterThan(0)
    })

    it("should transcribe short speech audio with timestamps", async () => {
      const samples = loadWav(join(__dirname, "fixtures/brian-10s.wav"))

      const result = await engine.transcribe(samples)

      // Always has segments now
      expect(result.segments.length).toBeGreaterThan(0)
      expect(result.text).toContain("History")
      expect(result.text).toContain("Urban")
      expect(result.text).toContain("Transportation")
      expect(result.durationMs).toBeGreaterThan(0)
      expect(result.durationMs).toBeLessThan(5000) // Should be fast

      // Check segment structure
      for (const segment of result.segments) {
        expect(segment).toHaveProperty("startTime")
        expect(segment).toHaveProperty("endTime")
        expect(segment).toHaveProperty("text")
        expect(segment.endTime).toBeGreaterThan(segment.startTime)
      }
    })

    it("should transcribe long speech audio with timestamps", async () => {
      const samples = loadWav(join(__dirname, "fixtures/brian-30s.wav"))

      const result = await engine.transcribe(samples)

      expect(result.segments.length).toBeGreaterThan(0)
      expect(result.text).toContain("Transportation")
      expect(result.durationMs).toBeGreaterThan(0)

      // Segments should be in order
      for (let i = 1; i < result.segments.length; i++) {
        expect(result.segments[i].startTime).toBeGreaterThanOrEqual(result.segments[i - 1].endTime)
      }
    })
  })
})
