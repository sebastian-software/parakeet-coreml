# ADR-004: Automatic Model Download from Hugging Face

## Status

Accepted

## Context

The CoreML models (~1.5GB) are too large to include in the npm package. We need a strategy for users to obtain the models.

Options considered:

1. **Manual download** – User downloads from Hugging Face manually
2. **postinstall script** – Download during `npm install`
3. **Lazy download** – Download on first use
4. **Separate package** – Ship models as a separate npm package

## Decision

We chose **lazy download on first use** with optional CLI pre-download:

```typescript
// First use triggers download
const engine = new ParakeetAsrEngine()
await engine.initialize() // Downloads if needed

// Or pre-download via CLI
npx parakeet-coreml download
```

### Why Lazy Download?

1. **No npm install delay** – Package installs instantly
2. **User control** – Download happens when user is ready
3. **CI/CD friendly** – Can cache models separately from node_modules
4. **Offline scenarios** – Works if models are pre-deployed

### Why Not postinstall?

- Downloads during `npm install` can timeout
- Breaks in restricted network environments
- Users may install but never use the package
- Harder to cache in CI pipelines

### Why Hugging Face?

- **Free hosting** for open-source models
- **No authentication required** for public models
- **CDN-backed** for fast global downloads
- **Standard** in the ML community
- **Versioning** via Git LFS

## Implementation

### Default Cache Location

```
~/.cache/parakeet-coreml/models/
```

Following XDG Base Directory conventions for Unix-like systems.

### Download Process

1. Fetch file tree from Hugging Face API
2. Filter to required model files (`.mlmodelc` directories, vocab)
3. Download files sequentially with progress reporting
4. Convert vocabulary JSON to native format

### Model Validation

Before using cached models, we verify:

- Encoder model exists
- Decoder model exists
- JointDecision model exists
- Vocabulary file exists

If validation fails with `autoDownload: true`, models are re-downloaded.

## Consequences

### Positive

- Fast npm install
- Flexible deployment options
- Standard cache location
- Progress feedback during download

### Negative

- First run is slow (~1.5GB download)
- Requires internet on first use
- Cache can grow if user forgets to clean up

## Configuration Options

```typescript
// Custom model directory (e.g., for Docker)
new ParakeetAsrEngine({ modelDir: "/app/models" })

// Disable auto-download (fail if missing)
new ParakeetAsrEngine({ autoDownload: false })
```
