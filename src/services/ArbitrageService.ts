import { Console, type Duration, Effect, Layer, Schedule } from "effect"
import { Token } from "../blockchain/types.js"
import { ViemConnectorLive } from "../blockchain/ViemConnector.js"
import type { ExecutionConfig } from "../execution/ExecutionEngine.js"
import { ExecutionEngineLive } from "../execution/ExecutionEngine.js"
import { PoolMonitorLive } from "../monitoring/PoolMonitor.js"
import type { ArbitrageOpportunity } from "../monitoring/types.js"
import { TuiServiceLive } from "../tui/TuiService.js"

export interface ArbitrageConfig {
  readonly updateInterval: Duration.Duration
  readonly minProfitPercentage: number
  readonly moonbeamRpcUrl: string
  readonly dryRun: boolean
  readonly execution?: ExecutionConfig
  readonly enableTui?: boolean
}

export const makeArbitrageService = (config: ArbitrageConfig) =>
  Effect.gen(function* () {
    const monitor = yield* PoolMonitorLive
    const tui = config.enableTui ? yield* TuiServiceLive : null

    // Start TUI if enabled
    if (tui) {
      yield* tui.start()
    }

    // Discover all pools from registered DEXs
    const poolCount = yield* monitor.discoverAllPools()

    // Update TUI with pool count
    if (tui) {
      yield* tui.updatePoolCount(poolCount)
      // Update assets (common tokens we monitor)
      const commonTokens = [
        Token.make({
          address: "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b",
          symbol: "USDC",
          decimals: 6,
          chainId: 1284,
        }),
        Token.make({
          address: "0xeFAeeE334F0Fd1712f9a8cc375f427D9Cdd40d73",
          symbol: "USDT",
          decimals: 6,
          chainId: 1284,
        }),
        Token.make({
          address: "0x765277EebeCA2e31912C9946eAe1021199B39C61",
          symbol: "DAI",
          decimals: 18,
          chainId: 1284,
        }),
        Token.make({
          address: "0xAcc15dC74880C9944775448304B263D191c6077F",
          symbol: "WGLMR",
          decimals: 18,
          chainId: 1284,
        }),
        Token.make({
          address: "0x322E86852e492a7Ee17f28a78c663da38FB33bfb",
          symbol: "FRAX",
          decimals: 18,
          chainId: 1284,
        }),
      ]
      yield* tui.updateAssets(commonTokens)
    } else {
      yield* Console.log(`Discovered ${poolCount} pools across all DEXs`)
    }

    const checkForOpportunities = Effect.gen(function* () {
      if (!tui) {
        yield* Console.log("Updating pool data...")
      }

      // Update all pool data
      const poolInfos = yield* monitor.updatePools()

      if (!tui) {
        yield* Console.log(`Updated ${poolInfos.length} pools`)
      }

      // Find arbitrage opportunities
      const opportunities = yield* monitor.findArbitrageOpportunities(config.minProfitPercentage)

      if (opportunities.length === 0) {
        if (!tui) {
          yield* Console.log("No arbitrage opportunities found")
        }
      } else {
        if (!tui) {
          yield* Console.log(`Found ${opportunities.length} arbitrage opportunities`)
          yield* Effect.forEach(opportunities, (opp) => logOpportunity(opp), {
            concurrency: "unbounded",
          })
        } else {
          // Report opportunities to TUI
          yield* Effect.forEach(opportunities, (opp) => tui.reportOpportunity(opp), {
            concurrency: "unbounded",
          })
        }

        if (!config.dryRun && config.execution) {
          const executionEngine = yield* ExecutionEngineLive

          // Update opportunity status in TUI
          if (tui && opportunities.length > 0) {
            yield* tui.updateOpportunityStatus(opportunities[0], "testing")
          }

          const results = yield* executionEngine.executeOpportunities(opportunities)

          if (tui) {
            // Report results to TUI
            yield* Effect.forEach(results, (result) => tui.reportExecution(result), {
              concurrency: "unbounded",
            })
          } else {
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
          }
        } else if (!config.dryRun && !tui) {
          yield* Console.log("Execution config not provided, skipping trades")
        }
      }
    })

    // Run the service on a schedule
    return yield* checkForOpportunities.pipe(
      Effect.repeat(Schedule.fixed(config.updateInterval)),
      Effect.catchAllCause((cause) => {
        if (!tui) {
          return Console.error("Arbitrage service error:", cause).pipe(Effect.as(void 0))
        }
        // Don't log errors when TUI is active (they'll be shown in the UI)
        return Effect.void
      }),
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
  static readonly Live = (config: ArbitrageConfig) => {
    // First create the ViemConnector layer which is needed by other services
    const viemLayer = ViemConnectorLive.Live({
      rpcUrl: config.moonbeamRpcUrl,
      chainId: 1284,
    })

    // Create the other layers
    const poolMonitorLayer = PoolMonitorLive.Live.pipe(Layer.provide(viemLayer))
    const executionLayer = config.execution
      ? ExecutionEngineLive.Live(config.execution).pipe(Layer.provide(viemLayer))
      : Layer.empty
    const tuiLayer = config.enableTui ? TuiServiceLive.Live : Layer.empty

    return Layer.scoped(
      this,
      Effect.gen(function* () {
        if (!config.enableTui) {
          yield* Console.log("Starting arbitrage service...")
        }
        yield* makeArbitrageService(config).pipe(Effect.forkScoped)
        return {}
      }),
    ).pipe(Layer.provide(Layer.mergeAll(poolMonitorLayer, viemLayer, executionLayer, tuiLayer)))
  }
}
