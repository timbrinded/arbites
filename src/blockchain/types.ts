import { Data, Effect, Schema } from "effect"

// Token as a Data.Class for better equality checking and hashing
export class Token extends Data.Class<{
  readonly address: string
  readonly symbol: string
  readonly decimals: number
  readonly chainId: number
}> {
  // Normalize address to lowercase for consistent comparison
  static make(props: {
    address: string
    symbol: string
    decimals: number
    chainId: number
  }): Token {
    return new Token({
      ...props,
      address: props.address.toLowerCase(),
    })
  }
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

export interface TransactionReceipt {
  readonly hash: string
  readonly blockNumber: bigint
  readonly gasUsed: bigint
  readonly status: "success" | "reverted"
  readonly logs?: readonly Log[]
}

export interface Log {
  readonly address: string
  readonly topics: readonly string[]
  readonly data: string
}

// Error types
export class BlockchainError extends Data.TaggedError("BlockchainError")<{
  readonly reason: string
  readonly cause?: unknown
}> {}

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly reason: string
  readonly statusCode?: number
  readonly url?: string
  readonly cause?: unknown
}> {}

export class ContractError extends Data.TaggedError("ContractError")<{
  readonly contractAddress: string
  readonly method: string
  readonly reason: string
  readonly params?: unknown
}> {}

export class InsufficientLiquidityError extends Data.TaggedError("InsufficientLiquidityError")<{
  readonly tokenIn: Token
  readonly tokenOut: Token
  readonly requestedAmount: bigint
}> {}

// Schema definitions for runtime validation
export const TokenSchema = Schema.transformOrFail(
  Schema.Struct({
    address: Schema.String,
    symbol: Schema.String,
    decimals: Schema.Number,
    chainId: Schema.Number,
  }),
  Schema.instanceOf(Token),
  {
    decode: (input) => Effect.succeed(Token.make(input)),
    encode: (token) =>
      Effect.succeed({
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        chainId: token.chainId,
      }),
  },
)

export const PoolReservesSchema = Schema.Struct({
  token0: TokenSchema,
  token1: TokenSchema,
  reserve0: Schema.BigIntFromSelf,
  reserve1: Schema.BigIntFromSelf,
  fee: Schema.Number,
})

export const TransactionReceiptSchema = Schema.Struct({
  hash: Schema.String,
  blockNumber: Schema.BigIntFromSelf,
  gasUsed: Schema.BigIntFromSelf,
  status: Schema.Literal("success", "reverted"),
  logs: Schema.optional(
    Schema.Array(
      Schema.Struct({
        address: Schema.String,
        topics: Schema.Array(Schema.String),
        data: Schema.String,
      }),
    ),
  ),
})

export interface BlockchainConnector {
  readonly getBlockNumber: () => Effect.Effect<bigint, BlockchainError | NetworkError>

  readonly getBalance: (
    address: string,
    token?: Token,
  ) => Effect.Effect<bigint, BlockchainError | NetworkError | ContractError>

  readonly getPoolReserves: (
    poolAddress: string,
  ) => Effect.Effect<PoolReserves, BlockchainError | NetworkError | ContractError>

  readonly getPriceQuote: (
    tokenIn: Token,
    tokenOut: Token,
    amountIn: bigint,
    dexAddress: string,
  ) => Effect.Effect<PriceQuote, BlockchainError | InsufficientLiquidityError | ContractError>

  readonly estimateGas: (
    transaction: Transaction,
  ) => Effect.Effect<bigint, BlockchainError | NetworkError>

  readonly sendTransaction: (
    transaction: Transaction,
    privateKey: string,
  ) => Effect.Effect<TransactionReceipt, BlockchainError | NetworkError>

  readonly waitForTransaction: (
    txHash: string,
    confirmations?: number,
  ) => Effect.Effect<TransactionReceipt, BlockchainError | NetworkError>
}
