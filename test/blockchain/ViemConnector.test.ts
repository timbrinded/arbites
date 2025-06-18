import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import type { BlockchainConnector, Token } from "../../src/blockchain/types.js"
import { ViemConnectorLive } from "../../src/blockchain/ViemConnector.js"

// Mock tokens for testing
const MOCK_USDC: Token = {
  address: "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b", // Real USDC on Moonbeam
  symbol: "USDC",
  decimals: 6,
  chainId: 1284,
}

const _MOCK_GLMR: Token = {
  address: "0x0000000000000000000000000000000000000802", // WGLMR on Moonbeam
  symbol: "WGLMR",
  decimals: 18,
  chainId: 1284,
}

describe("ViemConnector", () => {
  // Use a public RPC endpoint for testing
  const testConfig = {
    rpcUrl: "https://rpc.api.moonbeam.network",
    chainId: 1284,
  }

  const runTest = <A, E>(effect: Effect.Effect<A, E, BlockchainConnector>) =>
    Effect.runPromise(effect.pipe(Effect.provide(ViemConnectorLive.Live(testConfig))))

  it("should get the current block number", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const connector = yield* ViemConnectorLive
        const blockNumber = yield* connector.getBlockNumber()
        return blockNumber
      }),
    )

    expect(result).toBeGreaterThan(0n)
  })

  it("should get native balance", async () => {
    const testAddress = "0x0000000000000000000000000000000000000000"

    const result = await runTest(
      Effect.gen(function* () {
        const connector = yield* ViemConnectorLive
        const balance = yield* connector.getBalance(testAddress)
        return balance
      }),
    )

    expect(result).toBeGreaterThanOrEqual(0n)
  })

  it("should get token balance", async () => {
    const testAddress = "0x0000000000000000000000000000000000000000"

    const result = await runTest(
      Effect.gen(function* () {
        const connector = yield* ViemConnectorLive
        const balance = yield* connector.getBalance(testAddress, MOCK_USDC)
        return balance
      }),
    )

    expect(result).toBeGreaterThanOrEqual(0n)
  })

  it("should handle errors gracefully", async () => {
    const invalidAddress = "not-an-address"

    const result = await runTest(
      Effect.gen(function* () {
        const connector = yield* ViemConnectorLive
        return yield* Effect.either(connector.getBalance(invalidAddress))
      }),
    )

    expect(result._tag).toBe("Left")
  })
})
