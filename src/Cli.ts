import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { Console, Duration, Effect, Option } from "effect"
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
    live: Options.boolean("live").pipe(
      Options.withDescription("Enable live trading (exit dry run mode)"),
      Options.withDefault(false),
    ),
    tui: Options.boolean("tui").pipe(
      Options.withDescription("Enable Terminal User Interface"),
      Options.withDefault(false),
    ),
    rpcUrl: Options.text("rpc-url").pipe(
      Options.withDescription("Moonbeam RPC URL"),
      Options.withDefault("https://rpc.api.moonbeam.network"),
    ),
    privateKey: Options.text("private-key").pipe(
      Options.withDescription("Private key for executing trades (enables live trading)"),
      Options.optional,
    ),
  },
  ({ interval, minProfit, live, tui, rpcUrl, privateKey }) =>
    Effect.gen(function* () {
      if (!tui) {
        yield* Console.log("Starting Arbites - Arbitrage Trading Bot")
        yield* Console.log(`Update interval: ${interval}s`)
        yield* Console.log(`Minimum profit: ${minProfit}%`)
        yield* Console.log(`Mode: ${live ? "LIVE TRADING" : "DRY RUN"}`)
        yield* Console.log(
          `Execution: ${Option.isSome(privateKey) ? "ENABLED" : "DISABLED (no private key)"}`,
        )
      }

      // Keep the service running
      yield* Effect.never
    }).pipe(
      Effect.provide(
        ArbitrageServiceLive.Live(
          Option.match(privateKey, {
            onNone: () => ({
              updateInterval: Duration.seconds(interval),
              minProfitPercentage: parseFloat(minProfit),
              moonbeamRpcUrl: rpcUrl,
              dryRun: !live,
              enableTui: tui,
            }),
            onSome: (pk) => ({
              updateInterval: Duration.seconds(interval),
              minProfitPercentage: parseFloat(minProfit),
              moonbeamRpcUrl: rpcUrl,
              dryRun: !live,
              enableTui: tui,
              execution: {
                walletAddress: "0x0000000000000000000000000000000000000000", // TODO: derive from private key
                privateKey: pk,
                slippageTolerance: 50, // 0.5% = 50 basis points
                maxGasPrice: BigInt("50000000000"), // 50 gwei
              },
            }),
          }),
        ),
      ),
    ),
)

// Create the main command with subcommands
const command = Command.make("arbites").pipe(Command.withSubcommands([run, test]))

export { command as cli }

export const mainRun = Command.run(command, {
  name: "Arbites - Polkadot Ecosystem Arbitrage Bot",
  version: "1.0.0",
})
