# ADR-003: 15-Second Audio Chunk Limit

## Status

Accepted

## Context

The Parakeet CoreML model has a fixed input shape that limits the maximum audio duration per inference call. We need to decide how to handle this constraint.

## Decision

We enforce a **15-second maximum** per `transcribe()` call, matching the model's fixed input shape.

### Why 15 Seconds?

The CoreML Encoder model expects a fixed input shape:

- **Preprocessor**: `[1, 240000]` samples = 15 seconds at 16kHz
- **Encoder**: `[1, 128, 1501]` mel frames

These shapes are baked into the compiled CoreML model and cannot be changed at runtime.

### How It Works

1. Audio shorter than 15 seconds is **zero-padded** to 240,000 samples
2. The `mel_length` parameter tells the model the actual audio length
3. Audio longer than 15 seconds must be **split by the caller**

## Consequences

### Positive

- Simple, predictable API
- Optimal memory usage (fixed tensor sizes)
- No dynamic shape handling complexity
- Matches how the model was trained

### Negative

- Users must implement chunking for longer audio
- No built-in handling of chunk boundaries (words may be split)
- Overhead for very short audio (still processes full 15s tensor)

## Usage Guidance

For audio longer than 15 seconds, users should:

```typescript
// Split audio into 15-second chunks with overlap
const CHUNK_SIZE = 16000 * 15 // 15 seconds
const OVERLAP = 16000 * 1 // 1 second overlap

for (let i = 0; i < samples.length; i += CHUNK_SIZE - OVERLAP) {
  const chunk = samples.slice(i, i + CHUNK_SIZE)
  const result = engine.transcribe(chunk, 16000)
  // Merge results, handling overlap...
}
```

## Update: Always-On VAD (ADR-005)

This limitation is now completely hidden from users. See [ADR-005: VAD-based Segmentation for Long Audio](005-vad-segmentation.md).

VAD is always used for consistent behavior:

```typescript
const engine = new ParakeetAsrEngine()
await engine.initialize()

const result = await engine.transcribe(audioSamples)
// Always includes result.segments with timestamps
```

Benefits of always using VAD:

- Consistent API: always get timestamps
- Useful for subtitles, indexing, diarization
- Minimal overhead (VAD is very fast)
- Simpler code path

The 15-second model limit is now purely internal – segments longer than 15s are automatically split.
