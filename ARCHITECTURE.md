# Architecture

This document describes the technical architecture of parakeet-coreml.

## Overview

parakeet-coreml is a Node.js native addon that provides speech-to-text functionality using Apple's CoreML framework. It bridges JavaScript to native Objective-C++ code, which interfaces directly with CoreML models running on Apple's Neural Engine (ANE).

The system consists of two main engines:

- **ASR Engine**: Parakeet TDT v3 for speech-to-text transcription
- **VAD Engine**: Silero VAD for voice activity detection and audio segmentation

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Application                           │
│                        (Node.js)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TypeScript API Layer                         │
│                      src/index.ts                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ ParakeetAsrEngine│  │   transcribe()  │  │  auto-download │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Native Addon (N-API)                         │
│                      src/addon.mm                               │
│   ASR: initialize, transcribe, cleanup                          │
│   VAD: initializeVad, detectSpeechSegments, cleanupVad          │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│       ASR Engine          │   │       VAD Engine          │
│    src/asr_engine.mm      │   │    src/vad_engine.mm      │
│  ┌────────┐ ┌─────────┐   │   │  ┌──────────────────┐     │
│  │Encoder │ │Decoder  │   │   │  │ Silero VAD LSTM  │     │
│  └────────┘ └─────────┘   │   │  └──────────────────┘     │
└───────────────────────────┘   └───────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CoreML                                  │
│              Apple's Machine Learning Framework                 │
│         Automatically utilizes ANE, GPU, or CPU                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Apple Neural Engine                          │
│              Dedicated ML silicon on Apple chips                │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Unified Pipeline (all audio)

```
Audio Samples (Float32Array, 16kHz, mono, any length)
           │
           ▼
    ┌───────────────────────────────────────────────────┐
    │                  VAD Engine                        │
    │  Process 36ms frames (576 samples)                │
    │  Input: [1, 576] audio samples                    │
    │  Input: [1, 128] hidden state, [1, 128] cell state│
    │  Output: [1, 1, 1] speech probability             │
    │  Output: updated hidden/cell states               │
    └───────────────────────────────────────────────────┘
           │
           ▼
    ┌───────────────────────────────────────────────────┐
    │           Speech Segment Detection                 │
    │  Threshold probabilities → find speech regions    │
    │  Apply min silence/speech duration filters        │
    │  Output: [{ startTime, endTime }, ...]            │
    └───────────────────────────────────────────────────┘
           │
           ▼
    For each segment (split at 15s if needed):
           │
           ▼
    ┌───────────────────────────────────────────────────┐
    │               ASR Engine                           │
    │  Transcribe segment using Parakeet TDT            │
    └───────────────────────────────────────────────────┘
           │
           ▼
    Combine results: { text, segments: [{ startTime, endTime, text }] }
```

## Components

### TypeScript Layer (`src/`)

| File            | Purpose                                                         |
| --------------- | --------------------------------------------------------------- |
| `index.ts`      | Main API: `ParakeetAsrEngine` class with unified `transcribe()` |
| `download.ts`   | Model download from Hugging Face for both ASR and VAD models    |
| `cli.ts`        | CLI tool for model management (download, status, path)          |
| `bindings.d.ts` | Type declarations for `bindings` package                        |

### Native Layer (`src/*.mm`, `src/*.h`)

| File                       | Purpose                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `addon.mm`                 | N-API bindings for both ASR and VAD functions                            |
| `asr_engine.mm/.h`         | Main ASR logic, model loading, transcription orchestration               |
| `vad_engine.mm/.h`         | VAD logic, Silero model loading, speech segment detection                |
| `mel_spectrogram.mm/.h`    | Fallback mel spectrogram computation (if Preprocessor model unavailable) |
| `transducer_decoder.mm/.h` | Transducer decoding algorithm, token prediction                          |

### CoreML Models

**ASR Models** (`~/.cache/parakeet-coreml/models/`):

| Model                    | Purpose                          | Shape                           |
| ------------------------ | -------------------------------- | ------------------------------- |
| `Preprocessor.mlmodelc`  | Audio → Mel spectrogram          | [1, samples] → [1, 128, frames] |
| `Encoder.mlmodelc`       | Mel → Encoded features           | [1, 128, 1501] → [1, 1024, 188] |
| `Decoder.mlmodelc`       | Prediction network               | [1, 1] → [1, 1024]              |
| `JointDecision.mlmodelc` | Joint network for token decision | [1024], [1024] → [1025]         |

**VAD Model** (`~/.cache/parakeet-coreml/vad/`):

| Model                                | Purpose                      | Shape                                      |
| ------------------------------------ | ---------------------------- | ------------------------------------------ |
| `silero-vad-unified-v6.0.0.mlmodelc` | Speech probability per frame | [1, 576] + states → [1, 1, 1] + new states |

The VAD model is a stateful LSTM that processes 36ms audio frames (576 samples @ 16kHz) and outputs a speech probability [0-1]. Hidden and cell states (128 dimensions each) are maintained between frames for temporal context.

## Key Design Decisions

Design decisions are documented as Architecture Decision Records (ADRs) in `docs/adr/`:

- [ADR-001: Use CoreML and Apple Neural Engine](docs/adr/001-coreml-neural-engine.md)
- [ADR-002: Use N-API for Node.js bindings](docs/adr/002-napi-bindings.md)
- [ADR-003: 15-second audio chunk limit](docs/adr/003-chunk-limit.md)
- [ADR-004: Automatic model download from Hugging Face](docs/adr/004-model-download.md)
- [ADR-005: VAD-based segmentation for long audio](docs/adr/005-vad-segmentation.md)

## Memory Management

- **Native addon**: Uses RAII patterns and `@autoreleasepool` for Objective-C memory management
- **Model loading**: Models are loaded once during `initialize()` and held in memory
- **Cleanup**: `cleanup()` releases all CoreML models and resets state

## Thread Safety

- The current implementation uses a **single global engine instance**
- Concurrent calls to `transcribe()` are not thread-safe
- For concurrent transcription, create multiple engine instances (each loads its own models)

## Performance Characteristics

| Metric              | Value            | Notes                           |
| ------------------- | ---------------- | ------------------------------- |
| ASR model load      | ~2-3s            | One-time cost at initialization |
| VAD model load      | ~0.1s            | Additional if VAD enabled       |
| Transcription speed | ~110x real-time  | On M4 Pro, varies by chip       |
| VAD processing      | ~0.01x real-time | Negligible overhead             |
| Memory usage        | ~500MB           | ASR models loaded               |
| Memory usage (VAD)  | ~10MB            | Additional for VAD model        |
| Max audio (short)   | 15 seconds       | Per transcribe() call           |
| Max audio (long)    | Unlimited        | With VAD via transcribeLong()   |
