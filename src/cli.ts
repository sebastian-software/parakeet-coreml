#!/usr/bin/env node
/**
 * CLI for parakeet-coreml
 */

import {
  areModelsDownloaded,
  downloadModels,
  downloadVadModel,
  getDefaultModelDir,
  getDefaultVadDir,
  isVadModelDownloaded
} from "./download.js"

const args = process.argv.slice(2)
const command = args[0]

function printHelp(): void {
  console.log(`
parakeet-coreml CLI

Commands:
  download [--force]      Download Parakeet ASR models from Hugging Face
  download-vad [--force]  Download Silero VAD model for long audio transcription
  download-all [--force]  Download both ASR and VAD models
  status                  Check if models are downloaded
  path                    Print the default model directory paths

Options:
  --force                 Force re-download even if models exist
  --help, -h              Show this help message
`)
}

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    printHelp()
    process.exit(0)
  }

  switch (command) {
    case "download": {
      const force = args.includes("--force")
      console.log("Parakeet ASR Model Downloader")
      console.log("=============================")
      console.log(`Target: ${getDefaultModelDir()}\n`)

      try {
        await downloadModels({ force })
      } catch (error) {
        console.error("\n✗ Download failed:", error instanceof Error ? error.message : error)
        process.exit(1)
      }
      break
    }

    case "download-vad": {
      const force = args.includes("--force")
      console.log("Silero VAD Model Downloader")
      console.log("===========================")
      console.log(`Target: ${getDefaultVadDir()}\n`)

      try {
        await downloadVadModel({ force })
      } catch (error) {
        console.error("\n✗ Download failed:", error instanceof Error ? error.message : error)
        process.exit(1)
      }
      break
    }

    case "download-all": {
      const force = args.includes("--force")
      console.log("Parakeet CoreML - Download All Models")
      console.log("=====================================\n")

      try {
        console.log("1. Downloading ASR models...")
        console.log(`   Target: ${getDefaultModelDir()}\n`)
        await downloadModels({ force })

        console.log("\n2. Downloading VAD model...")
        console.log(`   Target: ${getDefaultVadDir()}\n`)
        await downloadVadModel({ force })

        console.log("\n✓ All models downloaded successfully!")
      } catch (error) {
        console.error("\n✗ Download failed:", error instanceof Error ? error.message : error)
        process.exit(1)
      }
      break
    }

    case "status": {
      const modelDir = getDefaultModelDir()
      const vadDir = getDefaultVadDir()
      const asrDownloaded = areModelsDownloaded()
      const vadDownloaded = isVadModelDownloaded()

      console.log("Parakeet CoreML Status")
      console.log("======================")
      console.log(`ASR model directory: ${modelDir}`)
      console.log(`ASR models downloaded: ${asrDownloaded ? "✓ Yes" : "✗ No"}`)
      console.log("")
      console.log(`VAD model directory: ${vadDir}`)
      console.log(`VAD model downloaded: ${vadDownloaded ? "✓ Yes" : "✗ No"}`)

      if (!asrDownloaded || !vadDownloaded) {
        console.log('\nRun "npx parakeet-coreml download-all" to download all models.')
      }
      break
    }

    case "path": {
      console.log("ASR models:", getDefaultModelDir())
      console.log("VAD model: ", getDefaultVadDir())
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
