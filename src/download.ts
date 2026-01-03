/**
 * Model download functionality for parakeet-coreml
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

// Parakeet ASR models
const PARAKEET_REPO = "FluidInference/parakeet-tdt-0.6b-v3-coreml"
const PARAKEET_API = `https://huggingface.co/api/models/${PARAKEET_REPO}`
const PARAKEET_DOWNLOAD = `https://huggingface.co/${PARAKEET_REPO}/resolve/main`

// Silero VAD model (CoreML version)
const VAD_REPO = "FluidInference/silero-vad-coreml"
const VAD_API = `https://huggingface.co/api/models/${VAD_REPO}`
const VAD_DOWNLOAD = `https://huggingface.co/${VAD_REPO}/resolve/main`
const VAD_MODEL_NAME = "silero-vad-unified-v6.0.0.mlmodelc"

/**
 * Default model directory in user's cache
 */
export function getDefaultModelDir(): string {
  return join(homedir(), ".cache", "parakeet-coreml", "models")
}

/**
 * Default VAD model directory
 */
export function getDefaultVadDir(): string {
  return join(homedir(), ".cache", "parakeet-coreml", "vad")
}

/**
 * Check if models are already downloaded
 */
export function areModelsDownloaded(modelDir?: string): boolean {
  const dir = modelDir ?? getDefaultModelDir()

  if (!existsSync(dir)) {
    return false
  }

  const encoderOptions = ["ParakeetEncoder_15s.mlmodelc", "Encoder.mlmodelc"]
  const decoderOptions = ["ParakeetDecoder.mlmodelc", "Decoder.mlmodelc"]
  const vocabOptions = ["parakeet_vocab.json", "parakeet_v3_vocab.json", "vocab.txt", "tokens.txt"]

  const hasEncoder = encoderOptions.some((f) => existsSync(join(dir, f)))
  const hasDecoder = decoderOptions.some((f) => existsSync(join(dir, f)))
  const hasJoint = existsSync(join(dir, "JointDecision.mlmodelc"))
  const hasVocab = vocabOptions.some((f) => existsSync(join(dir, f)))

  return hasEncoder && hasDecoder && hasJoint && hasVocab
}

/**
 * Check if VAD model is already downloaded
 */
export function isVadModelDownloaded(vadDir?: string): boolean {
  const dir = vadDir ?? getDefaultVadDir()
  const modelPath = join(dir, VAD_MODEL_NAME)
  return existsSync(modelPath)
}

interface TreeEntry {
  type: "file" | "directory"
  path: string
  size?: number
}

interface DownloadProgress {
  file: string
  current: number
  total: number
  percent: number
}

export interface DownloadOptions {
  /** Target directory for models (default: ~/.cache/parakeet-coreml/models) */
  modelDir?: string

  /** Progress callback */
  onProgress?: (progress: DownloadProgress) => void

  /** Force re-download even if models exist */
  force?: boolean
}

/* v8 ignore start - network I/O */
/**
 * Fetch file tree from Hugging Face
 */
async function fetchFileTree(apiBase: string, path = ""): Promise<TreeEntry[]> {
  const url = `${apiBase}/tree/main${path ? `/${path}` : ""}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch file tree: ${response.statusText}`)
  }

  return (await response.json()) as TreeEntry[]
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(apiBase: string, path = ""): Promise<TreeEntry[]> {
  const entries = await fetchFileTree(apiBase, path)
  const files: TreeEntry[] = []

  for (const entry of entries) {
    if (entry.type === "file") {
      files.push(entry)
    } else {
      // entry.type === "directory"
      const subFiles = await getAllFiles(apiBase, entry.path)
      files.push(...subFiles)
    }
  }

  return files
}

/* v8 ignore stop */

/* v8 ignore start - network I/O */
/**
 * Download a single file from Hugging Face
 */
async function downloadFile(
  downloadBase: string,
  filePath: string,
  destDir: string
): Promise<void> {
  const url = `${downloadBase}/${filePath}`
  const destPath = join(destDir, filePath)
  const destDirPath = dirname(destPath)

  mkdirSync(destDirPath, { recursive: true })

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${filePath}: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  writeFileSync(destPath, Buffer.from(buffer))
}

/* v8 ignore stop */

/**
 * Download Parakeet CoreML models from Hugging Face
 */
export async function downloadModels(options: DownloadOptions = {}): Promise<string> {
  const modelDir = options.modelDir ?? getDefaultModelDir()

  if (!options.force && areModelsDownloaded(modelDir)) {
    return modelDir
  }

  // Clean up partial downloads
  /* v8 ignore start - cleanup logic */
  if (existsSync(modelDir)) {
    rmSync(modelDir, { recursive: true })
  }
  mkdirSync(modelDir, { recursive: true })

  /* v8 ignore stop */

  /* v8 ignore start - network download loop */
  console.log("Fetching model file list from Hugging Face...")
  const files = await getAllFiles(PARAKEET_API)

  // Filter to only include required model files
  const modelFiles = files.filter(
    (f) =>
      f.path.endsWith(".mlmodelc") ||
      f.path.includes(".mlmodelc/") ||
      f.path === "parakeet_vocab.json" ||
      f.path === "parakeet_v3_vocab.json" ||
      f.path === "vocab.txt" ||
      f.path === "tokens.txt"
  )

  const totalSize = modelFiles.reduce((acc, f) => acc + (f.size ?? 0), 0)
  const totalCount = modelFiles.length

  console.log(`Downloading ${String(totalCount)} files (${formatBytes(totalSize)})...`)

  for (let i = 0; i < modelFiles.length; i++) {
    const file = modelFiles[i]
    if (!file) {
      continue
    }

    await downloadFile(PARAKEET_DOWNLOAD, file.path, modelDir)

    const current = i + 1
    const percent = Math.round((current / totalCount) * 100)

    if (options.onProgress) {
      options.onProgress({
        file: file.path,
        current,
        total: totalCount,
        percent
      })
    }

    // Simple progress indicator
    process.stdout.write(
      `\rProgress: ${String(percent)}% (${String(current)}/${String(totalCount)} files)`
    )
  }

  /* v8 ignore stop */

  // Convert JSON vocab to tokens.txt format (required by native addon)
  convertVocabToTokens(modelDir)

  console.log("\n✓ Models downloaded successfully!")
  return modelDir
}

export interface VadDownloadOptions {
  /** Target directory for VAD model (default: ~/.cache/parakeet-coreml/vad) */
  vadDir?: string

  /** Progress callback */
  onProgress?: (progress: DownloadProgress) => void

  /** Force re-download even if model exists */
  force?: boolean
}

/**
 * Download Silero VAD CoreML model from Hugging Face
 */
export async function downloadVadModel(options: VadDownloadOptions = {}): Promise<string> {
  const vadDir = options.vadDir ?? getDefaultVadDir()

  if (!options.force && isVadModelDownloaded(vadDir)) {
    return vadDir
  }

  // Clean up partial downloads
  /* v8 ignore start - cleanup logic */
  const modelPath = join(vadDir, VAD_MODEL_NAME)
  if (existsSync(modelPath)) {
    rmSync(modelPath, { recursive: true })
  }
  mkdirSync(vadDir, { recursive: true })

  /* v8 ignore stop */

  /* v8 ignore start - network download loop */
  console.log("Fetching VAD model file list from Hugging Face...")
  const files = await getAllFiles(VAD_API, VAD_MODEL_NAME)

  const totalSize = files.reduce((acc, f) => acc + (f.size ?? 0), 0)
  const totalCount = files.length

  console.log(`Downloading VAD model (${String(totalCount)} files, ${formatBytes(totalSize)})...`)

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file) {
      continue
    }

    await downloadFile(VAD_DOWNLOAD, file.path, vadDir)

    const current = i + 1
    const percent = Math.round((current / totalCount) * 100)

    if (options.onProgress) {
      options.onProgress({
        file: file.path,
        current,
        total: totalCount,
        percent
      })
    }

    process.stdout.write(
      `\rProgress: ${String(percent)}% (${String(current)}/${String(totalCount)} files)`
    )
  }

  /* v8 ignore stop */

  console.log("\n✓ VAD model downloaded successfully!")
  return vadDir
}

/**
 * Convert JSON vocabulary file to tokens.txt format
 * The native addon expects one token per line
 * @internal Exported for testing
 */
export function convertVocabToTokens(modelDir: string): void {
  const tokensPath = join(modelDir, "tokens.txt")

  // Skip if tokens.txt already exists
  if (existsSync(tokensPath)) {
    return
  }

  // Find the JSON vocab file
  const vocabFiles = ["parakeet_vocab.json", "parakeet_v3_vocab.json"]
  let vocabPath: string | null = null

  for (const file of vocabFiles) {
    const path = join(modelDir, file)
    if (existsSync(path)) {
      vocabPath = path
      break
    }
  }

  if (!vocabPath) {
    console.warn("Warning: No vocabulary file found to convert")
    return
  }

  console.log("Converting vocabulary to tokens.txt format...")

  const vocabJson = JSON.parse(readFileSync(vocabPath, "utf-8")) as Record<string, string>

  // Convert {index: token} to array sorted by index
  const maxIndex = Math.max(...Object.keys(vocabJson).map(Number))
  const tokens: string[] = new Array<string>(maxIndex + 1).fill("")

  for (const [index, token] of Object.entries(vocabJson)) {
    tokens[Number(index)] = token
  }

  // Write one token per line
  writeFileSync(tokensPath, tokens.join("\n"))
}

/**
 * Format bytes to human readable string
 * @internal Exported for testing
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
