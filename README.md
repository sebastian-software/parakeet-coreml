# parakeet-coreml

NVIDIA Parakeet TDT ASR for Node.js with **CoreML/ANE acceleration** on Apple Silicon.

Fast, accurate, and fully offline speech recognition using the [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) model.

## Features

- 🚀 **~110x real-time** - Transcribe 1 minute of audio in ~0.5 seconds (M4 Pro)
- 🍎 **Apple Neural Engine** - Hardware-accelerated via CoreML
- 🌍 **Multilingual** - Major European languages supported
- 🔒 **Fully offline** - No data leaves your device
- 📦 **Native Node.js addon** - No Python, no subprocess

## Requirements

- macOS 14.0+
- Apple Silicon (M1/M2/M3/M4)
- Node.js 20+

## Installation

```bash
npm install parakeet-coreml
```

## Model Setup

Download the CoreML models from HuggingFace:

```bash
git lfs install
git clone https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml ./models/parakeet
```

## Usage

```typescript
import { ParakeetAsrEngine } from "parakeet-coreml"

const engine = new ParakeetAsrEngine({
  modelDir: "./models/parakeet"
})

await engine.initialize()

// Transcribe audio (16kHz, mono, Float32)
const result = await engine.transcribe(audioSamples, 16000)

console.log(result.text)
// "Hello, this is a test transcription."

console.log(`Processed in ${result.durationMs}ms`)

engine.cleanup()
```

## API

### `ParakeetAsrEngine`

```typescript
new ParakeetAsrEngine({ modelDir: string })
```

#### Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Load models (async) |
| `isReady()` | Check if ready |
| `transcribe(samples, sampleRate?)` | Transcribe audio |
| `cleanup()` | Release resources |

### `TranscriptionResult`

```typescript
interface TranscriptionResult {
  text: string      // Transcribed text
  durationMs: number // Processing time
}
```

### Helper Functions

- `isAvailable()` - Check if platform is supported (macOS)

## Performance

| Device | Speed | Notes |
|--------|-------|-------|
| M4 Pro | ~110x real-time | ANE accelerated |
| M1 | ~50-70x real-time | ANE accelerated |

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
