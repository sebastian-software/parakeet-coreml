# parakeet-coreml

<p align="center">
  <img src="logo.svg" alt="parakeet-coreml" width="128" height="128">
</p>

<p align="center">
  <strong>Production-ready speech recognition for Node.js on Apple Silicon</strong>
</p>

<p align="center">
  <a href="https://github.com/sebastian-software/parakeet-coreml/actions/workflows/ci.yml"><img src="https://github.com/sebastian-software/parakeet-coreml/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/parakeet-coreml"><img src="https://img.shields.io/npm/v/parakeet-coreml.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/parakeet-coreml"><img src="https://img.shields.io/npm/dm/parakeet-coreml.svg" alt="npm downloads"></a>
  <a href="https://codecov.io/gh/sebastian-software/parakeet-coreml"><img src="https://codecov.io/gh/sebastian-software/parakeet-coreml/branch/main/graph/badge.svg" alt="codecov"></a>
  <br>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-20+-green.svg" alt="Node.js"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

Powered by NVIDIA's Parakeet model running on Apple's Neural Engine via CoreML.

## Why parakeet-coreml?

Modern Macs contain a powerful Neural Engine (ANE) – dedicated silicon for machine learning that often sits idle. This library puts it to work for speech recognition, delivering **real-time transcription without cloud dependencies**.

### The Problem with Alternatives

| Approach                             | Drawbacks                                                        |
| ------------------------------------ | ---------------------------------------------------------------- |
| **Cloud APIs** (OpenAI, Google, AWS) | Privacy concerns, ongoing costs, latency, requires internet      |
| **Whisper.cpp**                      | CPU-bound, significantly slower on Apple Silicon                 |
| **Python solutions**                 | Requires Python runtime, complex deployment, subprocess overhead |
| **Electron + subprocess**            | Memory overhead, IPC latency, complex architecture               |

### Our Solution

parakeet-coreml is a **native Node.js addon** that directly interfaces with CoreML. No Python. No subprocess. No cloud. Just fast, private speech recognition leveraging the full power of Apple Silicon.

## Features

- 🚀 **~110x real-time** – Transcribe 1 minute of audio in ~0.5 seconds (M4 Pro)
- 🍎 **Neural Engine Acceleration** – Runs on Apple's dedicated ML silicon, not CPU
- 🔒 **Fully Offline** – All processing happens locally. Your audio never leaves your device.
- 📦 **Zero Runtime Dependencies** – No Python, no subprocess, no external services
- 🌍 **Multilingual** – English and major European languages (German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Ukrainian, and more)
- ⬇️ **Automatic Setup** – Models download on first use. Just `npm install` and go.

## Performance

The Apple Neural Engine transforms speech recognition performance. While CPU-based solutions struggle to keep up with real-time audio, ANE acceleration delivers:

| Chip | Speed           | 1 Hour Audio In |
| ---- | --------------- | --------------- |
| M4   | ~100x real-time | ~36 seconds     |
| M3   | ~80x real-time  | ~45 seconds     |
| M2   | ~70x real-time  | ~51 seconds     |
| M1   | ~50x real-time  | ~72 seconds     |

All measurements with [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) – NVIDIA's state-of-the-art Transducer-based ASR achieving near-human accuracy. Pro/Max/Ultra variants may perform better due to additional Neural Engine cores.

## Use Cases

- **Meeting transcription** – Process recordings without uploading to third-party services
- **Podcast production** – Generate transcripts for show notes and accessibility
- **Voice interfaces** – Build voice-controlled applications with predictable latency
- **Content indexing** – Make audio/video content searchable
- **Accessibility tools** – Real-time captioning for the hearing impaired
- **Privacy-sensitive applications** – Healthcare, legal, finance – where data cannot leave the device

## Requirements

- macOS 14.0+ (Sonoma or later)
- Apple Silicon (M1, M2, M3, M4 – any variant)
- Node.js 20+

## Installation

```bash
npm install parakeet-coreml
```

The native addon compiles during installation. Xcode Command Line Tools are required.

## Quick Start

```typescript
import { ParakeetAsrEngine } from "parakeet-coreml"

const engine = new ParakeetAsrEngine()

// First run downloads ~1.5GB of models (cached for future use)
await engine.initialize()

// Transcribe audio (16kHz, mono, Float32Array)
const result = engine.transcribe(audioSamples, 16000)

console.log(result.text)
// "Hello, this is a test transcription."

console.log(`Processed in ${result.durationMs}ms`)

engine.cleanup()
```

That's it. No API keys. No configuration. No internet required after the initial model download.

## Audio Format

The engine expects raw audio samples in the following format:

| Property    | Requirement                                   |
| ----------- | --------------------------------------------- |
| Sample Rate | **16,000 Hz** (16 kHz)                        |
| Channels    | **Mono** (single channel)                     |
| Format      | **Float32Array** with values between -1.0–1.0 |
| Duration    | Up to **15 seconds** per call                 |

For longer audio, split into chunks and call `transcribe()` for each segment.

### Converting Audio Files

This library processes raw PCM samples, not audio files directly. You'll need to decode your audio files before transcription. Common approaches:

- **[ffmpeg](https://ffmpeg.org/)** – Convert any audio/video format to raw PCM
- **[node-wav](https://www.npmjs.com/package/node-wav)** – Parse WAV files in Node.js
- **Web Audio API** – Decode audio in browser/Electron environments

Example with ffmpeg (CLI):

```bash
ffmpeg -i input.mp3 -ar 16000 -ac 1 -f f32le output.pcm
```

Then load the raw PCM file:

```typescript
import { readFileSync } from "fs"

const buffer = readFileSync("output.pcm")
const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4)
```

## Model Management

Models are automatically downloaded to `~/.cache/parakeet-coreml/models` on first use.

### CLI Commands

```bash
# Pre-download models (useful for CI/deployment)
npx parakeet-coreml download

# Check if models are present
npx parakeet-coreml status

# Show cache location
npx parakeet-coreml path

# Force fresh download
npx parakeet-coreml download --force
```

### Custom Configuration

```typescript
// Use a custom model directory
const engine = new ParakeetAsrEngine({
  modelDir: "./my-models",
  autoDownload: true
})

// Disable auto-download (for controlled environments)
const engine = new ParakeetAsrEngine({
  autoDownload: false // Will throw if models not present
})
```

## API Reference

### `ParakeetAsrEngine`

The main class for speech recognition.

```typescript
new ParakeetAsrEngine(options?: AsrEngineOptions)
```

#### Options

| Option         | Type      | Default                           | Description                     |
| -------------- | --------- | --------------------------------- | ------------------------------- |
| `modelDir`     | `string`  | `~/.cache/parakeet-coreml/models` | Path to model directory         |
| `autoDownload` | `boolean` | `true`                            | Auto-download models if missing |

#### Methods

| Method                             | Description                          |
| ---------------------------------- | ------------------------------------ |
| `initialize()`                     | Load models (downloads if needed)    |
| `isReady()`                        | Check if engine is initialized       |
| `transcribe(samples, sampleRate?)` | Transcribe Float32Array audio (≤15s) |
| `cleanup()`                        | Release native resources             |
| `getVersion()`                     | Get version information              |

### `TranscriptionResult`

```typescript
interface TranscriptionResult {
  text: string // The transcribed text
  durationMs: number // Processing time in milliseconds
}
```

### Helper Functions

| Function                    | Description                            |
| --------------------------- | -------------------------------------- |
| `isAvailable()`             | Check if running on supported platform |
| `getDefaultModelDir()`      | Get default model cache path           |
| `areModelsDownloaded(dir?)` | Check if models are present            |
| `downloadModels(options?)`  | Manually trigger model download        |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Node.js App                     │
├─────────────────────────────────────────────────────────┤
│                  parakeet-coreml API                    │  TypeScript
├─────────────────────────────────────────────────────────┤
│                    Native Addon                         │  N-API + Objective-C++
├─────────────────────────────────────────────────────────┤
│                      CoreML                             │  Apple Framework
├─────────────────────────────────────────────────────────┤
│                 Apple Neural Engine                     │  Dedicated ML Silicon
└─────────────────────────────────────────────────────────┘
```

The library bridges Node.js directly to Apple's CoreML framework via a native N-API addon written in Objective-C++. This eliminates the overhead of subprocess communication or Python interop, resulting in minimal latency and efficient memory usage.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Development setup
- Code style guidelines
- Pull request process

## License

MIT – see [LICENSE](LICENSE) for details.

## Credits

- [NVIDIA Parakeet TDT v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) – The underlying ASR model
- [FluidInference](https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml) – CoreML model conversion

---

Copyright © 2026 [Sebastian Software GmbH](https://sebastian-software.de), Mainz, Germany
