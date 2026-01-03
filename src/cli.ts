#!/usr/bin/env node
/**
 * CLI for parakeet-coreml
 */

import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

import {
  areModelsDownloaded,
  downloadModels,
  downloadVadModel,
  getDefaultModelDir,
  getDefaultVadDir,
  isVadModelDownloaded
} from "./download.js"

import { ParakeetAsrEngine, isAvailable } from "./index.js"

const args = process.argv.slice(2)
const command = args[0]

function printHelp(): void {
  console.log(`
parakeet-coreml CLI

Commands:
  download [--force]  Download all models (~1.5GB)
  benchmark           Run performance benchmark
  status              Check if models are downloaded
  path                Print model directory path

Models are auto-downloaded on first use. Pre-download for
faster cold starts or offline environments.

Options:
  --force             Force re-download even if models exist
  --help, -h          Show this help message
`)
}

/**
 * Load WAV file as Float32Array (16-bit PCM to float)
 */
function loadWav(path: string): Float32Array {
  const buffer = readFileSync(path)
  const pcm16 = new Int16Array(buffer.buffer, 44) // Skip 44-byte header
  const samples = new Float32Array(pcm16.length)
  for (let i = 0; i < pcm16.length; i++) {
    samples[i] = (pcm16[i] ?? 0) / 32768.0
  }
  return samples
}

/**
 * Get chip name from system_profiler
 */
function getChipName(): string {
  try {
    const output = execSync("sysctl -n machdep.cpu.brand_string", { encoding: "utf-8" })
    return output.trim()
  } catch {
    return "Unknown"
  }
}

async function runBenchmark(): Promise<void> {
  if (!isAvailable()) {
    console.error("Benchmark requires macOS with Apple Silicon")
    process.exit(1)
  }

  // Find the benchmark audio file (works from dist/ or when running via npx)
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const possiblePaths = [
    join(__dirname, "../test/fixtures/brian-30s.wav"), // From dist/
    join(__dirname, "../../test/fixtures/brian-30s.wav"), // From node_modules
    join(process.cwd(), "test/fixtures/brian-30s.wav") // From repo root
  ]

  const audioPath = possiblePaths.find((p) => existsSync(p))

  if (!audioPath) {
    console.error("Benchmark audio file not found.")
    console.error("Run this command from the parakeet-coreml repository.")
    process.exit(1)
  }

  console.log("Parakeet CoreML Benchmark")
  console.log("=========================\n")

  const chip = getChipName()
  console.log(`Chip: ${chip}`)
  console.log(`Node: ${process.version}\n`)

  // Load audio
  console.log("Loading audio...")
  const samples = loadWav(audioPath)
  const audioDuration = samples.length / 16000

  console.log(`Audio: ${audioDuration.toFixed(1)}s (${samples.length.toLocaleString()} samples)\n`)

  // Initialize engine
  console.log("Initializing engine...")
  const engine = new ParakeetAsrEngine()

  const initStart = performance.now()
  await engine.initialize()
  const initTime = performance.now() - initStart

  console.log(`Init time: ${(initTime / 1000).toFixed(2)}s\n`)

  // Warm-up run
  console.log("Warm-up run...")
  await engine.transcribe(samples.slice(0, 16000 * 5)) // 5 seconds

  // Benchmark runs
  const runs = 3
  console.log(`\nBenchmark (${String(runs)} runs)...\n`)

  const times: number[] = []

  for (let i = 0; i < runs; i++) {
    const result = await engine.transcribe(samples)
    times.push(result.durationMs)
    console.log(`  Run ${String(i + 1)}: ${(result.durationMs / 1000).toFixed(3)}s`)
  }

  engine.cleanup()

  // Calculate stats
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length
  const rtf = avgTime / 1000 / audioDuration
  const speedup = 1 / rtf

  console.log("\n─────────────────────────────")
  console.log("Results")
  console.log("─────────────────────────────")
  console.log(`Audio duration:    ${audioDuration.toFixed(1)}s`)
  console.log(`Avg process time:  ${(avgTime / 1000).toFixed(3)}s`)
  console.log(`Real-time factor:  ${rtf.toFixed(4)}x`)
  console.log(`Speed:             ${speedup.toFixed(0)}x real-time`)
  console.log("")
  console.log(`→ 1 hour of audio in ~${(3600 / speedup).toFixed(0)} seconds`)
  console.log("─────────────────────────────\n")
}

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    printHelp()
    process.exit(0)
  }

  switch (command) {
    case "download": {
      const force = args.includes("--force")
      console.log("Parakeet CoreML Model Downloader")
      console.log("================================\n")

      try {
        console.log("Downloading ASR models...")
        console.log(`Target: ${getDefaultModelDir()}\n`)
        await downloadModels({ force })

        console.log("\nDownloading VAD model...")
        console.log(`Target: ${getDefaultVadDir()}\n`)
        await downloadVadModel({ force })

        console.log("\n✓ All models downloaded successfully!")
      } catch (error) {
        console.error("\n✗ Download failed:", error instanceof Error ? error.message : error)
        process.exit(1)
      }
      break
    }

    case "benchmark": {
      await runBenchmark()
      break
    }

    case "status": {
      const asrDownloaded = areModelsDownloaded()
      const vadDownloaded = isVadModelDownloaded()
      const allReady = asrDownloaded && vadDownloaded

      console.log("Parakeet CoreML Status")
      console.log("======================")
      console.log(`ASR models: ${asrDownloaded ? "✓ Ready" : "✗ Not downloaded"}`)
      console.log(`VAD model:  ${vadDownloaded ? "✓ Ready" : "✗ Not downloaded"}`)
      console.log("")
      console.log(`Status: ${allReady ? "✓ Ready to use" : "✗ Run 'npx parakeet-coreml download'"}`)
      break
    }

    case "path": {
      console.log(getDefaultModelDir())
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
