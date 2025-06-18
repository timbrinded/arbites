import { Effect, HashMap, Layer, Ref } from "effect"
import { Token } from "../blockchain/types.js"
import { ViemConnectorLive } from "../blockchain/ViemConnector.js"
import { DexRegistryLive } from "../dex/DexRegistry.js"
import type { DexInfo } from "../dex/types.js"
import { computePoolAddress, DEX_INIT_CODE_HASHES } from "../utils/poolAddress.js"
import type { ArbitrageOpportunity, PoolInfo, PoolMonitor, PriceData } from "./types.js"
import { MonitoringError } from "./types.js"

interface PoolEntry {
  readonly address: string
  readonly dexName: string
  readonly info?: PoolInfo
}

export const makePoolMonitor = Effect.gen(function* () {
  const connector = yield* ViemConnectorLive
  const dexRegistry = yield* DexRegistryLive
  const poolsRef = yield* Ref.make(HashMap.empty<string, PoolEntry>())

  const addPool = (poolAddress: string, dexName: string) =>
    Ref.update(poolsRef, (pools) =>
      HashMap.set(pools, poolAddress, { address: poolAddress, dexName }),
    )

  const removePool = (poolAddress: string) =>
    Ref.update(poolsRef, (pools) => HashMap.remove(pools, poolAddress))

  const updatePools = () =>
    Effect.gen(function* () {
      const pools = yield* Ref.get(poolsRef)
      const entries = Array.from(HashMap.values(pools))

      const updates = yield* Effect.forEach(
        entries,
        (entry) =>
          Effect.gen(function* () {
            const reserves = yield* connector.getPoolReserves(entry.address)
            const info: PoolInfo = {
              address: entry.address,
              dexName: entry.dexName,
              reserves,
              lastUpdate: new Date(),
            }
            return [entry.address, { ...entry, info }] as const
          }),
        { concurrency: 5 },
      ).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new MonitoringError({
              reason: "Failed to update pools",
              cause: error,
            }),
          ),
        ),
      )

      yield* Ref.set(poolsRef, HashMap.fromIterable(updates.map(([addr, entry]) => [addr, entry])))

      return updates.map(([_, entry]) => entry.info!).filter(Boolean)
    })

  const getPrices = (token0: Token, token1: Token) =>
    Effect.gen(function* () {
      const pools = yield* Ref.get(poolsRef)
      const poolInfos = Array.from(HashMap.values(pools))
        .filter((p) => p.info !== undefined)
        .map((p) => p.info!)

      const relevantPools = poolInfos.filter((pool) => {
        const { reserves } = pool
        return (
          (isSameToken(reserves.token0, token0) && isSameToken(reserves.token1, token1)) ||
          (isSameToken(reserves.token0, token1) && isSameToken(reserves.token1, token0))
        )
      })

      return relevantPools.map((pool): PriceData => {
        const { reserves } = pool
        const isReversed = isSameToken(reserves.token0, token1)

        const [actualToken0, actualToken1, reserve0, reserve1] = isReversed
          ? [reserves.token1, reserves.token0, reserves.reserve1, reserves.reserve0]
          : [reserves.token0, reserves.token1, reserves.reserve0, reserves.reserve1]

        const price0To1 = calculatePrice(
          reserve0,
          reserve1,
          actualToken0.decimals,
          actualToken1.decimals,
        )
        const price1To0 = calculatePrice(
          reserve1,
          reserve0,
          actualToken1.decimals,
          actualToken0.decimals,
        )

        return {
          token0: actualToken0,
          token1: actualToken1,
          price0To1,
          price1To0,
          dexName: pool.dexName,
          poolAddress: pool.address,
        }
      })
    })

  const addPoolsFromDex = (dexInfo: DexInfo, tokenPairs: readonly [Token, Token][]) =>
    Effect.gen(function* () {
      // For each token pair, calculate the pool address
      const poolAddresses = tokenPairs.map(([token0, token1]) => {
        // Get the appropriate init code hash for this DEX
        const initCodeHash =
          DEX_INIT_CODE_HASHES[dexInfo.name.toLowerCase() as keyof typeof DEX_INIT_CODE_HASHES] ||
          DEX_INIT_CODE_HASHES.stellaswap // Default to stellaswap if not found

        const poolAddress = computePoolAddress(dexInfo.factoryAddress, token0, token1, initCodeHash)
        return poolAddress
      })

      // Add all pools to monitoring
      yield* Effect.forEach(poolAddresses, (address) => addPool(address, dexInfo.name), {
        concurrency: 5,
      })

      return poolAddresses.length
    })

  const discoverAllPools = () =>
    Effect.gen(function* () {
      const allDexes = dexRegistry.getAllDexes()

      // Common token pairs to monitor on Moonbeam
      const commonTokens = [
        { address: "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b", symbol: "USDC", decimals: 6 },
        { address: "0xeFAeeE334F0Fd1712f9a8cc375f427D9Cdd40d73", symbol: "USDT", decimals: 6 },
        { address: "0x765277EebeCA2e31912C9946eAe1021199B39C61", symbol: "DAI", decimals: 18 },
        { address: "0xAcc15dC74880C9944775448304B263D191c6077F", symbol: "WGLMR", decimals: 18 },
        { address: "0x322E86852e492a7Ee17f28a78c663da38FB33bfb", symbol: "FRAX", decimals: 18 },
      ].map((t) => Token.make({ ...t, chainId: 1284 }))

      // Create pairs
      const pairs: [Token, Token][] = []
      for (let i = 0; i < commonTokens.length; i++) {
        for (let j = i + 1; j < commonTokens.length; j++) {
          pairs.push([commonTokens[i], commonTokens[j]])
        }
      }

      // Add pools from all DEXs
      const results = yield* Effect.forEach(allDexes, (dex) => addPoolsFromDex(dex, pairs), {
        concurrency: 3,
      })

      return results.reduce((sum, count) => sum + count, 0)
    })

  const findArbitrageOpportunities = (minProfitPercentage: number) =>
    Effect.gen(function* () {
      const pools = yield* Ref.get(poolsRef)
      const poolInfos = Array.from(HashMap.values(pools))
        .filter((p) => p.info !== undefined)
        .map((p) => p.info!)

      const opportunities: ArbitrageOpportunity[] = []

      // Group pools by token pairs
      const poolsByPair = new Map<string, PoolInfo[]>()

      for (const pool of poolInfos) {
        const pairKey = getPairKey(pool.reserves.token0, pool.reserves.token1)
        const existing = poolsByPair.get(pairKey) || []
        existing.push(pool)
        poolsByPair.set(pairKey, existing)
      }

      // Find arbitrage opportunities between different DEXs for the same pair
      for (const [_pairKey, pools] of poolsByPair) {
        if (pools.length < 2) continue

        for (let i = 0; i < pools.length; i++) {
          for (let j = i + 1; j < pools.length; j++) {
            const pool1 = pools[i]
            const pool2 = pools[j]

            // Calculate prices for both pools
            const price1_0to1 = calculatePrice(
              pool1.reserves.reserve0,
              pool1.reserves.reserve1,
              pool1.reserves.token0.decimals,
              pool1.reserves.token1.decimals,
            )

            const price2_0to1 = calculatePrice(
              pool2.reserves.reserve0,
              pool2.reserves.reserve1,
              pool2.reserves.token0.decimals,
              pool2.reserves.token1.decimals,
            )

            const priceDiff = Math.abs(price1_0to1 - price2_0to1)
            const avgPrice = (price1_0to1 + price2_0to1) / 2
            const profitPercentage = (priceDiff / avgPrice) * 100

            if (profitPercentage >= minProfitPercentage) {
              // Determine buy/sell direction
              const [buyPool, sellPool] =
                price1_0to1 < price2_0to1 ? [pool1, pool2] : [pool2, pool1]

              // Calculate optimal trade amount (simplified - should use more sophisticated calculation)
              const testAmount = 1000n * 10n ** BigInt(buyPool.reserves.token0.decimals) // 1000 tokens

              const opportunity: ArbitrageOpportunity = {
                buyDex: buyPool.dexName,
                sellDex: sellPool.dexName,
                tokenIn: buyPool.reserves.token0,
                tokenOut: buyPool.reserves.token1,
                amountIn: testAmount,
                expectedProfit: 0n, // TODO: Calculate actual profit
                profitPercentage,
                gasEstimate: 200000n, // Placeholder
                netProfit: 0n, // TODO: Calculate net profit after gas
              }

              opportunities.push(opportunity)
            }
          }
        }
      }

      return opportunities
    })

  return {
    addPool,
    removePool,
    updatePools,
    getPrices,
    findArbitrageOpportunities,
    discoverAllPools,
  } satisfies PoolMonitor
})

function isSameToken(token1: Token, token2: Token): boolean {
  // Token equality is now handled by Data.Class
  return (
    token1 === token2 || (token1.address === token2.address && token1.chainId === token2.chainId)
  )
}

function calculatePrice(
  reserve0: bigint,
  reserve1: bigint,
  decimals0: number,
  decimals1: number,
): number {
  const adjustedReserve0 = Number(reserve0) / 10 ** decimals0
  const adjustedReserve1 = Number(reserve1) / 10 ** decimals1
  return adjustedReserve1 / adjustedReserve0
}

function getPairKey(token0: Token, token1: Token): string {
  const [first, second] = token0.address < token1.address ? [token0, token1] : [token1, token0]
  return `${first.address}-${second.address}`
}

export class PoolMonitorLive extends Effect.Tag("PoolMonitor")<PoolMonitorLive, PoolMonitor>() {
  static readonly Live = Layer.effect(this, makePoolMonitor).pipe(
    Layer.provide(DexRegistryLive.Live),
  )
}
