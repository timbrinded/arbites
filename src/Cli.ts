import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { Console, Duration, Effect } from "effect"
import { ArbitrageServiceLive } from "./services/ArbitrageService.js"

// Commands
const test = Command.make("test", {}, () => Console.log("All systems operational!"))

const run = Command.make(
  "run",
  {
    interval: Options.integer("interval").pipe(Options.withDefault(30)),
    minProfit: Options.text("min-profit").pipe(Options.withDefault("0.5")),
    dryRun: Options.boolean("dry-run").pipe(Options.withDefault(true)),
  },
  ({ interval, minProfit, dryRun }) =>
    Effect.gen(function* () {
      yield* Console.log("Starting Arbites - Arbitrage Trading Bot")
      yield* Console.log(`Update interval: ${interval}s`)
      yield* Console.log(`Minimum profit: ${minProfit}%`)
      yield* Console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE TRADING"}`)

      // Keep the service running
      yield* Effect.never
    }).pipe(
      Effect.provide(
        ArbitrageServiceLive.Live({
          updateInterval: Duration.seconds(interval),
          minProfitPercentage: parseFloat(minProfit),
          moonbeamRpcUrl: "https://rpc.api.moonbeam.network",
          dryRun,
        }),
      ),
    ),
)

const command = run.pipe(Command.withSubcommands([test]))

export { run as cli }

export const mainRun = Command.run(command, {
  name: "Arbites - Polkadot Ecosystem Arbitrage Bot",
  version: "1.0.0",
})
