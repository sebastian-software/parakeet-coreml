# Changelog

## [2.0.1](https://github.com/sebastian-software/parakeet-coreml/compare/v2.0.0...v2.0.1) (2026-01-03)

### Bug Fixes

- **ci:** use CJS CLI for model download ([1090844](https://github.com/sebastian-software/parakeet-coreml/commit/1090844c33e11a31633a6acbb6178bf6dc8d6c15))

# [2.0.0](https://github.com/sebastian-software/parakeet-coreml/compare/v1.0.1...v2.0.0) (2026-01-03)

- refactor!: unify API - transcribe() handles any audio length ([d7ebd6c](https://github.com/sebastian-software/parakeet-coreml/commit/d7ebd6c87266aa77b89a157b6cdcc9f663c492e4))

### Features

- add benchmark command to CLI ([ee66cc2](https://github.com/sebastian-software/parakeet-coreml/commit/ee66cc2ed524d38a9cc386d5f4b1b592fc1463f1))
- add VAD support for long audio transcription ([10a0a9e](https://github.com/sebastian-software/parakeet-coreml/commit/10a0a9ef781ee0d6ec9a5c790f81fc90b2765197))

### Performance Improvements

- use 5-minute audio for benchmark ([27a9d56](https://github.com/sebastian-software/parakeet-coreml/commit/27a9d560f2e928575a7f7d93686899b20cc4947a))

### BREAKING CHANGES

- The API has been simplified significantly.

Before:

- transcribe() for short audio (≤15s)
- transcribeLong() for long audio (required enableVad: true)

After:

- transcribe() works for ANY length (async)
- VAD is automatically used when audio > 15s
- VAD model downloaded on-demand

Removed:

- enableVad option
- transcribeLong() method
- isVadReady() method
- initializeVad() public method

The 15-second limit is now purely an implementation detail.
Users simply call transcribe() and it just works.

## [1.0.1](https://github.com/sebastian-software/parakeet-coreml/compare/v1.0.0...v1.0.1) (2026-01-03)

### Bug Fixes

- place v8 ignore comments before JSDoc to preserve association ([9045866](https://github.com/sebastian-software/parakeet-coreml/commit/90458668f8917e998ee05daf4ceae3031b71fa29))

# [1.0.0](https://github.com/sebastian-software/parakeet-coreml/compare/v0.3.0...v1.0.0) (2026-01-03)

### Bug Fixes

- cleanup ([1597c28](https://github.com/sebastian-software/parakeet-coreml/commit/1597c28a863c57e906a798b9f83229c2097f4267))

# [0.3.0](https://github.com/sebastian-software/parakeet-coreml/compare/v0.2.0...v0.3.0) (2026-01-03)

### Bug Fixes

- suppress import.meta warning in CJS build ([9337849](https://github.com/sebastian-software/parakeet-coreml/commit/933784938269f0ca4a3aad2e418002bbef2e5671))
- tests ([80157e6](https://github.com/sebastian-software/parakeet-coreml/commit/80157e6bbf25b0f0e6118a8cb2a20fed4fa66e94))

### Features

- added logo ([c38c39f](https://github.com/sebastian-software/parakeet-coreml/commit/c38c39fdc093ab99c402dbe456e6be2014ca4f24))

# 0.2.0 (2026-01-03)

### Bug Fixes

- **ci:** bypass os/cpu restrictions on Ubuntu runners ([115d852](https://github.com/sebastian-software/parakeet-coreml/commit/115d8524cf8bfb0453f532d9ec4540dd0575410d))
- convert JSON vocab to tokens.txt format after download ([22b9753](https://github.com/sebastian-software/parakeet-coreml/commit/22b975371a9f6f37335e69ef6e52fcb58e3c1bc0))
- use angular preset for release-it changelog ([99d6663](https://github.com/sebastian-software/parakeet-coreml/commit/99d666395a53d760aff042afa024322e5e6af9ab))

### Features

- add auto-download, development tooling, and CI ([b0bc813](https://github.com/sebastian-software/parakeet-coreml/commit/b0bc8138d5b67828497e2c2f7a40be9712ef4ea0))
