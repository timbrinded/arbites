import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { Console, Duration, Effect } from "effect"
import { ArbitrageServiceLive } from "./services/ArbitrageService.js"

// Commands
const test = Command.make("test", {}, () => Console.log("All systems operational!"))

const run = Command.make(
  "run",
  {
    interval: Options.integer("interval").pipe(
      Options.withDescription("Update interval in seconds"),
      Options.withDefault(30),
    ),
    minProfit: Options.text("min-profit").pipe(
      Options.withDescription("Minimum profit percentage"),
      Options.withDefault("0.5"),
    ),
    dryRun: Options.boolean("dry-run").pipe(
      Options.withDescription("Run without executing trades"),
      Options.withDefault(true),
    ),
    tui: Options.boolean("tui").pipe(
      Options.withDescription("Enable Terminal User Interface"),
      Options.withDefault(false),
    ),
    rpcUrl: Options.text("rpc-url").pipe(
      Options.withDescription("Moonbeam RPC URL"),
      Options.withDefault("https://rpc.api.moonbeam.network"),
    ),
  },
  ({ interval, minProfit, dryRun, tui, rpcUrl }) =>
    Effect.gen(function* () {
      if (!tui) {
        yield* Console.log("Starting Arbites - Arbitrage Trading Bot")
        yield* Console.log(`Update interval: ${interval}s`)
        yield* Console.log(`Minimum profit: ${minProfit}%`)
        yield* Console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE TRADING"}`)
      }

      // Keep the service running
      yield* Effect.never
    }).pipe(
      Effect.provide(
        ArbitrageServiceLive.Live({
          updateInterval: Duration.seconds(interval),
          minProfitPercentage: parseFloat(minProfit),
          moonbeamRpcUrl: rpcUrl,
          dryRun,
          enableTui: tui,
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
