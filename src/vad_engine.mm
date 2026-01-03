/**
 * Voice Activity Detection Engine Implementation
 */

#import "vad_engine.h"

#import <Accelerate/Accelerate.h>

VadEngine::VadEngine(const std::string& vadDir) : model_(nil), ready_(false) {
    @autoreleasepool {
        // Find VAD model
        NSString* vadDirStr = [NSString stringWithUTF8String:vadDir.c_str()];
        NSString* modelPath = [vadDirStr stringByAppendingPathComponent:@"silero-vad-unified-v6.0.0.mlmodelc"];

        if (![[NSFileManager defaultManager] fileExistsAtPath:modelPath]) {
            NSLog(@"VAD model not found at: %@", modelPath);
            return;
        }

        NSError* error = nil;
        NSURL* modelURL = [NSURL fileURLWithPath:modelPath];

        // Configure for Neural Engine
        MLModelConfiguration* config = [[MLModelConfiguration alloc] init];
        config.computeUnits = MLComputeUnitsAll;

        model_ = [MLModel modelWithContentsOfURL:modelURL configuration:config error:&error];

        if (error) {
            NSLog(@"Failed to load VAD model: %@", error.localizedDescription);
            return;
        }

        // Initialize LSTM states to zeros
        hiddenState_.resize(STATE_SIZE, 0.0f);
        cellState_.resize(STATE_SIZE, 0.0f);

        ready_ = true;
        NSLog(@"VAD engine initialized successfully");
    }
}

VadEngine::~VadEngine() {
    @autoreleasepool {
        model_ = nil;
    }
}

bool VadEngine::isReady() const {
    return ready_;
}

void VadEngine::resetState() {
    std::fill(hiddenState_.begin(), hiddenState_.end(), 0.0f);
    std::fill(cellState_.begin(), cellState_.end(), 0.0f);
}

float VadEngine::processFrame(const float* samples) {
    if (!ready_ || model_ == nil) {
        return 0.0f;
    }

    @autoreleasepool {
        NSError* error = nil;

        // Create input arrays
        // audio_input: [1, 576]
        NSArray<NSNumber*>* audioShape = @[@1, @(FRAME_SIZE)];
        MLMultiArray* audioInput = [[MLMultiArray alloc] initWithShape:audioShape
                                                              dataType:MLMultiArrayDataTypeFloat32
                                                                 error:&error];
        if (error) {
            NSLog(@"Failed to create audio input array: %@", error.localizedDescription);
            return 0.0f;
        }

        // Copy audio samples
        float* audioPtr = (float*)audioInput.dataPointer;
        memcpy(audioPtr, samples, FRAME_SIZE * sizeof(float));

        // hidden_state: [1, 128]
        NSArray<NSNumber*>* stateShape = @[@1, @(STATE_SIZE)];
        MLMultiArray* hiddenInput = [[MLMultiArray alloc] initWithShape:stateShape
                                                               dataType:MLMultiArrayDataTypeFloat32
                                                                  error:&error];
        if (error) {
            NSLog(@"Failed to create hidden state array: %@", error.localizedDescription);
            return 0.0f;
        }
        memcpy((float*)hiddenInput.dataPointer, hiddenState_.data(), STATE_SIZE * sizeof(float));

        // cell_state: [1, 128]
        MLMultiArray* cellInput = [[MLMultiArray alloc] initWithShape:stateShape
                                                             dataType:MLMultiArrayDataTypeFloat32
                                                                error:&error];
        if (error) {
            NSLog(@"Failed to create cell state array: %@", error.localizedDescription);
            return 0.0f;
        }
        memcpy((float*)cellInput.dataPointer, cellState_.data(), STATE_SIZE * sizeof(float));

        // Create feature provider
        NSDictionary* inputDict = @{
            @"audio_input": audioInput,
            @"hidden_state": hiddenInput,
            @"cell_state": cellInput
        };
        MLDictionaryFeatureProvider* inputProvider =
            [[MLDictionaryFeatureProvider alloc] initWithDictionary:inputDict error:&error];

        if (error) {
            NSLog(@"Failed to create input provider: %@", error.localizedDescription);
            return 0.0f;
        }

        // Run inference
        id<MLFeatureProvider> output = [model_ predictionFromFeatures:inputProvider error:&error];

        if (error) {
            NSLog(@"VAD inference failed: %@", error.localizedDescription);
            return 0.0f;
        }

        // Get VAD output probability
        MLMultiArray* vadOutput = [output featureValueForName:@"vad_output"].multiArrayValue;
        float probability = ((float*)vadOutput.dataPointer)[0];

        // Update LSTM states for next frame
        MLMultiArray* newHidden = [output featureValueForName:@"new_hidden_state"].multiArrayValue;
        MLMultiArray* newCell = [output featureValueForName:@"new_cell_state"].multiArrayValue;

        memcpy(hiddenState_.data(), (float*)newHidden.dataPointer, STATE_SIZE * sizeof(float));
        memcpy(cellState_.data(), (float*)newCell.dataPointer, STATE_SIZE * sizeof(float));

        return probability;
    }
}

std::vector<SpeechSegment> VadEngine::detectSpeechSegments(
    const float* samples,
    size_t sampleCount,
    float threshold,
    int minSilenceDurationMs,
    int minSpeechDurationMs
) {
    std::vector<SpeechSegment> segments;

    if (!ready_ || sampleCount < FRAME_SIZE) {
        return segments;
    }

    // Reset state before processing new audio
    resetState();

    // Calculate frame parameters
    const float frameDurationSec = static_cast<float>(FRAME_SIZE) / SAMPLE_RATE;
    const int minSilenceFrames = static_cast<int>(minSilenceDurationMs / (frameDurationSec * 1000));
    const int minSpeechFrames = static_cast<int>(minSpeechDurationMs / (frameDurationSec * 1000));

    // Process all frames
    std::vector<float> probabilities;
    size_t numFrames = sampleCount / FRAME_SIZE;

    for (size_t i = 0; i < numFrames; i++) {
        float prob = processFrame(samples + i * FRAME_SIZE);
        probabilities.push_back(prob);
    }

    // Find speech segments using threshold crossing with hysteresis
    bool inSpeech = false;
    int speechStart = -1;
    int silenceCount = 0;
    int speechCount = 0;

    for (size_t i = 0; i < probabilities.size(); i++) {
        bool isSpeech = probabilities[i] >= threshold;

        if (!inSpeech) {
            if (isSpeech) {
                speechCount++;
                if (speechCount >= minSpeechFrames) {
                    // Start of speech segment
                    inSpeech = true;
                    speechStart = static_cast<int>(i) - minSpeechFrames + 1;
                    if (speechStart < 0) speechStart = 0;
                    silenceCount = 0;
                }
            } else {
                speechCount = 0;
            }
        } else {
            if (!isSpeech) {
                silenceCount++;
                if (silenceCount >= minSilenceFrames) {
                    // End of speech segment
                    int speechEnd = static_cast<int>(i) - minSilenceFrames;

                    SpeechSegment segment;
                    segment.startTime = speechStart * frameDurationSec;
                    segment.endTime = speechEnd * frameDurationSec;

                    // Only add if segment is long enough
                    if (segment.endTime - segment.startTime >= (minSpeechDurationMs / 1000.0f)) {
                        segments.push_back(segment);
                    }

                    inSpeech = false;
                    speechCount = 0;
                }
            } else {
                silenceCount = 0;
            }
        }
    }

    // Handle speech segment that extends to end of audio
    if (inSpeech && speechStart >= 0) {
        SpeechSegment segment;
        segment.startTime = speechStart * frameDurationSec;
        segment.endTime = static_cast<float>(numFrames) * frameDurationSec;

        if (segment.endTime - segment.startTime >= (minSpeechDurationMs / 1000.0f)) {
            segments.push_back(segment);
        }
    }

    return segments;
}

