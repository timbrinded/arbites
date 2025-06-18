import { Console, type Duration, Effect, Layer, Ref, Schedule } from "effect"
import { Token } from "../blockchain/types.js"
import { ViemConnectorLive } from "../blockchain/ViemConnector.js"
import type { ExecutionConfig } from "../execution/ExecutionEngine.js"
import { ExecutionEngineLive } from "../execution/ExecutionEngine.js"
import { PoolMonitorLive } from "../monitoring/PoolMonitor.js"
import type { ArbitrageOpportunity } from "../monitoring/types.js"
import { AssetInfo, ChainInfo, PoolInfo } from "../tui/BotState.js"
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

    // Use dryRun to determine if we're in live mode
    // dryRun = true means mock mode (no real trades)
    // dryRun = false means live mode (real trades possible)
    let isLive = !config.dryRun

    // Start TUI if enabled
    if (tui) {
      yield* tui.start()
      yield* tui.setIsLive(isLive)

      // Set up the go live callback - only allow if we have execution config
      yield* Ref.set(tui.onGoLiveRequested, () =>
        Effect.gen(function* () {
          if (config.dryRun && !config.execution) {
            yield* Console.log(
              "Cannot go live: No execution config provided. Run with --private-key to enable live trading.",
            )
            return
          }

          yield* Console.log("Exiting dry run mode! Enabling live trading...")
          isLive = true
          yield* tui.setIsLive(true)

          // Update status - no need to update chain info
        }),
      )
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

      // Update chain info
      const chainInfo = new ChainInfo({
        chainId: 1284,
        name: "Moonbeam",
        latency: 0,
        lastUpdated: new Date(),
      })
      yield* tui.updateChainInfo([chainInfo])

      // Update asset info with mock or real balances
      if (!isLive) {
        // Mock data
        const assetInfo = commonTokens.map(
          (token) =>
            new AssetInfo({
              token,
              balance: BigInt(Math.floor(Math.random() * 10000)) * BigInt(10 ** token.decimals),
              priceUSD:
                token.symbol === "USDC" || token.symbol === "USDT"
                  ? 1.0
                  : token.symbol === "DAI"
                    ? 0.999
                    : token.symbol === "WGLMR"
                      ? 0.25
                      : 1.02,
              lastUpdated: new Date(),
            }),
        )
        yield* tui.updateAssetInfo(assetInfo)
      } else {
        // TODO: Fetch real balances when live
        const assetInfo = commonTokens.map(
          (token) =>
            new AssetInfo({
              token,
              balance: 0n, // Would fetch real balance
              priceUSD: 1.0, // Would fetch real price
              lastUpdated: new Date(),
            }),
        )
        yield* tui.updateAssetInfo(assetInfo)
      }
    } else {
      yield* Console.log(`Discovered ${poolCount} pools across all DEXs`)
    }

    const checkForOpportunities = Effect.gen(function* () {
      if (!tui) {
        yield* Console.log("Updating pool data...")
      }

      // Measure chain latency
      const startTime = Date.now()

      // Update all pool data (mock or real)
      const poolInfos = isLive ? yield* monitor.updatePools() : yield* Effect.succeed([]) // Mock - no real pools

      const latency = Date.now() - startTime

      if (tui) {
        // Update chain info with latency
        const chainInfo = new ChainInfo({
          chainId: 1284,
          name: "Moonbeam",
          latency: isLive ? latency : Math.floor(Math.random() * 50) + 10, // Mock latency 10-60ms
          lastUpdated: new Date(),
        })
        yield* tui.updateChainInfo([chainInfo])

        // Update pool info for TUI
        const poolData = poolInfos.slice(0, 50).map((pool) => {
          const tvl = calculateTVL({
            tokenA: pool.reserves.token0,
            tokenB: pool.reserves.token1,
            reserveA: pool.reserves.reserve0,
            reserveB: pool.reserves.reserve1,
          })
          return new PoolInfo({
            id: `${pool.dexName}-${pool.address.slice(0, 8)}`,
            dex: pool.dexName,
            tokenA: pool.reserves.token0,
            tokenB: pool.reserves.token1,
            reserveA: pool.reserves.reserve0,
            reserveB: pool.reserves.reserve1,
            tvlUSD: tvl,
            lastUpdated: pool.lastUpdate,
          })
        })
        yield* tui.updatePoolInfo(poolData)
      } else {
        yield* Console.log(`Updated ${poolInfos.length} pools`)
      }

      // Find arbitrage opportunities (mock or real)
      const opportunities = isLive
        ? yield* monitor.findArbitrageOpportunities(config.minProfitPercentage)
        : [] // No opportunities in mock mode

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

        // Only execute trades if we're live (not in dry run) and have execution config
        if (isLive && config.execution) {
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
        } else if (isLive && !config.execution) {
          yield* Console.log("Live mode but no execution config provided, skipping trades")
        } else if (!isLive && opportunities.length > 0) {
          if (!tui) {
            yield* Console.log("Dry run mode - would execute trades but skipping")
          }
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

const calculateTVL = (pool: {
  tokenA: Token
  tokenB: Token
  reserveA: bigint
  reserveB: bigint
}) => {
  // Simple TVL calculation assuming token prices
  const tokenPrices: Record<string, number> = {
    USDC: 1.0,
    USDT: 1.0,
    DAI: 0.999,
    WGLMR: 0.25,
    FRAX: 1.02,
  }

  const priceA = tokenPrices[pool.tokenA.symbol] || 1.0
  const priceB = tokenPrices[pool.tokenB.symbol] || 1.0

  const valueA = (Number(pool.reserveA) / 10 ** pool.tokenA.decimals) * priceA
  const valueB = (Number(pool.reserveB) / 10 ** pool.tokenB.decimals) * priceB

  return valueA + valueB
}

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
