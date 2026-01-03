# Architecture

This document describes the technical architecture of parakeet-coreml.

## Overview

parakeet-coreml is a Node.js native addon that provides speech-to-text functionality using Apple's CoreML framework. It bridges JavaScript to native Objective-C++ code, which interfaces directly with CoreML models running on Apple's Neural Engine (ANE).

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
│  │ ParakeetAsrEngine│  │  downloadModels │  │   isAvailable  │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Native Addon (N-API)                         │
│                      src/addon.mm                               │
│         Exposes: initialize, transcribe, cleanup                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ASR Engine                                │
│                    src/asr_engine.mm                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ MelSpectrogram│  │   Encoder    │  │ TransducerDecoder    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
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

The transcription pipeline processes audio through these stages:

```
Audio Samples (Float32Array, 16kHz, mono)
           │
           ▼
    ┌──────────────┐
    │ Preprocessor │  CoreML model converts audio to mel spectrogram
    │  (CoreML)    │  Input: [1, 240000] samples (15s max)
    │              │  Output: [1, 128, 1501] mel features
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │   Encoder    │  Transformer encoder processes mel features
    │  (CoreML)    │  Input: [1, 128, 1501] mel features
    │              │  Output: [1, 1024, 188] encoded features
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │  Transducer  │  Greedy decoding with prediction network
    │   Decoder    │  Iteratively predicts tokens until EOS
    │  (CoreML)    │
    └──────────────┘
           │
           ▼
    Token IDs → Vocabulary Lookup → Text
```

## Components

### TypeScript Layer (`src/`)

| File            | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `index.ts`      | Main API: `ParakeetAsrEngine` class, model validation   |
| `download.ts`   | Model download from Hugging Face, vocabulary conversion |
| `cli.ts`        | CLI tool for model management                           |
| `bindings.d.ts` | Type declarations for `bindings` package                |

### Native Layer (`src/*.mm`, `src/*.h`)

| File                       | Purpose                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `addon.mm`                 | N-API bindings, exposes functions to JavaScript                          |
| `asr_engine.mm/.h`         | Main ASR logic, model loading, transcription orchestration               |
| `mel_spectrogram.mm/.h`    | Fallback mel spectrogram computation (if Preprocessor model unavailable) |
| `transducer_decoder.mm/.h` | Transducer decoding algorithm, token prediction                          |

### CoreML Models

The models are stored in `~/.cache/parakeet-coreml/models/` and include:

| Model                    | Purpose                          | Shape                           |
| ------------------------ | -------------------------------- | ------------------------------- |
| `Preprocessor.mlmodelc`  | Audio → Mel spectrogram          | [1, samples] → [1, 128, frames] |
| `Encoder.mlmodelc`       | Mel → Encoded features           | [1, 128, 1501] → [1, 1024, 188] |
| `Decoder.mlmodelc`       | Prediction network               | [1, 1] → [1, 1024]              |
| `JointDecision.mlmodelc` | Joint network for token decision | [1024], [1024] → [1025]         |

## Key Design Decisions

Design decisions are documented as Architecture Decision Records (ADRs) in `docs/adr/`:

- [ADR-001: Use CoreML and Apple Neural Engine](docs/adr/001-coreml-neural-engine.md)
- [ADR-002: Use N-API for Node.js bindings](docs/adr/002-napi-bindings.md)
- [ADR-003: 15-second audio chunk limit](docs/adr/003-chunk-limit.md)
- [ADR-004: Automatic model download from Hugging Face](docs/adr/004-model-download.md)

## Memory Management

- **Native addon**: Uses RAII patterns and `@autoreleasepool` for Objective-C memory management
- **Model loading**: Models are loaded once during `initialize()` and held in memory
- **Cleanup**: `cleanup()` releases all CoreML models and resets state

## Thread Safety

- The current implementation uses a **single global engine instance**
- Concurrent calls to `transcribe()` are not thread-safe
- For concurrent transcription, create multiple engine instances (each loads its own models)

## Performance Characteristics

| Metric              | Value           | Notes                           |
| ------------------- | --------------- | ------------------------------- |
| Model load time     | ~2-3s           | One-time cost at initialization |
| Transcription speed | ~110x real-time | On M4 Pro, varies by chip       |
| Memory usage        | ~500MB          | Loaded models                   |
| Max audio length    | 15 seconds      | Per transcribe() call           |
