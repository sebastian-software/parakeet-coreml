# Contributing to parakeet-coreml

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- macOS 14.0+ on Apple Silicon (M1/M2/M3/M4)
- Node.js 20+
- pnpm 9+
- Xcode Command Line Tools

### Getting Started

```bash
# Clone the repository
git clone https://github.com/sebastian-software/parakeet-coreml.git
cd parakeet-coreml

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test
```

### Project Structure

```
parakeet-coreml/
├── src/
│   ├── index.ts        # Main TypeScript API
│   ├── download.ts     # Model download logic
│   ├── cli.ts          # CLI tool
│   ├── *.mm            # Objective-C++ native addon
│   └── *.h             # C++ headers
├── test/
│   ├── *.test.ts       # Unit tests
│   └── e2e.test.ts     # E2E tests
├── dist/               # Built TypeScript
└── build/              # Built native addon
```

## Development Workflow

### Commands

| Command              | Description                     |
| -------------------- | ------------------------------- |
| `pnpm build`         | Build native addon + TypeScript |
| `pnpm build:native`  | Build only native addon         |
| `pnpm build:ts`      | Build only TypeScript           |
| `pnpm test`          | Run unit tests                  |
| `pnpm test:e2e`      | Run E2E tests (requires models) |
| `pnpm test:coverage` | Run tests with coverage         |
| `pnpm lint`          | Run ESLint                      |
| `pnpm format`        | Format code with Prettier       |
| `pnpm typecheck`     | TypeScript type checking        |

### Code Style

- We use ESLint with TypeScript rules
- Prettier for formatting
- Conventional Commits for commit messages

Commit message format:

```
type(scope): description

feat: add new feature
fix: bug fix
docs: documentation changes
chore: maintenance tasks
test: adding tests
refactor: code refactoring
```

### Pre-commit Hooks

The project uses Husky to run:

- **pre-commit**: Prettier formatting via lint-staged
- **pre-push**: ESLint + TypeScript checks
- **commit-msg**: Conventional commit validation

## Submitting Changes

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Commit using conventional commits
6. Push to your fork
7. Open a Pull Request

### PR Guidelines

- Keep PRs focused on a single change
- Include tests for new features
- Update documentation if needed
- Ensure CI passes

## Reporting Issues

### Bug Reports

Please include:

- macOS version and chip (e.g., macOS 14.2, M3 Pro)
- Node.js version (`node --version`)
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

### Feature Requests

- Describe the use case
- Explain why it would be useful
- Consider if it fits the project scope (macOS/CoreML focused)

## Questions?

Feel free to open a Discussion or Issue if you have questions!
