# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for parakeet-coreml.

## What are ADRs?

ADRs document significant architectural decisions made during development. They capture:

- **Context** – Why was a decision needed?
- **Decision** – What was decided?
- **Consequences** – What are the implications?

## Index

| ADR                                | Title                                      | Status   |
| ---------------------------------- | ------------------------------------------ | -------- |
| [001](001-coreml-neural-engine.md) | Use CoreML and Apple Neural Engine         | Accepted |
| [002](002-napi-bindings.md)        | Use N-API for Node.js Bindings             | Accepted |
| [003](003-chunk-limit.md)          | 15-Second Audio Chunk Limit                | Accepted |
| [004](004-model-download.md)       | Automatic Model Download from Hugging Face | Accepted |

## Creating New ADRs

When making a significant architectural decision:

1. Copy `template.md` to `NNN-title.md`
2. Fill in Context, Decision, and Consequences
3. Add to the index above
4. Submit with the implementing PR

## Template

See [template.md](template.md) for the ADR template.
