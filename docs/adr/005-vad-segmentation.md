# ADR-005: VAD-based Segmentation for Long Audio

## Status

Accepted

## Context

The Parakeet TDT ASR model has a 15-second input limit due to its fixed-size encoder architecture. Users need to transcribe longer audio files (meetings, podcasts, lectures) without manual chunking.

The challenge is determining where to split audio:

- **Fixed-length splits** (every 15s) may cut words mid-sentence
- **Silence detection** (simple energy threshold) is unreliable with background noise
- **Manual segmentation** puts burden on users

## Decision

We integrate **Silero VAD** (Voice Activity Detection) as a CoreML model to automatically detect speech segments in long audio. The system:

1. Processes audio through VAD in 36ms frames
2. Detects speech regions using a probability threshold
3. Splits at natural pauses (configurable silence duration)
4. Transcribes each segment separately
5. Combines results with timestamps

### Why Silero VAD?

| Option         | Pros                                                           | Cons                            |
| -------------- | -------------------------------------------------------------- | ------------------------------- |
| **Silero VAD** | Small (~1MB), accurate, CoreML available, LSTM handles context | Requires second model           |
| WebRTC VAD     | No model needed                                                | Less accurate, no Neural Engine |
| Energy-based   | Simple, fast                                                   | Unreliable with noise           |
| Whisper-style  | No segmentation needed                                         | Different model architecture    |

Silero VAD was chosen because:

- Already converted to CoreML by FluidInference
- Runs on Neural Engine (consistent with ASR approach)
- Proven accuracy across languages
- Stateful LSTM captures temporal context
- MIT licensed

### API Design

The API is unified - `transcribe()` automatically uses VAD for long audio:

```typescript
const engine = new ParakeetAsrEngine()
await engine.initialize()

// Works for ANY length - VAD is automatic for >15s
const result = await engine.transcribe(samples)

// Long audio includes timestamps
if (result.segments) {
  result.segments.forEach((seg) => {
    console.log(`[${seg.startTime}s - ${seg.endTime}s]: ${seg.text}`)
  })
}
```

The VAD model is loaded on-demand when audio exceeds 15 seconds.

## Consequences

### Positive

- Users can transcribe audio of any length
- Natural segmentation at speech boundaries
- Timestamps enable subtitle generation
- No word-cutting at segment boundaries
- Both models run on Neural Engine

### Negative

- Additional ~1MB model download
- Slightly higher memory usage (~10MB)
- VAD processing adds small overhead (~1% of audio duration)
- Two models to maintain

### Neutral

- VAD is opt-in (disabled by default)
- Segments longer than 15s are still split (at 15s boundaries)
- VAD parameters are configurable for different use cases

## References

- [Silero VAD](https://github.com/snakers4/silero-vad)
- [FluidInference CoreML conversion](https://huggingface.co/FluidInference/silero-vad-coreml)
