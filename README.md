# Arbites - Polkadot Ecosystem Arbitrage Bot

A sophisticated arbitrage trading bot for the Polkadot ecosystem, starting with Moonbeam network support. Built with Effect-TS for robust error handling and functional programming patterns.

## Features

- 🔄 **Multi-DEX Monitoring**: Tracks liquidity pools across multiple DEXs
- 🤖 **AI-Powered Decision Making**: Uses AI agents to identify trading opportunities
- 📊 **Real-time Price Analysis**: Monitors price disparities across exchanges
- 🛡️ **Safe by Default**: Dry-run mode for testing strategies without risking funds
- 📈 **Performance Tracking**: Built-in evaluation framework for strategy optimization
- 🔧 **Extensible Architecture**: Easy to add new chains and DEXs

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Moonbeam RPC endpoint (default uses public endpoint)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd arbites

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Usage

```bash
# Run in dry-run mode (default)
pnpm start run

# Run with custom settings
pnpm start run --interval 60 --min-profit 1.0

# Test the CLI
pnpm start test

# Show help
pnpm start --help
```

### CLI Options

- `--interval <seconds>`: Update interval in seconds (default: 30)
- `--min-profit <percentage>`: Minimum profit percentage to consider (default: 0.5)
- `--rpc-url <url>`: Moonbeam RPC URL (default: https://rpc.api.moonbeam.network)
- `--dry-run/--no-dry-run`: Run in dry-run mode (default: true)

## Development

### Project Structure

```
src/
├── blockchain/       # Blockchain connectors and interfaces
├── monitoring/       # Pool monitoring and arbitrage detection
├── services/        # Core services (arbitrage bot)
├── Cli.ts          # CLI interface
└── bin.ts          # Entry point

test/                # Unit tests
scripts/            # Build scripts
.github/workflows/  # CI/CD pipelines
```

### Available Scripts

```bash
# Development
pnpm start          # Run the CLI
pnpm test           # Run tests
pnpm test:watch     # Run tests in watch mode
pnpm coverage       # Generate coverage report

# Code Quality
pnpm lint           # Run linter
pnpm lint:fix       # Fix linting issues
pnpm format         # Format code
pnpm check          # Type check

# Build
pnpm build          # Build for production
pnpm clean          # Clean build artifacts
```

### Code Quality

This project uses:
- **Biome** for linting and formatting
- **TypeScript** for type safety
- **Vitest** for testing
- **Husky** for Git hooks
- **GitHub Actions** for CI/CD

### Git Hooks

Pre-commit and pre-push hooks are configured to ensure code quality:
- **pre-commit**: Runs Biome on staged files
- **pre-push**: Runs type checking and tests

## Architecture

### Effect-TS Layers

The application uses Effect's layer pattern for dependency injection:

1. **Blockchain Connector Layer**: Abstracts blockchain interactions
2. **Pool Monitor Layer**: Tracks DEX pools and finds opportunities
3. **Arbitrage Service Layer**: Orchestrates the trading bot

### Blockchain Support

Currently supported:
- **Moonbeam** (EVM-compatible, via Viem)

Planned:
- **Hydration** (Substrate, via PAPI)
- **Acala** (Substrate, via PAPI)
- Other Polkadot parachains

### AI Integration

The bot includes hooks for AI-powered decision making:
- Analyzes market conditions
- Evaluates trading opportunities
- Learns from past trades (planned)

## Configuration

### Environment Variables

Create a `.env` file for custom configuration:

```env
MOONBEAM_RPC_URL=https://your-rpc-endpoint.com
MIN_PROFIT_PERCENTAGE=1.0
UPDATE_INTERVAL_SECONDS=30
```

### Adding New DEXs

To add support for a new DEX:

1. Add the pool address to `ArbitrageService.ts`
2. Ensure it follows Uniswap V2 interface (or implement custom logic)
3. Add tests for the new pool

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test blockchain/ViemConnector.test.ts

# Run with coverage
pnpm coverage
```

## CI/CD

GitHub Actions workflows:
- **CI**: Runs on every push and PR (lint, test, build)
- **Release**: Automated npm publishing with changesets

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Acknowledgments

- Built with [Effect-TS](https://effect.website/)
- Uses [Viem](https://viem.sh/) for EVM interactions
- Will integrate [Polkadot API](https://papi.how/) for Substrate chains