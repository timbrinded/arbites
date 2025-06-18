import { Effect, HashMap, Layer, Ref } from "effect"
import { describe, expect, it } from "vitest"
import type { BlockchainConnector, PoolReserves, Token } from "../../src/blockchain/types.js"
import { BlockchainError } from "../../src/blockchain/types.js"
import { PoolMonitorLive } from "../../src/monitoring/PoolMonitor.js"
import type { PoolMonitor } from "../../src/monitoring/types.js"

// Mock tokens for testing
const USDC: Token = {
  address: "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b",
  symbol: "USDC",
  decimals: 6,
  chainId: 1284,
}

const WGLMR: Token = {
  address: "0xAcc15dC74880C9944775448304B263D191c6077F",
  symbol: "WGLMR",
  decimals: 18,
  chainId: 1284,
}

// Mock blockchain connector for testing
const makeMockConnector = () =>
  Effect.gen(function* () {
    const poolData = yield* Ref.make(HashMap.empty<string, PoolReserves>())

    // Pre-populate with test data
    yield* Ref.update(poolData, (map) =>
      HashMap.set(map, "0x0000000000000000000000000000000000000001", {
        token0: USDC,
        token1: WGLMR,
        reserve0: 1000000n * 10n ** 6n, // 1M USDC
        reserve1: 50000n * 10n ** 18n, // 50K WGLMR
        fee: 30,
      }),
    )

    yield* Ref.update(poolData, (map) =>
      HashMap.set(map, "0x0000000000000000000000000000000000000002", {
        token0: USDC,
        token1: WGLMR,
        reserve0: 800000n * 10n ** 6n, // 800K USDC
        reserve1: 45000n * 10n ** 18n, // 45K WGLMR (different price)
        fee: 30,
      }),
    )

    return {
      getBlockNumber: () => Effect.succeed(1000n),
      getBalance: () => Effect.succeed(1000000n),
      getPoolReserves: (poolAddress: string) =>
        Effect.gen(function* () {
          const pools = yield* Ref.get(poolData)
          const pool = HashMap.get(pools, poolAddress)
          if (pool._tag === "None") {
            return yield* Effect.fail(new BlockchainError("Pool not found"))
          }
          return pool.value
        }),
      getPriceQuote: () =>
        Effect.succeed({
          inputAmount: 1000n,
          outputAmount: 900n,
          priceImpact: 0.1,
          route: ["0x0", "0x1"],
        }),
      estimateGas: () => Effect.succeed(100000n),
      sendTransaction: () => Effect.succeed("0x1234"),
    } satisfies BlockchainConnector
  })

const MockConnectorLayer = Layer.effect(
  Effect.Tag("ViemConnector")<"ViemConnector", BlockchainConnector>(),
  makeMockConnector(),
)

describe("PoolMonitor", () => {
  const testLayer = PoolMonitorLive.Live.pipe(Layer.provide(MockConnectorLayer))

  const runTest = <A, E>(effect: Effect.Effect<A, E, PoolMonitor>) =>
    Effect.runPromise(effect.pipe(Effect.provide(testLayer)))

  it("should add and update pools", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const monitor = yield* PoolMonitorLive

        // Add pools
        yield* monitor.addPool("0x0000000000000000000000000000000000000001", "MockDEX1")
        yield* monitor.addPool("0x0000000000000000000000000000000000000002", "MockDEX2")

        // Update pool data
        const pools = yield* monitor.updatePools()

        return pools
      }),
    )

    expect(result).toHaveLength(2)
    expect(result[0].dexName).toBe("MockDEX1")
    expect(result[0].reserves.reserve0).toBe(1000000n * 10n ** 6n)
    expect(result[0].reserves.reserve1).toBe(50000n * 10n ** 18n)
  })

  it("should get prices for token pairs", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const monitor = yield* PoolMonitorLive

        // Add pools
        yield* monitor.addPool("0x0000000000000000000000000000000000000001", "MockDEX1")
        yield* monitor.addPool("0x0000000000000000000000000000000000000002", "MockDEX2")
        yield* monitor.updatePools()

        // Get prices
        const prices = yield* monitor.getPrices(USDC, WGLMR)

        return prices
      }),
    )

    expect(result).toHaveLength(2)
    expect(result[0].price0To1).toBeGreaterThan(0)
    expect(result[0].price1To0).toBeGreaterThan(0)
    expect(result[0].dexName).toBeDefined()
  })

  it("should remove pools", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const monitor = yield* PoolMonitorLive

        // Add and then remove a pool
        yield* monitor.addPool("0x0000000000000000000000000000000000000001", "MockDEX1")
        yield* monitor.removePool("0x0000000000000000000000000000000000000001")

        // Update should return empty array
        const pools = yield* monitor.updatePools()

        return pools
      }),
    )

    expect(result).toHaveLength(0)
  })

  it("should find arbitrage opportunities", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const monitor = yield* PoolMonitorLive

        // Add pools with different prices
        yield* monitor.addPool("0x0000000000000000000000000000000000000001", "MockDEX1")
        yield* monitor.addPool("0x0000000000000000000000000000000000000002", "MockDEX2")
        yield* monitor.updatePools()

        const opportunities = yield* monitor.findArbitrageOpportunities(5.0) // 5% minimum profit

        return opportunities
      }),
    )

    // With different prices between DEXs, there should be opportunities
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].profitPercentage).toBeGreaterThan(5.0)
  })
})
