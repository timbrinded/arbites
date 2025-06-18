import { Data, type Effect } from "effect"
import type { PoolReserves, Token } from "../blockchain/types.js"

export interface ArbitrageOpportunity {
  readonly buyDex: string
  readonly sellDex: string
  readonly tokenIn: Token
  readonly tokenOut: Token
  readonly amountIn: bigint
  readonly expectedProfit: bigint
  readonly profitPercentage: number
  readonly gasEstimate: bigint
  readonly netProfit: bigint
}

export interface PoolInfo {
  readonly address: string
  readonly dexName: string
  readonly reserves: PoolReserves
  readonly lastUpdate: Date
}

export interface PriceData {
  readonly token0: Token
  readonly token1: Token
  readonly price0To1: number
  readonly price1To0: number
  readonly dexName: string
  readonly poolAddress: string
}

export class MonitoringError extends Data.TaggedError("MonitoringError")<{
  readonly reason: string
  readonly poolAddress?: string
  readonly cause?: unknown
}> {}

export interface PoolMonitor {
  readonly addPool: (poolAddress: string, dexName: string) => Effect.Effect<void, MonitoringError>

  readonly removePool: (poolAddress: string) => Effect.Effect<void, MonitoringError>

  readonly updatePools: () => Effect.Effect<readonly PoolInfo[], MonitoringError>

  readonly getPrices: (
    token0: Token,
    token1: Token,
  ) => Effect.Effect<readonly PriceData[], MonitoringError>

  readonly findArbitrageOpportunities: (
    minProfitPercentage: number,
  ) => Effect.Effect<readonly ArbitrageOpportunity[], MonitoringError>
}
