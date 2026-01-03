/**
 * Voice Activity Detection Engine using Silero VAD CoreML
 *
 * Detects speech segments in audio for intelligent chunking
 * of long audio files before transcription.
 */

#ifndef VAD_ENGINE_H
#define VAD_ENGINE_H

#import <CoreML/CoreML.h>
#import <Foundation/Foundation.h>

#include <string>
#include <vector>

/**
 * Represents a detected speech segment
 */
struct SpeechSegment {
    float startTime;  // Start time in seconds
    float endTime;    // End time in seconds
};

/**
 * VAD Engine using Silero VAD CoreML model
 */
class VadEngine {
public:
    /**
     * Initialize VAD engine with model directory
     * @param vadDir Directory containing silero-vad-unified-v6.0.0.mlmodelc
     */
    explicit VadEngine(const std::string& vadDir);
    ~VadEngine();

    /**
     * Check if VAD engine is ready
     */
    bool isReady() const;

    /**
     * Detect speech segments in audio
     * @param samples Audio samples (16kHz, mono, float32)
     * @param sampleCount Number of samples
     * @param threshold Speech probability threshold (default 0.5)
     * @param minSilenceDurationMs Minimum silence duration to split (default 300ms)
     * @param minSpeechDurationMs Minimum speech duration to keep (default 250ms)
     * @return Vector of speech segments with start/end times
     */
    std::vector<SpeechSegment> detectSpeechSegments(
        const float* samples,
        size_t sampleCount,
        float threshold = 0.5f,
        int minSilenceDurationMs = 300,
        int minSpeechDurationMs = 250
    );

    /**
     * Get speech probability for a single frame (576 samples = 36ms)
     * Updates internal LSTM state
     * @param samples Pointer to 576 audio samples
     * @return Speech probability [0, 1]
     */
    float processFrame(const float* samples);

    /**
     * Reset LSTM hidden/cell states
     * Call before processing a new audio stream
     */
    void resetState();

private:
    MLModel* model_;
    bool ready_;

    // LSTM states (128 dimensions each)
    std::vector<float> hiddenState_;
    std::vector<float> cellState_;

    static constexpr int FRAME_SIZE = 576;      // 36ms @ 16kHz
    static constexpr int STATE_SIZE = 128;      // LSTM hidden/cell dimensions
    static constexpr int SAMPLE_RATE = 16000;
};

#endif // VAD_ENGINE_H

