# Arbitrage Trading Bot Plan for Polkadot Ecosystem

## Overview
A trading arbitrage bot for the Polkadot ecosystem, starting with Moonbeam network. The bot runs as a long-lived service, periodically looking for arbitrage opportunities across liquidity pools, with an AI agent for decision-making and a self-improving evaluation framework.

## System Architecture

### Core Components
- **Bot Service**: Long-lived Effect service with periodic execution
- **Blockchain Connector**: Abstract interface with Viem (Moonbeam) and PAPI (Substrate) implementations
- **Liquidity Pool Monitor**: Tracks DEX pools across protocols
- **AI Decision Engine**: Analyzes opportunities and makes trading decisions
- **Execution Engine**: Handles transaction building and submission
- **Evaluation System**: Tracks performance metrics and backtests strategies
- **Learning System**: Self-improvement through reflection and persistent memory

### Layer Structure (Effect-based)
```
┌─────────────────────────────────┐
│     CLI / Configuration         │
├─────────────────────────────────┤
│     Evaluation Framework        │
├─────────────────────────────────┤
│     AI Agent / Decision Engine  │
├─────────────────────────────────┤
│  Arbitrage Strategy Engine      │
├─────────────────────────────────┤
│  Pool Monitor │ Wallet Manager  │
├─────────────────────────────────┤
│  Blockchain Connectors (Layer)  │
└─────────────────────────────────┘
```

## Blockchain Integration

### Moonbeam (EVM)
- Use Viem for RPC connections
- Monitor Uniswap V2/V3, StellaSwap, BeamSwap pools
- Track USDC, USDT, DAI pairs

### Future Substrate Chains
- PAPI for Hydration, Acala, etc.
- Abstract pool interface for cross-chain compatibility

## Liquidity Pool Monitoring

### Features
- Real-time price feeds from multiple DEXs
- Gas cost estimation
- Slippage calculation
- Pool depth analysis

### Data Points to Track
- Token pairs and reserves
- Trading fees
- Historical volatility
- Current gas prices

## AI Agent Architecture

### Tools for the Agent
- `getPriceQuote(tokenA, tokenB, amount, dex)`
- `calculateArbitragePath(paths[])`
- `estimateGasCost(transaction)`
- `getHistoricalPrices(pair, timeframe)`
- `simulateTransaction(path, amount)`

### Decision Factors
- Profit margin after fees and gas
- Success probability
- Market volatility
- Competition (MEV considerations)

## AI Learning & Self-Improvement System

### Persistent Memory Architecture
```typescript
interface AIMemory {
  strategies: StrategyRecord[]
  mistakes: MistakeRecord[]
  successPatterns: PatternRecord[]
  marketConditions: ConditionRecord[]
  promptVersions: PromptVersion[]
}
```

### Learning Components

1. **Post-Trade Analysis**
   - After each trade (success or failure), trigger reflection
   - Analyze: expected vs actual outcome, market conditions, decision factors
   - Store insights in persistent database (PostgreSQL/SQLite)

2. **Mistake Classification**
   ```typescript
   type MistakeType = 
     | "false_positive" // Saw opportunity that wasn't there
     | "missed_opportunity" // Failed to see profitable trade
     | "execution_failure" // Good decision, poor execution
     | "market_misread" // Misunderstood market conditions
     | "gas_miscalculation" // Underestimated transaction costs
   ```

3. **Self-Improvement Mechanisms**
   - Version control for AI prompts
   - A/B test different prompt versions
   - Automatically adopt better-performing prompts
   - Pattern matching against successful trades

4. **Learning Triggers**
   - Immediate: After each trade execution
   - Periodic: Daily/weekly strategy review
   - Threshold: When success rate drops below target

## Evaluation Framework

### Metrics to Track
- Total profit/loss
- Success rate
- Average profit per trade
- Gas efficiency
- Opportunity detection accuracy
- False positive rate

### Testing Capabilities
- Historical data backtesting
- Simulated trading mode
- A/B testing different strategies

## Implementation Phases

### Phase 1: Foundation ✅
- Set up Effect service structure
- Implement Viem connector for Moonbeam
- Create basic pool monitoring for one DEX

### Phase 2: Core Arbitrage ✅
- Multi-DEX monitoring
- Simple arbitrage detection
- Transaction execution

### Phase 3: AI Integration
- Implement AI agent with basic tools
- Add evaluation framework
- Performance tracking

### Phase 4: Terminal User Interface (TUI)
- Real-time dashboard with system metrics
- Balance and P&L tracking
- Pool/chain/asset monitoring stats
- Live opportunity detection and execution feedback
- Transaction history viewer
- Interactive controls (pause/resume, adjust parameters)

#### TUI Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ Arbitrage Bot v1.0.0          Status: Running       [Q]uit [P]ause│
├─────────────────────────────────────────────────────────────────┤
│ Balance    │ P&L        │ Pools │ Chains │ Assets │ Opportunities│
│ $10,250.42 │ +$250.42   │  45   │   1    │   5    │      3       │
│            │ (+2.50%)   │       │        │        │              │
├─────────────────────────────────────────────────────────────────┤
│ Live Opportunities                                               │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ USDC→WGLMR  StellaSwap→BeamSwap  +0.45%  Testing...  ⟳  │   │
│ │ DAI→USDT   BeamSwap→Solarflare   +0.32%  Waiting...     │   │
│ │ WGLMR→FRAX StellaSwap→BeamSwap   +0.28%  Waiting...     │   │
│ └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ Recent Activity                                                  │
│ [10:45:23] ✓ Executed USDC→DAI for +$12.34 profit              │
│ [10:44:01] ✗ Failed WGLMR→USDT - Gas price too high            │
│ [10:42:15] ✓ Executed FRAX→USDC for +$8.91 profit             │
└─────────────────────────────────────────────────────────────────┘
```

#### TUI Components
1. **Header**: App name, status, controls
2. **Metrics Bar**: Key performance indicators
3. **Live Opportunities**: Real-time opportunity tracking with status
4. **Activity Log**: Recent transactions and events
5. **Controls**: Keyboard shortcuts for interaction

### Phase 5: Advanced Features
- Multi-hop arbitrage
- Cross-chain preparation
- Advanced AI strategies