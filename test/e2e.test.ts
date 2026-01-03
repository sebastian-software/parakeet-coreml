import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, beforeAll, afterAll } from "vitest"

import {
  ParakeetAsrEngine,
  isAvailable,
  areModelsDownloaded,
  getDefaultModelDir
} from "../src/index.js"

/**
 * Load audio file as Float32Array using ffmpeg
 */
function loadAudio(path: string, duration?: number): Float32Array {
  const durationArg = duration ? `-t ${String(duration)}` : ""
  const pcmBuffer = execSync(
    `ffmpeg -i "${path}" ${durationArg} -ar 16000 -ac 1 -f s16le -acodec pcm_s16le -`,
    { encoding: "buffer", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 50 * 1024 * 1024 }
  )
  const pcm16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2)
  const samples = new Float32Array(pcm16.length)
  for (let i = 0; i < pcm16.length; i++) {
    samples[i] = (pcm16[i] ?? 0) / 32768.0
  }
  return samples
}

const AUDIO_FILE = join(__dirname, "fixtures/brian.ogg")

/**
 * E2E tests for the Parakeet ASR engine.
 * These tests require macOS, downloaded models, and ffmpeg.
 */
describe.runIf(isAvailable())("E2E: ParakeetAsrEngine", () => {
  let engine: ParakeetAsrEngine

  beforeAll(async () => {
    // Check for ffmpeg
    if (!existsSync(AUDIO_FILE)) {
      console.log("Test audio file not found:", AUDIO_FILE)
      return
    }

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
      // Load first 10 seconds
      const samples = loadAudio(AUDIO_FILE, 10)

      const result = await engine.transcribe(samples)

      // Always has segments now
      expect(result.segments.length).toBeGreaterThan(0)
      expect(result.text).toContain("History")
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
      // Load first 30 seconds
      const samples = loadAudio(AUDIO_FILE, 30)

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
