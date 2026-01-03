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
- 🎯 **Smart Voice Detection** – Built-in VAD automatically segments long recordings
- 🌍 **Multilingual** – English and major European languages (German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Ukrainian, and more)
- ⬇️ **Automatic Setup** – Models download on first use. Just `npm install` and go.

## Performance

The Apple Neural Engine delivers exceptional speech recognition performance:

**Measured: M1 Ultra**

```
5 minutes of audio → 7.7 seconds
Speed: 40x real-time
1 hour of audio in ~90 seconds
```

Run your own benchmark:

```bash
git clone https://github.com/sebastian-software/parakeet-coreml
cd parakeet-coreml && pnpm install && pnpm benchmark
```

### Estimated Performance by Chip

Based on Neural Engine TOPS (tera operations per second):

| Chip     | ANE TOPS | Estimated Speed    |
| -------- | -------- | ------------------ |
| M4 Pro   | 38       | ~70x real-time     |
| M3 Pro   | 18       | ~35x real-time     |
| M2 Pro   | 15.8     | ~30x real-time     |
| M1 Ultra | 22       | **40x** (measured) |
| M1 Pro   | 11       | ~20x real-time     |

Performance scales roughly with Neural Engine compute. Ultra variants have 2x ANE cores. Results may vary based on thermal conditions and system load.

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

// First run downloads models (cached for future use)
await engine.initialize()

// Transcribe audio of ANY length (16kHz, mono, Float32Array)
const result = await engine.transcribe(audioSamples)

console.log(result.text)
// "Hello, this is a test transcription."

console.log(`Processed in ${result.durationMs}ms`)

// Every result includes timestamps
for (const seg of result.segments) {
  console.log(`[${seg.startTime}s] ${seg.text}`)
}

engine.cleanup()
```

That's it. No API keys. No configuration. No internet required after the initial model download. **No length limits** – audio of any duration is automatically handled.

## Audio Format

| Property    | Requirement                                   |
| ----------- | --------------------------------------------- |
| Sample Rate | **16,000 Hz** (16 kHz)                        |
| Channels    | **Mono** (single channel)                     |
| Format      | **Float32Array** with values between -1.0–1.0 |
| Duration    | **Any length**                                |

Voice Activity Detection (VAD) automatically finds speech segments and provides timestamps. The result always includes `segments` with timing information – useful for subtitles, search indexing, or speaker diarization.

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

Models are automatically downloaded on first use:

- **ASR models** (~1.5GB) → `~/.cache/parakeet-coreml/models`
- **VAD model** (~1MB) → `~/.cache/parakeet-coreml/vad`

### CLI Commands

```bash
# Download all models (~1.5GB)
npx parakeet-coreml download

# Run benchmark
npx parakeet-coreml benchmark

# Check status
npx parakeet-coreml status

# Force re-download
npx parakeet-coreml download --force
```

### Custom Configuration

```typescript
// Use custom model directories
const engine = new ParakeetAsrEngine({
  modelDir: "./my-models",
  vadDir: "./my-vad-model"
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
| `modelDir`     | `string`  | `~/.cache/parakeet-coreml/models` | Path to ASR model directory     |
| `vadDir`       | `string`  | `~/.cache/parakeet-coreml/vad`    | Path to VAD model directory     |
| `autoDownload` | `boolean` | `true`                            | Auto-download models if missing |

#### Methods

| Method                       | Description                       |
| ---------------------------- | --------------------------------- |
| `initialize()`               | Load models (downloads if needed) |
| `transcribe(samples, opts?)` | Transcribe audio of any length    |
| `isReady()`                  | Check if engine is initialized    |
| `cleanup()`                  | Release native resources          |
| `getVersion()`               | Get version information           |

### `TranscriptionResult`

```typescript
interface TranscriptionResult {
  text: string // Combined transcription
  durationMs: number // Processing time in milliseconds
  segments: TranscribedSegment[] // Speech segments with timestamps
}

interface TranscribedSegment {
  startTime: number // Segment start in seconds
  endTime: number // Segment end in seconds
  text: string // Transcription for this segment
}
```

### `TranscribeOptions`

```typescript
interface TranscribeOptions {
  sampleRate?: number // Default: 16000
  vadThreshold?: number // Speech detection sensitivity (0-1), default: 0.5
  minSilenceDurationMs?: number // Pause length to split, default: 300
  minSpeechDurationMs?: number // Minimum segment length, default: 250
}
```

### Helper Functions

| Function                | Description                            |
| ----------------------- | -------------------------------------- |
| `isAvailable()`         | Check if running on supported platform |
| `getDefaultModelDir()`  | Get default ASR model cache path       |
| `areModelsDownloaded()` | Check if ASR models are present        |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Node.js App                     │
├─────────────────────────────────────────────────────────┤
│                  parakeet-coreml API                    │  TypeScript
├─────────────────────────────────────────────────────────┤
│          ASR Engine          │       VAD Engine         │  N-API + Objective-C++
│      (Parakeet TDT v3)       │      (Silero VAD)        │
├─────────────────────────────────────────────────────────┤
│                      CoreML                             │  Apple Framework
├─────────────────────────────────────────────────────────┤
│                 Apple Neural Engine                     │  Dedicated ML Silicon
└─────────────────────────────────────────────────────────┘
```

The library bridges Node.js directly to Apple's CoreML framework via a native N-API addon written in Objective-C++. Both ASR and VAD models run on the Neural Engine:

1. **VAD** detects speech segments with timestamps
2. **ASR** transcribes each segment (splitting at 15s if needed)
3. Results are combined with full timing information

This eliminates subprocess overhead and Python interop, resulting in minimal latency and efficient memory usage.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Development setup
- Code style guidelines
- Pull request process

## License

MIT – see [LICENSE](LICENSE) for details.

## Credits

- [NVIDIA Parakeet TDT v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) – The underlying ASR model
- [Silero VAD](https://github.com/snakers4/silero-vad) – Voice Activity Detection model
- [FluidInference](https://huggingface.co/FluidInference) – CoreML model conversions for both Parakeet and Silero VAD

---

Copyright © 2026 [Sebastian Software GmbH](https://sebastian-software.de), Mainz, Germany
