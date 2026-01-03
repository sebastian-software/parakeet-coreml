/**
 * parakeet-coreml
 *
 * NVIDIA Parakeet TDT ASR for Node.js with CoreML/ANE acceleration on Apple Silicon.
 */

import { existsSync } from "node:fs"
import { join, resolve } from "node:path"

import {
  areModelsDownloaded,
  downloadModels,
  downloadVadModel,
  getDefaultModelDir,
  getDefaultVadDir,
  isVadModelDownloaded
} from "./download.js"

// Dynamic require for loading native addon (works in both ESM and CJS)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bindingsModule = require("bindings") as (name: string) => unknown

/**
 * Speech segment detected by VAD
 */
interface NativeSpeechSegment {
  startTime: number
  endTime: number
}

/**
 * VAD detection options
 */
interface NativeVadOptions {
  threshold?: number
  minSilenceDurationMs?: number
  minSpeechDurationMs?: number
}

/**
 * Native addon interface
 */
interface NativeAddon {
  // ASR functions
  initialize(modelDir: string): boolean
  isInitialized(): boolean
  transcribe(samples: Float32Array, sampleRate?: number): string
  transcribeFile(filePath: string): string
  cleanup(): void
  getVersion(): { addon: string; model: string; coreml: string }

  // VAD functions
  initializeVad(vadDir: string): boolean
  isVadInitialized(): boolean
  detectSpeechSegments(samples: Float32Array, options?: NativeVadOptions): NativeSpeechSegment[]
  cleanupVad(): void
}

/* v8 ignore start - platform checks and native addon loading */
/**
 * Load the native addon
 */
function loadAddon(): NativeAddon {
  if (process.platform !== "darwin") {
    throw new Error("parakeet-coreml is only supported on macOS")
  }

  try {
    return bindingsModule("coreml_asr") as NativeAddon
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to load Parakeet ASR native addon: ${message}`)
  }
}

/* v8 ignore stop */

let addon: NativeAddon | null = null

function getAddon(): NativeAddon {
  addon ??= loadAddon()
  return addon
}

/**
 * Speech segment with transcription
 */
export interface TranscribedSegment {
  startTime: number
  endTime: number
  text: string
}

/**
 * Transcription result
 */
export interface TranscriptionResult {
  text: string
  durationMs: number

  /**
   * Speech segments with timestamps.
   * Only present for long audio (>15s) that was automatically segmented.
   */
  segments?: TranscribedSegment[]
}

/**
 * Transcription options
 */
export interface TranscribeOptions {
  /**
   * Sample rate of the audio.
   * @default 16000
   */
  sampleRate?: number

  /**
   * Speech probability threshold for VAD (0-1).
   * Only used for long audio.
   * @default 0.5
   */
  vadThreshold?: number

  /**
   * Minimum silence duration to split segments (ms).
   * Only used for long audio.
   * @default 300
   */
  minSilenceDurationMs?: number

  /**
   * Minimum speech duration to keep (ms).
   * Only used for long audio.
   * @default 250
   */
  minSpeechDurationMs?: number
}

/**
 * ASR Engine options
 */
export interface AsrEngineOptions {
  /**
   * Path to the ASR model directory.
   * @default ~/.cache/parakeet-coreml/models
   */
  modelDir?: string

  /**
   * Path to the VAD model directory.
   * @default ~/.cache/parakeet-coreml/vad
   */
  vadDir?: string

  /**
   * Automatically download models if not present.
   * @default true
   */
  autoDownload?: boolean
}

/**
 * Maximum audio duration for a single transcription chunk (in samples at 16kHz)
 */
const MAX_CHUNK_SAMPLES = 15 * 16000

/**
 * Parakeet ASR Engine with CoreML/ANE acceleration.
 *
 * Supports audio of any length. For audio longer than 15 seconds,
 * Voice Activity Detection (VAD) is automatically used to segment
 * the audio at natural speech boundaries.
 */
export class ParakeetAsrEngine {
  private readonly modelDir: string
  private readonly vadDir: string
  private readonly autoDownload: boolean
  private initialized = false
  private vadInitialized = false

  constructor(options: AsrEngineOptions = {}) {
    this.modelDir = options.modelDir ? resolve(options.modelDir) : getDefaultModelDir()
    this.vadDir = options.vadDir ? resolve(options.vadDir) : getDefaultVadDir()
    this.autoDownload = options.autoDownload ?? true
  }

  /**
   * Initialize the ASR engine.
   * Downloads models automatically if not present and autoDownload is enabled.
   */
  async initialize(): Promise<void> {
    /* v8 ignore start - early return guard */
    if (this.initialized) {
      return
    }

    /* v8 ignore stop */

    // Check if models exist, download if needed
    if (!areModelsDownloaded(this.modelDir)) {
      /* v8 ignore start - auto-download and error paths */
      if (this.autoDownload) {
        console.log("Models not found. Downloading...")
        await downloadModels({ modelDir: this.modelDir })
      } else {
        throw new Error(
          `Models not found in ${this.modelDir}. ` +
            `Run "npx parakeet-coreml download" or enable autoDownload.`
        )
      }

      /* v8 ignore stop */
    }

    /* v8 ignore start - model validation requires real model files */
    if (!existsSync(this.modelDir)) {
      throw new Error(`Model directory not found: ${this.modelDir}`)
    }

    const alternativeEncoders = ["ParakeetEncoder_15s.mlmodelc", "Encoder.mlmodelc"]
    const alternativeDecoders = ["ParakeetDecoder.mlmodelc", "Decoder.mlmodelc"]

    const hasEncoder = alternativeEncoders.some((m) => existsSync(join(this.modelDir, m)))
    const hasDecoder = alternativeDecoders.some((m) => existsSync(join(this.modelDir, m)))
    const hasJoint = existsSync(join(this.modelDir, "JointDecision.mlmodelc"))

    if (!hasEncoder || !hasDecoder || !hasJoint) {
      throw new Error(
        `Missing required CoreML models in ${this.modelDir}. ` +
          `Expected: Encoder, Decoder, and JointDecision .mlmodelc directories`
      )
    }

    const vocabOptions = [
      "parakeet_vocab.json",
      "parakeet_v3_vocab.json",
      "vocab.txt",
      "tokens.txt"
    ]
    const hasVocab = vocabOptions.some((f) => existsSync(join(this.modelDir, f)))
    if (!hasVocab) {
      throw new Error(`Missing vocabulary file in ${this.modelDir}`)
    }

    const nativeAddon = getAddon()
    const success = nativeAddon.initialize(this.modelDir)

    if (!success) {
      throw new Error("Failed to initialize Parakeet ASR engine")
    }

    this.initialized = true

    /* v8 ignore stop */
  }

  /**
   * Initialize VAD engine (called automatically when needed for long audio).
   */
  private async ensureVadInitialized(): Promise<void> {
    if (this.vadInitialized) {
      return
    }

    // Download VAD model if needed
    if (!isVadModelDownloaded(this.vadDir)) {
      /* v8 ignore start - auto-download path */
      if (this.autoDownload) {
        console.log("VAD model not found. Downloading...")
        await downloadVadModel({ vadDir: this.vadDir })
      } else {
        throw new Error(
          `VAD model not found in ${this.vadDir}. ` +
            `Run "npx parakeet-coreml download-vad" or enable autoDownload.`
        )
      }

      /* v8 ignore stop */
    }

    /* v8 ignore start - native addon call */
    const success = getAddon().initializeVad(this.vadDir)
    if (!success) {
      throw new Error("Failed to initialize VAD engine")
    }

    /* v8 ignore stop */

    this.vadInitialized = true
  }

  isReady(): boolean {
    if (!this.initialized) {
      return false
    }
    return getAddon().isInitialized()
  }

  /* v8 ignore start - native addon calls, tested via E2E */

  /**
   * Transcribe audio of any length.
   *
   * For short audio (≤15s), transcription is immediate.
   * For long audio (>15s), VAD automatically segments at speech boundaries.
   *
   * @param samples Audio samples (16kHz, mono, Float32Array)
   * @param options Transcription options
   * @returns Transcription result (with segments for long audio)
   */
  async transcribe(
    samples: Float32Array,
    options: TranscribeOptions = {}
  ): Promise<TranscriptionResult> {
    if (!this.initialized) {
      throw new Error("ASR engine not initialized. Call initialize() first.")
    }

    const sampleRate = options.sampleRate ?? 16000
    const startTime = performance.now()

    // Short audio: direct transcription
    if (samples.length <= MAX_CHUNK_SAMPLES) {
      const text = getAddon().transcribe(samples, sampleRate)
      const durationMs = performance.now() - startTime
      return { text, durationMs }
    }

    // Long audio: use VAD for intelligent segmentation
    await this.ensureVadInitialized()

    const speechSegments = getAddon().detectSpeechSegments(samples, {
      threshold: options.vadThreshold ?? 0.5,
      minSilenceDurationMs: options.minSilenceDurationMs ?? 300,
      minSpeechDurationMs: options.minSpeechDurationMs ?? 250
    })

    const transcribedSegments: TranscribedSegment[] = []
    const textParts: string[] = []

    for (const segment of speechSegments) {
      const startSample = Math.floor(segment.startTime * sampleRate)
      const endSample = Math.min(Math.floor(segment.endTime * sampleRate), samples.length)
      const segmentSamples = samples.slice(startSample, endSample)

      // If segment is longer than 15s, split into chunks
      if (segmentSamples.length > MAX_CHUNK_SAMPLES) {
        let offset = 0
        while (offset < segmentSamples.length) {
          const chunkEnd = Math.min(offset + MAX_CHUNK_SAMPLES, segmentSamples.length)
          const chunk = segmentSamples.slice(offset, chunkEnd)

          const text = getAddon().transcribe(chunk, sampleRate)
          const chunkStartTime = segment.startTime + offset / sampleRate
          const chunkEndTime = segment.startTime + chunkEnd / sampleRate

          transcribedSegments.push({
            startTime: chunkStartTime,
            endTime: chunkEndTime,
            text
          })
          textParts.push(text)

          offset += MAX_CHUNK_SAMPLES
        }
      } else {
        const text = getAddon().transcribe(segmentSamples, sampleRate)
        transcribedSegments.push({
          startTime: segment.startTime,
          endTime: segment.endTime,
          text
        })
        textParts.push(text)
      }
    }

    const durationMs = performance.now() - startTime

    return {
      text: textParts.join(" "),
      segments: transcribedSegments,
      durationMs
    }
  }

  /**
   * @deprecated Use transcribe() with file loading instead
   */
  transcribeFile(filePath: string): TranscriptionResult {
    if (!this.initialized) {
      throw new Error("ASR engine not initialized. Call initialize() first.")
    }

    const startTime = performance.now()
    const text = getAddon().transcribeFile(resolve(filePath))
    const durationMs = performance.now() - startTime

    return { text, durationMs }
  }

  cleanup(): void {
    if (this.vadInitialized) {
      getAddon().cleanupVad()
      this.vadInitialized = false
    }
    if (this.initialized) {
      getAddon().cleanup()
      this.initialized = false
    }
  }

  getVersion(): { addon: string; model: string; coreml: string } {
    return getAddon().getVersion()
  }

  /* v8 ignore stop */
}

// Re-export download utilities for advanced use cases
export {
  areModelsDownloaded,
  downloadModels,
  downloadVadModel,
  getDefaultModelDir,
  getDefaultVadDir,
  isVadModelDownloaded
} from "./download.js"

/**
 * Check if parakeet-coreml is available on this platform.
 * Only macOS with Apple Silicon is supported.
 */
export function isAvailable(): boolean {
  return process.platform === "darwin"
}
