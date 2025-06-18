import { Console, type Duration, Effect, Layer, Schedule } from "effect"
import { ViemConnectorLive } from "../blockchain/ViemConnector.js"
import type { ExecutionConfig } from "../execution/ExecutionEngine.js"
import { ExecutionEngineLive } from "../execution/ExecutionEngine.js"
import { PoolMonitorLive } from "../monitoring/PoolMonitor.js"
import type { ArbitrageOpportunity } from "../monitoring/types.js"

export interface ArbitrageConfig {
  readonly updateInterval: Duration.Duration
  readonly minProfitPercentage: number
  readonly moonbeamRpcUrl: string
  readonly dryRun: boolean
  readonly execution?: ExecutionConfig
}

export const makeArbitrageService = (config: ArbitrageConfig) =>
  Effect.gen(function* () {
    const monitor = yield* PoolMonitorLive

    // Discover all pools from registered DEXs
    const poolCount = yield* monitor.discoverAllPools()
    yield* Console.log(`Discovered ${poolCount} pools across all DEXs`)

    const checkForOpportunities = Effect.gen(function* () {
      yield* Console.log("Updating pool data...")

      // Update all pool data
      const poolInfos = yield* monitor.updatePools()
      yield* Console.log(`Updated ${poolInfos.length} pools`)

      // Find arbitrage opportunities
      const opportunities = yield* monitor.findArbitrageOpportunities(config.minProfitPercentage)

      if (opportunities.length === 0) {
        yield* Console.log("No arbitrage opportunities found")
      } else {
        yield* Console.log(`Found ${opportunities.length} arbitrage opportunities`)
        yield* Effect.forEach(opportunities, (opp) => logOpportunity(opp), {
          concurrency: "unbounded",
        })

        if (!config.dryRun && config.execution) {
          const executionEngine = yield* ExecutionEngineLive
          const results = yield* executionEngine.executeOpportunities(opportunities)

          yield* Effect.forEach(
            results,
            (result) =>
              Console.log(
                `Execution result: ${result.status} - ` +
                  `${result.opportunity.tokenIn.symbol} -> ${result.opportunity.tokenOut.symbol}` +
                  (result.reason ? ` (${result.reason})` : ""),
              ),
            { concurrency: "unbounded" },
          )
        } else if (!config.dryRun) {
          yield* Console.log("Execution config not provided, skipping trades")
        }
      }
    })

    // Run the service on a schedule
    return yield* checkForOpportunities.pipe(
      Effect.repeat(Schedule.fixed(config.updateInterval)),
      Effect.catchAllCause((cause) =>
        Console.error("Arbitrage service error:", cause).pipe(Effect.as(void 0)),
      ),
    )
  })

const logOpportunity = (opp: ArbitrageOpportunity) =>
  Console.log(
    `Opportunity: Buy ${opp.tokenIn.symbol} on ${opp.buyDex}, ` +
      `sell on ${opp.sellDex} for ${opp.profitPercentage.toFixed(2)}% profit`,
  )

export class ArbitrageServiceLive extends Effect.Tag("ArbitrageService")<
  ArbitrageServiceLive,
  {}
>() {
  static readonly Live = (config: ArbitrageConfig) =>
    Layer.scoped(
      this,
      Effect.gen(function* () {
        yield* Console.log("Starting arbitrage service...")
        yield* makeArbitrageService(config).pipe(Effect.forkScoped)
        return {}
      }),
    ).pipe(
      Layer.provide(
        Layer.mergeAll(
          PoolMonitorLive.Live,
          ViemConnectorLive.Live({
            rpcUrl: config.moonbeamRpcUrl,
            chainId: 1284,
          }),
          config.execution ? ExecutionEngineLive.Live(config.execution) : Layer.empty,
        ),
      ),
    )
}
