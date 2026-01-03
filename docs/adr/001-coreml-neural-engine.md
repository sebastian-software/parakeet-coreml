# ADR-001: Use CoreML and Apple Neural Engine

## Status

Accepted

## Context

We need to run NVIDIA's Parakeet ASR model on Apple Silicon Macs. Several options exist for running ML models:

1. **ONNX Runtime** – Cross-platform, supports CoreML as execution provider
2. **llama.cpp / whisper.cpp** – Optimized C++ implementations, CPU-focused
3. **TensorFlow Lite** – Cross-platform, limited Apple Silicon optimization
4. **CoreML (native)** – Apple's ML framework with direct Neural Engine access

## Decision

We chose **CoreML with direct Objective-C++ integration** for these reasons:

### Performance

CoreML provides exclusive access to the Apple Neural Engine (ANE), a dedicated ML accelerator present in all Apple Silicon chips. The ANE delivers:

- **~110x real-time** transcription on M4 Pro
- **Significantly faster** than CPU-based alternatives like whisper.cpp
- **Lower power consumption** compared to GPU execution

### No Runtime Dependencies

Unlike ONNX Runtime or TensorFlow, CoreML is built into macOS. Users don't need to install additional frameworks or manage ML runtime versions.

### Optimal Resource Utilization

CoreML automatically schedules work across ANE, GPU, and CPU based on:

- Model compatibility with each compute unit
- Current system load
- Power constraints

We use `MLComputeUnitsAll` to let CoreML make optimal decisions.

### Model Availability

The Parakeet model was already converted to CoreML format by [FluidInference](https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml), eliminating the need for custom conversion.

## Consequences

### Positive

- Best possible performance on Apple Silicon
- No external ML runtime dependencies
- Future-proof (Apple continues investing in CoreML/ANE)

### Negative

- **macOS only** – No Windows/Linux support
- **Apple Silicon only** – Intel Macs have limited CoreML performance
- **Model format lock-in** – Must use CoreML-converted models

## Alternatives Considered

### whisper.cpp

While whisper.cpp is excellent for Whisper models, it:

- Runs primarily on CPU (Metal support is limited)
- Would require porting Parakeet's Transducer architecture
- Cannot utilize the Neural Engine

### ONNX Runtime with CoreML EP

ONNX Runtime can use CoreML as an execution provider, but:

- Adds another runtime dependency
- Indirect CoreML access may have overhead
- Less control over CoreML configuration
