# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript CLI application template using the Effect framework. It provides a minimal starting point for building command-line applications with functional programming patterns.

## Development Commands

### Essential Commands
- `pnpm start` - Run the CLI application
- `pnpm build` - Build the project (compiles TypeScript and copies package.json)
- `pnpm test` - Run tests with Vitest
- `pnpm check` - Type-check all TypeScript files
- `pnpm tsx <file>` - Execute TypeScript files directly

### Additional Commands
- `pnpm coverage` - Run tests with coverage report
- `pnpm clean` - Clean the dist directory
- `pnpm changeset-publish` - Build, test, and publish to npm

## Architecture

### Core Structure
The application follows the Effect CLI pattern:

1. **Entry Point** (`src/bin.ts`): Sets up the Effect runtime with Node.js context and runs the CLI
2. **CLI Definition** (`src/Cli.ts`): Defines commands using `@effect/cli` library
3. **Effect Pattern**: Uses functional programming with pipes, layers, and effects for dependency injection

### Key Dependencies
- `@effect/cli` - Command-line interface framework
- `@effect/platform-node` - Node.js runtime integration
- `effect` - Core functional programming library

### Build Configuration
- **Bundler**: tsup
- **Target**: ES2022
- **Module System**: ESM (type: "module")
- **TypeScript**: Composite project with separate configs for src/, test/, and scripts/

## Testing

Tests use Vitest with Effect integration. Test files should be placed in the `test/` directory with `.test.ts` extension.

To run a single test file:
```bash
pnpm vitest run test/YourTest.test.ts
```

## Important Notes

- No linting tools are currently configured
- The project uses pnpm patches for `@changesets/get-github-info`
- When modifying the CLI, the main logic should go in `src/Cli.ts`
- The Effect framework emphasizes type safety and functional composition - use pipes and effects rather than imperative code
- Always run `pnpm lint:fix` after big changes so we automatically fix format