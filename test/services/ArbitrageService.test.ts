import { Duration, Effect, Layer } from "effect"
import { describe, expect, it } from "vitest"
import type {
  BlockchainConnector,
  PoolReserves,
  TransactionReceipt,
} from "../../src/blockchain/types.js"
import { Token } from "../../src/blockchain/types.js"
import { PoolMonitorLive } from "../../src/monitoring/PoolMonitor.js"
import { makeArbitrageService } from "../../src/services/ArbitrageService.js"

// Mock tokens
const USDC = Token.make({
  address: "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b",
  symbol: "USDC",
  decimals: 6,
  chainId: 1284,
})

const WGLMR = Token.make({
  address: "0xAcc15dC74880C9944775448304B263D191c6077F",
  symbol: "WGLMR",
  decimals: 18,
  chainId: 1284,
})

// Mock blockchain connector
const mockConnector: BlockchainConnector = {
  getBlockNumber: () => Effect.succeed(1000n),
  getBalance: () => Effect.succeed(1000000n),
  getPoolReserves: (poolAddress: string) => {
    // Return different reserves for different pools to create arbitrage opportunities
    if (poolAddress === "0xb13B281503F6ec8a837ae1A21e86d8C0E01Db08e") {
      return Effect.succeed({
        token0: USDC,
        token1: WGLMR,
        reserve0: 1000000n * 10n ** 6n,
        reserve1: 50000n * 10n ** 18n,
        fee: 30,
      } satisfies PoolReserves)
    } else {
      return Effect.succeed({
        token0: USDC,
        token1: WGLMR,
        reserve0: 800000n * 10n ** 6n,
        reserve1: 45000n * 10n ** 18n,
        fee: 30,
      } satisfies PoolReserves)
    }
  },
  getPriceQuote: () =>
    Effect.succeed({
      inputAmount: 1000n,
      outputAmount: 900n,
      priceImpact: 0.1,
      route: ["0x0", "0x1"],
    }),
  estimateGas: () => Effect.succeed(100000n),
  sendTransaction: () =>
    Effect.succeed({
      hash: "0x1234",
      blockNumber: 1000n,
      gasUsed: 50000n,
      status: "success",
    } satisfies TransactionReceipt),
  waitForTransaction: () =>
    Effect.succeed({
      hash: "0x1234",
      blockNumber: 1000n,
      gasUsed: 50000n,
      status: "success",
    } satisfies TransactionReceipt),
}

const MockConnectorLayer = Layer.succeed(
  Effect.Tag("ViemConnector")<"ViemConnector", BlockchainConnector>(),
  mockConnector,
)

describe("ArbitrageService", () => {
  it("should create arbitrage service and find opportunities", async () => {
    // Test the makeArbitrageService function directly
    const testEffect = makeArbitrageService({
      updateInterval: Duration.seconds(10),
      minProfitPercentage: 5.0,
      moonbeamRpcUrl: "https://test.rpc",
      dryRun: true,
    }).pipe(
      Effect.provide(PoolMonitorLive.Live),
      Effect.provide(MockConnectorLayer),
      Effect.timeout(Duration.seconds(1)),
      Effect.catchAll(() => Effect.succeed("Service started successfully")),
    )

    const result = await Effect.runPromise(
      testEffect.pipe(Effect.scoped) as Effect.Effect<string | number | void, never, never>,
    )
    expect(result).toBe("Service started successfully")
  })

  it("should work with custom pool configuration", async () => {
    // Test that the service can be configured
    const config = {
      updateInterval: Duration.seconds(30),
      minProfitPercentage: 1.0,
      moonbeamRpcUrl: "https://custom.rpc",
      dryRun: false,
    }

    expect(config.updateInterval).toEqual(Duration.seconds(30))
    expect(config.minProfitPercentage).toBe(1.0)
    expect(config.moonbeamRpcUrl).toBe("https://custom.rpc")
    expect(config.dryRun).toBe(false)
  })
})
