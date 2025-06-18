import { Box, Text } from "ink"
import React from "react"
import type { AssetInfo, BotState, ChainInfo, PoolInfo } from "../BotState.js"

interface ExpandedViewProps {
  view: BotState["expandedView"]
  chains: readonly ChainInfo[]
  assets: readonly AssetInfo[]
  pools: readonly PoolInfo[]
  isLive: boolean
}

const ChainView: React.FC<{ chains: readonly ChainInfo[] }> = ({ chains }) => (
  <Box flexDirection="column" paddingX={1}>
    <Box marginBottom={1}>
      <Text bold underline>
        Chains ({chains.length})
      </Text>
    </Box>
    {chains.length === 0 ? (
      <Text dimColor>No chains connected...</Text>
    ) : (
      <Box flexDirection="column" gap={1}>
        {chains.map((chain) => (
          <Box key={chain.chainId} gap={3}>
            <Box width={15}>
              <Text color="cyan">{chain.name}</Text>
            </Box>
            <Box width={15}>
              <Text>ID: {chain.chainId}</Text>
            </Box>
            <Box width={20}>
              <Text color={chain.latency < 100 ? "green" : chain.latency < 500 ? "yellow" : "red"}>
                Latency: {chain.latency}ms
              </Text>
            </Box>
            <Box>
              <Text dimColor>Updated: {formatTime(chain.lastUpdated)}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    )}
  </Box>
)

const AssetView: React.FC<{ assets: readonly AssetInfo[] }> = ({ assets }) => (
  <Box flexDirection="column" paddingX={1}>
    <Box marginBottom={1}>
      <Text bold underline>
        Assets ({assets.length})
      </Text>
    </Box>
    {assets.length === 0 ? (
      <Text dimColor>No assets tracked...</Text>
    ) : (
      <Box flexDirection="column" gap={1}>
        {assets.map((asset) => (
          <Box key={asset.token.address} gap={3}>
            <Box width={10}>
              <Text color="cyan">{asset.token.symbol}</Text>
            </Box>
            <Box width={20}>
              <Text>Balance: {formatBalance(asset.balance, asset.token.decimals)}</Text>
            </Box>
            <Box width={15}>
              <Text color="green">
                $
                {((Number(asset.balance) / 10 ** asset.token.decimals) * asset.priceUSD).toFixed(2)}
              </Text>
            </Box>
            <Box width={15}>
              <Text dimColor>${asset.priceUSD.toFixed(4)}/token</Text>
            </Box>
            <Box>
              <Text dimColor>Updated: {formatTime(asset.lastUpdated)}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    )}
  </Box>
)

const PoolView: React.FC<{ pools: readonly PoolInfo[] }> = ({ pools }) => (
  <Box flexDirection="column" paddingX={1}>
    <Box marginBottom={1}>
      <Text bold underline>
        Pools ({pools.length})
      </Text>
    </Box>
    {pools.length === 0 ? (
      <Text dimColor>No pools monitored...</Text>
    ) : (
      <Box flexDirection="column" gap={1}>
        {pools.slice(0, 20).map((pool) => (
          <Box key={pool.id} gap={2}>
            <Box width={15}>
              <Text color="cyan">
                {pool.tokenA.symbol}/{pool.tokenB.symbol}
              </Text>
            </Box>
            <Box width={12}>
              <Text>{pool.dex}</Text>
            </Box>
            <Box width={15}>
              <Text color="green">TVL: ${formatNumber(pool.tvlUSD)}</Text>
            </Box>
            <Box width={25}>
              <Text dimColor>
                {formatBalance(pool.reserveA, pool.tokenA.decimals)} /{" "}
                {formatBalance(pool.reserveB, pool.tokenB.decimals)}
              </Text>
            </Box>
            <Box>
              <Text dimColor>Updated: {formatTime(pool.lastUpdated)}</Text>
            </Box>
          </Box>
        ))}
        {pools.length > 20 && <Text dimColor>...and {pools.length - 20} more pools</Text>}
      </Box>
    )}
  </Box>
)

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 1000) return "just now"
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

const formatBalance = (amount: bigint, decimals: number): string => {
  const divisor = BigInt(10 ** decimals)
  const whole = amount / divisor
  const fraction = amount % divisor
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2)
  return `${whole}.${fractionStr}`
}

const formatNumber = (num: number): string => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
  return num.toFixed(2)
}

export const ExpandedView: React.FC<ExpandedViewProps> = ({
  view,
  chains,
  assets,
  pools,
  isLive,
}) => {
  return (
    <Box flexDirection="column" borderStyle="single" minHeight={20}>
      <Box justifyContent="flex-end" paddingX={1}>
        <Text dimColor>
          Data Source:{" "}
          <Text color={isLive ? "green" : "yellow"}>{isLive ? "LIVE" : "DRY RUN"}</Text>
        </Text>
      </Box>
      {view === "chains" && <ChainView chains={chains} />}
      {view === "assets" && <AssetView assets={assets} />}
      {view === "pools" && <PoolView pools={pools} />}
    </Box>
  )
}
