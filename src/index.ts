/**
 * parakeet-coreml
 *
 * NVIDIA Parakeet TDT ASR for Node.js with CoreML/ANE acceleration on Apple Silicon.
 */

import { existsSync } from "node:fs"
import { join, resolve } from "node:path"

import { areModelsDownloaded, downloadModels, getDefaultModelDir } from "./download.js"

// Dynamic require for loading native addon (works in both ESM and CJS)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bindingsModule = require("bindings") as (name: string) => unknown

/**
 * Native addon interface
 */
interface NativeAddon {
  initialize(modelDir: string): boolean
  isInitialized(): boolean
  transcribe(samples: Float32Array, sampleRate?: number): string
  transcribeFile(filePath: string): string
  cleanup(): void
  getVersion(): { addon: string; model: string; coreml: string }
}

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

let addon: NativeAddon | null = null

function getAddon(): NativeAddon {
  addon ??= loadAddon()
  return addon
}

/**
 * Transcription result
 */
export interface TranscriptionResult {
  text: string
  durationMs: number
}

/**
 * ASR Engine options
 */
export interface AsrEngineOptions {
  /**
   * Path to the model directory.
   * If not provided, uses the default cache directory (~/.cache/parakeet-coreml/models).
   */
  modelDir?: string

  /**
   * Automatically download models if not present.
   * @default true
   */
  autoDownload?: boolean
}

/**
 * Parakeet ASR Engine with CoreML/ANE acceleration
 */
export class ParakeetAsrEngine {
  private readonly modelDir: string
  private readonly autoDownload: boolean
  private initialized = false

  constructor(options: AsrEngineOptions = {}) {
    this.modelDir = options.modelDir ? resolve(options.modelDir) : getDefaultModelDir()
    this.autoDownload = options.autoDownload ?? true
  }

  /**
   * Initialize the ASR engine.
   * Downloads models automatically if not present and autoDownload is enabled.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Check if models exist, download if needed
    if (!areModelsDownloaded(this.modelDir)) {
      if (this.autoDownload) {
        console.log("Models not found. Downloading...")
        await downloadModels({ modelDir: this.modelDir })
      } else {
        throw new Error(
          `Models not found in ${this.modelDir}. ` +
            `Run "npx parakeet-coreml download" or enable autoDownload.`
        )
      }
    }

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
  }

  isReady(): boolean {
    if (!this.initialized) {
      return false
    }
    return getAddon().isInitialized()
  }

  transcribe(samples: Float32Array, sampleRate = 16000): TranscriptionResult {
    if (!this.initialized) {
      throw new Error("ASR engine not initialized. Call initialize() first.")
    }

    const startTime = performance.now()
    const text = getAddon().transcribe(samples, sampleRate)
    const durationMs = performance.now() - startTime

    return { text, durationMs }
  }

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
    if (this.initialized) {
      getAddon().cleanup()
      this.initialized = false
    }
  }

  getVersion(): { addon: string; model: string; coreml: string } {
    return getAddon().getVersion()
  }
}

// Re-export download utilities
export { areModelsDownloaded, downloadModels, getDefaultModelDir }

export function isAvailable(): boolean {
  return process.platform === "darwin"
}
