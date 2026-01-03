# parakeet-coreml

[![CI](https://github.com/sebastian-software/parakeet-coreml/actions/workflows/ci.yml/badge.svg)](https://github.com/sebastian-software/parakeet-coreml/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/parakeet-coreml.svg)](https://www.npmjs.com/package/parakeet-coreml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

NVIDIA Parakeet TDT ASR for Node.js with **CoreML/ANE acceleration** on Apple Silicon.

Fast, accurate, and fully offline speech recognition using the [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) model.

## Features

- 🚀 **~110x real-time** - Transcribe 1 minute of audio in ~0.5 seconds (M4 Pro)
- 🍎 **Apple Neural Engine** - Hardware-accelerated via CoreML
- 🌍 **Multilingual** - Major European languages supported
- 🔒 **Fully offline** - No data leaves your device
- 📦 **Native Node.js addon** - No Python, no subprocess
- ⬇️ **Automatic model download** - Models are fetched on first use

## Requirements

- macOS 14.0+
- Apple Silicon (M1/M2/M3/M4)
- Node.js 20+

## Installation

```bash
npm install parakeet-coreml
```

## Quick Start

```typescript
import { ParakeetAsrEngine } from "parakeet-coreml"

// Create engine (models download automatically on first use)
const engine = new ParakeetAsrEngine()

// Initialize (downloads ~6GB models if not cached)
await engine.initialize()

// Transcribe audio (16kHz, mono, Float32)
const result = engine.transcribe(audioSamples, 16000)

console.log(result.text)
// "Hello, this is a test transcription."

engine.cleanup()
```

That's it! No manual model download required.

## Model Management

Models are automatically downloaded to `~/.cache/parakeet-coreml/models` on first use.

### CLI Commands

```bash
# Download models manually (optional)
npx parakeet-coreml download

# Check download status
npx parakeet-coreml status

# Show model directory path
npx parakeet-coreml path

# Force re-download
npx parakeet-coreml download --force
```

### Custom Model Directory

```typescript
const engine = new ParakeetAsrEngine({
  modelDir: "./my-models", // Custom path
  autoDownload: true // Download to custom path if missing
})
```

### Disable Auto-Download

For CI/CD or controlled environments:

```typescript
const engine = new ParakeetAsrEngine({
  autoDownload: false // Fail if models not present
})
```

## API

### `ParakeetAsrEngine`

```typescript
new ParakeetAsrEngine(options?: AsrEngineOptions)
```

#### Options

| Option         | Type      | Default                           | Description                     |
| -------------- | --------- | --------------------------------- | ------------------------------- |
| `modelDir`     | `string`  | `~/.cache/parakeet-coreml/models` | Path to model directory         |
| `autoDownload` | `boolean` | `true`                            | Auto-download models if missing |

#### Methods

| Method                             | Description                       |
| ---------------------------------- | --------------------------------- |
| `initialize()`                     | Load models (downloads if needed) |
| `isReady()`                        | Check if ready                    |
| `transcribe(samples, sampleRate?)` | Transcribe audio                  |
| `transcribeFile(filePath)`         | Transcribe file                   |
| `cleanup()`                        | Release resources                 |
| `getVersion()`                     | Get version info                  |

### `TranscriptionResult`

```typescript
interface TranscriptionResult {
  text: string // Transcribed text
  durationMs: number // Processing time
}
```

### Helper Functions

| Function                    | Description                     |
| --------------------------- | ------------------------------- |
| `isAvailable()`             | Check if platform is supported  |
| `getDefaultModelDir()`      | Get default model cache path    |
| `areModelsDownloaded(dir?)` | Check if models exist           |
| `downloadModels(options?)`  | Manually trigger model download |

## Performance

| Device | Speed             | Notes           |
| ------ | ----------------- | --------------- |
| M4 Pro | ~110x real-time   | ANE accelerated |
| M1     | ~50-70x real-time | ANE accelerated |

## Architecture

```
┌─────────────────┐
│   Node.js API   │  TypeScript
├─────────────────┤
│  Native Addon   │  N-API + Objective-C++
├─────────────────┤
│    CoreML       │  Apple Neural Engine
└─────────────────┘
```

## License

MIT

## Credits

- [NVIDIA Parakeet TDT v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) - Base model
- [FluidInference](https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml) - CoreML conversion
