import { Effect, HashMap, Layer, Ref } from "effect"
import type { Token } from "../blockchain/types.js"
import { ViemConnectorLive } from "../blockchain/ViemConnector.js"
import type { ArbitrageOpportunity, PoolInfo, PoolMonitor, PriceData } from "./types.js"
import { MonitoringError } from "./types.js"

interface PoolEntry {
  readonly address: string
  readonly dexName: string
  readonly info?: PoolInfo
}

export const makePoolMonitor = Effect.gen(function* () {
  const connector = yield* ViemConnectorLive
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
          Effect.fail(new MonitoringError(`Failed to update pools: ${error}`)),
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
  } satisfies PoolMonitor
})

function isSameToken(token1: Token, token2: Token): boolean {
  return (
    token1.address.toLowerCase() === token2.address.toLowerCase() &&
    token1.chainId === token2.chainId
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
  const [first, second] =
    token0.address.toLowerCase() < token1.address.toLowerCase()
      ? [token0, token1]
      : [token1, token0]
  return `${first.address}-${second.address}`
}

export class PoolMonitorLive extends Effect.Tag("PoolMonitor")<PoolMonitorLive, PoolMonitor>() {
  static readonly Live = Layer.effect(this, makePoolMonitor)
}
