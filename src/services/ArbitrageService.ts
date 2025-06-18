import { Console, type Duration, Effect, Layer, Schedule } from "effect"
import { ViemConnectorLive } from "../blockchain/ViemConnector.js"
import { PoolMonitorLive } from "../monitoring/PoolMonitor.js"
import type { ArbitrageOpportunity } from "../monitoring/types.js"

export interface ArbitrageConfig {
  readonly updateInterval: Duration.Duration
  readonly minProfitPercentage: number
  readonly moonbeamRpcUrl: string
  readonly dryRun: boolean
}

export const makeArbitrageService = (config: ArbitrageConfig) =>
  Effect.gen(function* () {
    const monitor = yield* PoolMonitorLive

    // Add initial pools (this would come from config in production)
    const pools = [
      { address: "0xb13B281503F6ec8a837ae1A21e86d8C0E01Db08e", name: "StellaSwap" },
      { address: "0x555B74dAFC4Ef3A5A1640041e3244460Dc7dE242", name: "BeamSwap" },
      // Add more pools as needed
    ]

    yield* Effect.forEach(pools, (pool) => monitor.addPool(pool.address, pool.name), {
      concurrency: "unbounded",
    })

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

        if (!config.dryRun) {
          // TODO: Execute trades
          yield* Console.log("Trade execution not yet implemented")
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
      Layer.provide(PoolMonitorLive.Live),
      Layer.provide(
        ViemConnectorLive.Live({
          rpcUrl: config.moonbeamRpcUrl,
          chainId: 1284,
        }),
      ),
    )
}
