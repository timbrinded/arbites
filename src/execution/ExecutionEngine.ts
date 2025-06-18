import { Console, Effect, Layer } from "effect"
import type { Token, TransactionReceipt } from "../blockchain/types.js"
import { ViemConnectorLive } from "../blockchain/ViemConnector.js"
import { DexRegistryLive } from "../dex/DexRegistry.js"
import type { ArbitrageOpportunity } from "../monitoring/types.js"
import { TransactionBuilderLive } from "./TransactionBuilder.js"

export interface ExecutionConfig {
  readonly walletAddress: string
  readonly privateKey: string
  readonly slippageTolerance: number // basis points
  readonly maxGasPrice: bigint // wei
}

export interface ExecutionResult {
  readonly opportunity: ArbitrageOpportunity
  readonly approvalTx?: TransactionReceipt
  readonly swapTx?: TransactionReceipt
  readonly actualProfit?: bigint
  readonly status: "success" | "failed" | "skipped"
  readonly reason?: string
}

export interface ExecutionEngine {
  readonly executeArbitrage: (opportunity: ArbitrageOpportunity) => Effect.Effect<ExecutionResult>
  readonly executeOpportunities: (
    opportunities: readonly ArbitrageOpportunity[],
  ) => Effect.Effect<readonly ExecutionResult[]>
}

export const makeExecutionEngine = (config: ExecutionConfig): Effect.Effect<ExecutionEngine> =>
  Effect.gen(function* () {
    const connector = yield* ViemConnectorLive
    const txBuilder = yield* TransactionBuilderLive
    const dexRegistry = yield* DexRegistryLive

    const checkAllowance = (_token: Token, _spender: string) => Effect.succeed(0n) // For now, assume we need approval

    const executeArbitrage = (opportunity: ArbitrageOpportunity): Effect.Effect<ExecutionResult> =>
      Effect.gen(function* () {
        yield* Console.log(
          `Executing arbitrage for ${opportunity.tokenIn.symbol} -> ${opportunity.tokenOut.symbol}`,
        )

        // Get DEX info
        const buyDex = dexRegistry.getDex(opportunity.buyDex)
        const sellDex = dexRegistry.getDex(opportunity.sellDex)

        if (!buyDex || !sellDex) {
          return {
            opportunity,
            status: "failed",
            reason: "DEX not found in registry",
          }
        }

        // Check gas price
        const currentGasPrice = yield* Effect.tryPromise({
          try: () => Promise.resolve(20n * 10n ** 9n), // 20 gwei placeholder
          catch: () => new Error("Failed to get gas price"),
        })

        if (currentGasPrice > config.maxGasPrice) {
          return {
            opportunity,
            status: "skipped",
            reason: `Gas price too high: ${currentGasPrice} > ${config.maxGasPrice}`,
          }
        }

        // Check if we need token approval
        const allowance = yield* checkAllowance(opportunity.tokenIn, buyDex.routerAddress)
        let approvalTx: TransactionReceipt | undefined

        if (allowance < opportunity.amountIn) {
          yield* Console.log("Approving token spend...")
          const approvalTransaction = txBuilder.buildApprovalTransaction(
            opportunity.tokenIn,
            buyDex.routerAddress,
            opportunity.amountIn,
          )

          approvalTx = yield* connector.sendTransaction(approvalTransaction, config.privateKey)
          yield* Console.log(`Approval transaction: ${approvalTx.hash}`)
        }

        // Execute the swap
        yield* Console.log("Executing swap...")
        const swapTransaction = txBuilder.buildSwapTransaction(
          opportunity,
          buyDex.routerAddress,
          config.walletAddress,
          config.slippageTolerance,
        )

        const swapTx = yield* connector.sendTransaction(swapTransaction, config.privateKey)
        yield* Console.log(`Swap transaction: ${swapTx.hash}`)

        // Calculate actual profit (would need to parse logs in production)
        const actualProfit = opportunity.expectedProfit - swapTx.gasUsed * currentGasPrice

        return {
          opportunity,
          approvalTx,
          swapTx,
          actualProfit,
          status: "success",
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.succeed({
            opportunity,
            status: "failed" as const,
            reason: String(error),
          }),
        ),
      )

    const executeOpportunities = (opportunities: readonly ArbitrageOpportunity[]) =>
      Effect.gen(function* () {
        if (opportunities.length === 0) {
          yield* Console.log("No opportunities to execute")
          return []
        }

        // Sort by profit and execute the best one
        const sorted = [...opportunities].sort((a, b) => Number(b.netProfit - a.netProfit))

        // Execute only the best opportunity to avoid conflicts
        const best = sorted[0]
        yield* Console.log(
          `Executing best opportunity: ${best.tokenIn.symbol} -> ${best.tokenOut.symbol} ` +
            `for ${best.profitPercentage.toFixed(2)}% profit`,
        )

        const result = yield* executeArbitrage(best)
        return [result]
      })

    return {
      executeArbitrage,
      executeOpportunities,
    } satisfies ExecutionEngine
  })

export class ExecutionEngineLive extends Effect.Tag("ExecutionEngine")<
  ExecutionEngineLive,
  ExecutionEngine
>() {
  static readonly Live = (config: ExecutionConfig) =>
    Layer.effect(this, makeExecutionEngine(config)).pipe(
      Layer.provide(TransactionBuilderLive.Live),
      Layer.provide(DexRegistryLive.Live),
    )
}
