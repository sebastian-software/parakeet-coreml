# ADR-002: Use N-API for Node.js Bindings

## Status

Accepted

## Context

To expose native CoreML functionality to Node.js, we need a binding layer. Options include:

1. **N-API (Node-API)** – Stable ABI, official Node.js API
2. **nan (Native Abstractions for Node.js)** – Legacy, version-dependent
3. **neon** – Rust-based bindings
4. **FFI (node-ffi-napi)** – Dynamic foreign function interface

## Decision

We chose **N-API via node-addon-api** (C++ wrapper) because:

### ABI Stability

N-API provides a stable Application Binary Interface across Node.js versions. A compiled addon works on Node.js 20, 22, and 24 without recompilation.

This is critical for npm distribution – we ship a single precompiled binary that works for all users on supported Node.js versions.

### Official Support

N-API is the official, recommended way to build native addons. It's:

- Maintained by the Node.js team
- Well-documented
- Actively developed

### C++ Compatibility

`node-addon-api` provides a C++ wrapper around the C-based N-API. This integrates naturally with our Objective-C++ code that interfaces with CoreML.

### No Rust Requirement

While neon (Rust) is excellent, it would add:

- Rust toolchain as a build dependency
- Complexity bridging Rust ↔ Objective-C++
- Additional maintenance burden

## Consequences

### Positive

- Single binary works across Node.js LTS versions
- No recompilation needed for Node.js updates
- Familiar C++ patterns
- Excellent TypeScript interop via declarations

### Negative

- Must handle C++/Objective-C++ memory management manually
- Debugging native crashes requires native tooling (lldb)
- Build requires Xcode Command Line Tools

## Implementation Details

```cpp
// addon.mm - N-API function registration
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initialize", Napi::Function::New(env, Initialize));
    exports.Set("transcribe", Napi::Function::New(env, Transcribe));
    exports.Set("cleanup", Napi::Function::New(env, Cleanup));
    return exports;
}

NODE_API_MODULE(coreml_asr, Init)
```

The `bindings` npm package locates the compiled `.node` file at runtime, handling various installation scenarios (local development, npm install, yarn PnP).
