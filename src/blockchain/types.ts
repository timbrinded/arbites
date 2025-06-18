import type { Effect } from "effect"

export interface Token {
  readonly address: string
  readonly symbol: string
  readonly decimals: number
  readonly chainId: number
}

export interface PoolReserves {
  readonly token0: Token
  readonly token1: Token
  readonly reserve0: bigint
  readonly reserve1: bigint
  readonly fee: number // basis points (e.g., 30 = 0.3%)
}

export interface PriceQuote {
  readonly inputAmount: bigint
  readonly outputAmount: bigint
  readonly priceImpact: number // percentage
  readonly route: readonly string[]
}

export interface Transaction {
  readonly to: string
  readonly data: string
  readonly value: bigint
  readonly gasLimit: bigint
}

// TODO: Use syntax like: export class HttpError extends Data.TaggedError("HttpError")<{}> {}
export class BlockchainError extends Error {
  readonly _tag = "BlockchainError"
}

export class InsufficientLiquidityError extends Error {
  readonly _tag = "InsufficientLiquidityError"
}

export interface BlockchainConnector {
  readonly getBlockNumber: () => Effect.Effect<bigint, BlockchainError>

  readonly getBalance: (address: string, token?: Token) => Effect.Effect<bigint, BlockchainError>

  readonly getPoolReserves: (poolAddress: string) => Effect.Effect<PoolReserves, BlockchainError>

  readonly getPriceQuote: (
    tokenIn: Token,
    tokenOut: Token,
    amountIn: bigint,
    dexAddress: string,
  ) => Effect.Effect<PriceQuote, BlockchainError | InsufficientLiquidityError>

  readonly estimateGas: (transaction: Transaction) => Effect.Effect<bigint, BlockchainError>

  readonly sendTransaction: (
    transaction: Transaction,
    privateKey: string,
  ) => Effect.Effect<string, BlockchainError>
}
