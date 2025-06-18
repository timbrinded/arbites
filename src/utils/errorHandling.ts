import { Effect, Match, Schedule } from "effect"
import type {
  BlockchainError,
  ContractError,
  InsufficientLiquidityError,
  NetworkError,
} from "../blockchain/types.js"
import type { MonitoringError } from "../monitoring/types.js"

/**
 * Example of handling errors with pattern matching
 */
export const handleArbitrageError = <A>(
  effect: Effect.Effect<
    A,
    BlockchainError | InsufficientLiquidityError | MonitoringError | NetworkError | ContractError
  >,
) =>
  effect.pipe(
    Effect.catchAll((error) =>
      Match.value(error).pipe(
        Match.tag("BlockchainError", (e) =>
          Effect.logError(`Blockchain error: ${e.reason}`, e.cause).pipe(Effect.as(null as A)),
        ),
        Match.tag("InsufficientLiquidityError", (e) =>
          Effect.logWarning(
            `Insufficient liquidity for ${e.tokenIn.symbol} -> ${e.tokenOut.symbol}, amount: ${e.requestedAmount}`,
          ).pipe(Effect.as(null as A)),
        ),
        Match.tag("MonitoringError", (e) =>
          Effect.logError(`Monitoring error: ${e.reason}`, {
            poolAddress: e.poolAddress,
            cause: e.cause,
          }).pipe(Effect.as(null as A)),
        ),
        Match.tag("NetworkError", (e) =>
          Effect.logError(`Network error: ${e.reason}`, {
            statusCode: e.statusCode,
            url: e.url,
          }).pipe(Effect.as(null as A)),
        ),
        Match.tag("ContractError", (e) =>
          Effect.logError(`Contract error: ${e.reason}`, {
            contractAddress: e.contractAddress,
            method: e.method,
            params: e.params,
          }).pipe(Effect.as(null as A)),
        ),
        Match.exhaustive,
      ),
    ),
  )

/**
 * Example of retrying with specific error handling
 */
export const retryOnBlockchainError = <A, E>(effect: Effect.Effect<A, E | BlockchainError>) =>
  effect.pipe(
    Effect.retry({
      while: (error) => {
        if (
          error &&
          typeof error === "object" &&
          "_tag" in error &&
          error._tag === "BlockchainError"
        ) {
          // Retry blockchain errors up to 3 times
          return true
        }
        return false
      },
      times: 3,
      schedule: Schedule.exponential("100 millis"),
    }),
  )

/**
 * Example of error recovery
 */
export const recoverFromLiquidityError = <A>(
  effect: Effect.Effect<A, InsufficientLiquidityError>,
  fallback: A,
) =>
  effect.pipe(
    Effect.catchTag("InsufficientLiquidityError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logWarning(
          `Recovering from liquidity error: ${error.tokenIn.symbol} -> ${error.tokenOut.symbol}`,
        )
        return fallback
      }),
    ),
  )
