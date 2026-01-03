/**
 * CoreML ASR Native Addon for Node.js
 *
 * This addon provides speech-to-text functionality using Apple's CoreML
 * with the Parakeet TDT v3 model.
 */

#import <Foundation/Foundation.h>
#import <CoreML/CoreML.h>
#import <napi.h>

#include "asr_engine.h"
#include "vad_engine.h"

// Global engine instances
static AsrEngine* g_engine = nullptr;
static VadEngine* g_vadEngine = nullptr;

/**
 * Initialize the ASR engine with model paths
 * @param modelDir Path to directory containing CoreML models
 */
Napi::Value Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Model directory path expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string modelDir = info[0].As<Napi::String>().Utf8Value();

    try {
        if (g_engine != nullptr) {
            delete g_engine;
        }
        g_engine = new AsrEngine(modelDir);
        return Napi::Boolean::New(env, true);
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Failed to initialize ASR engine: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Check if the engine is initialized
 */
Napi::Value IsInitialized(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), g_engine != nullptr && g_engine->isReady());
}

/**
 * Transcribe audio samples
 * @param samples Float32Array of audio samples (16kHz, mono)
 * @param sampleRate Sample rate (should be 16000)
 */
Napi::Value Transcribe(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (g_engine == nullptr || !g_engine->isReady()) {
        Napi::Error::New(env, "ASR engine not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 1 || !info[0].IsTypedArray()) {
        Napi::TypeError::New(env, "Float32Array of audio samples expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Float32Array samples = info[0].As<Napi::Float32Array>();
    size_t sampleCount = samples.ElementLength();

    int sampleRate = 16000;
    if (info.Length() > 1 && info[1].IsNumber()) {
        sampleRate = info[1].As<Napi::Number>().Int32Value();
    }

    try {
        std::string result = g_engine->transcribe(samples.Data(), sampleCount, sampleRate);
        return Napi::String::New(env, result);
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Transcription failed: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Transcribe audio from a file path
 * @param filePath Path to audio file (WAV, 16kHz mono preferred)
 */
Napi::Value TranscribeFile(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (g_engine == nullptr || !g_engine->isReady()) {
        Napi::Error::New(env, "ASR engine not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "File path expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string filePath = info[0].As<Napi::String>().Utf8Value();

    try {
        std::string result = g_engine->transcribeFile(filePath);
        return Napi::String::New(env, result);
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Transcription failed: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Clean up resources
 */
Napi::Value Cleanup(const Napi::CallbackInfo& info) {
    if (g_engine != nullptr) {
        delete g_engine;
        g_engine = nullptr;
    }
    return info.Env().Undefined();
}

/**
 * Get version information
 */
Napi::Value GetVersion(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object version = Napi::Object::New(env);
    version.Set("addon", "1.0.0");
    version.Set("model", "parakeet-tdt-0.6b-v3");
    version.Set("coreml", "CoreML 7.0+");
    return version;
}

// ============================================================================
// VAD Functions
// ============================================================================

/**
 * Initialize the VAD engine with model path
 * @param vadDir Path to directory containing silero-vad CoreML model
 */
Napi::Value InitializeVad(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "VAD model directory path expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string vadDir = info[0].As<Napi::String>().Utf8Value();

    try {
        if (g_vadEngine != nullptr) {
            delete g_vadEngine;
        }
        g_vadEngine = new VadEngine(vadDir);

        if (!g_vadEngine->isReady()) {
            delete g_vadEngine;
            g_vadEngine = nullptr;
            Napi::Error::New(env, "Failed to initialize VAD engine").ThrowAsJavaScriptException();
            return env.Null();
        }

        return Napi::Boolean::New(env, true);
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Failed to initialize VAD engine: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Check if VAD engine is initialized
 */
Napi::Value IsVadInitialized(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), g_vadEngine != nullptr && g_vadEngine->isReady());
}

/**
 * Detect speech segments in audio
 * @param samples Float32Array of audio samples (16kHz, mono)
 * @param options Optional object with threshold, minSilenceDurationMs, minSpeechDurationMs
 * @returns Array of { startTime, endTime } objects
 */
Napi::Value DetectSpeechSegments(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (g_vadEngine == nullptr || !g_vadEngine->isReady()) {
        Napi::Error::New(env, "VAD engine not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 1 || !info[0].IsTypedArray()) {
        Napi::TypeError::New(env, "Float32Array of audio samples expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Float32Array samples = info[0].As<Napi::Float32Array>();
    size_t sampleCount = samples.ElementLength();

    // Parse options
    float threshold = 0.5f;
    int minSilenceDurationMs = 300;
    int minSpeechDurationMs = 250;

    if (info.Length() > 1 && info[1].IsObject()) {
        Napi::Object options = info[1].As<Napi::Object>();

        if (options.Has("threshold") && options.Get("threshold").IsNumber()) {
            threshold = options.Get("threshold").As<Napi::Number>().FloatValue();
        }
        if (options.Has("minSilenceDurationMs") && options.Get("minSilenceDurationMs").IsNumber()) {
            minSilenceDurationMs = options.Get("minSilenceDurationMs").As<Napi::Number>().Int32Value();
        }
        if (options.Has("minSpeechDurationMs") && options.Get("minSpeechDurationMs").IsNumber()) {
            minSpeechDurationMs = options.Get("minSpeechDurationMs").As<Napi::Number>().Int32Value();
        }
    }

    try {
        std::vector<SpeechSegment> segments = g_vadEngine->detectSpeechSegments(
            samples.Data(),
            sampleCount,
            threshold,
            minSilenceDurationMs,
            minSpeechDurationMs
        );

        Napi::Array result = Napi::Array::New(env, segments.size());
        for (size_t i = 0; i < segments.size(); i++) {
            Napi::Object segment = Napi::Object::New(env);
            segment.Set("startTime", Napi::Number::New(env, segments[i].startTime));
            segment.Set("endTime", Napi::Number::New(env, segments[i].endTime));
            result.Set(i, segment);
        }

        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("VAD detection failed: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Clean up VAD resources
 */
Napi::Value CleanupVad(const Napi::CallbackInfo& info) {
    if (g_vadEngine != nullptr) {
        delete g_vadEngine;
        g_vadEngine = nullptr;
    }
    return info.Env().Undefined();
}

/**
 * Module initialization
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // ASR functions
    exports.Set("initialize", Napi::Function::New(env, Initialize));
    exports.Set("isInitialized", Napi::Function::New(env, IsInitialized));
    exports.Set("transcribe", Napi::Function::New(env, Transcribe));
    exports.Set("transcribeFile", Napi::Function::New(env, TranscribeFile));
    exports.Set("cleanup", Napi::Function::New(env, Cleanup));
    exports.Set("getVersion", Napi::Function::New(env, GetVersion));

    // VAD functions
    exports.Set("initializeVad", Napi::Function::New(env, InitializeVad));
    exports.Set("isVadInitialized", Napi::Function::New(env, IsVadInitialized));
    exports.Set("detectSpeechSegments", Napi::Function::New(env, DetectSpeechSegments));
    exports.Set("cleanupVad", Napi::Function::New(env, CleanupVad));

    return exports;
}

NODE_API_MODULE(coreml_asr, Init)
