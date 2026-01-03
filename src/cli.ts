#!/usr/bin/env node
/**
 * CLI for parakeet-coreml
 */

import { areModelsDownloaded, downloadModels, getDefaultModelDir } from "./download.js"

const args = process.argv.slice(2)
const command = args[0]

function printHelp(): void {
  console.log(`
parakeet-coreml CLI

Commands:
  download [--force]  Download CoreML models from Hugging Face
  status              Check if models are downloaded
  path                Print the default model directory path

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
      console.log("=================================")
      console.log(`Target: ${getDefaultModelDir()}\n`)

      try {
        await downloadModels({ force })
      } catch (error) {
        console.error("\n✗ Download failed:", error instanceof Error ? error.message : error)
        process.exit(1)
      }
      break
    }

    case "status": {
      const modelDir = getDefaultModelDir()
      const downloaded = areModelsDownloaded()

      console.log("Parakeet CoreML Status")
      console.log("======================")
      console.log(`Model directory: ${modelDir}`)
      console.log(`Models downloaded: ${downloaded ? "✓ Yes" : "✗ No"}`)

      if (!downloaded) {
        console.log('\nRun "npx parakeet-coreml download" to download models.')
      }
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
