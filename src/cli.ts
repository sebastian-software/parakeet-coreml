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
  download [--force]  Download all models (~1.5GB)
  status              Check if models are downloaded
  path                Print model directory paths

Models are auto-downloaded on first use. Pre-download for
faster cold starts or offline environments.

Options:
  --force             Force re-download even if models exist
  --help, -h          Show this help message
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
