import { Box, Text } from "ink"
import React from "react"
import type { BotMetrics } from "../BotState.js"

interface MetricsBarProps {
  metrics: BotMetrics
}

const MetricBox: React.FC<{ label: string; value: string; subValue?: string }> = ({
  label,
  value,
  subValue,
}) => (
  <Box flexDirection="column" paddingX={1}>
    <Text dimColor>{label}</Text>
    <Text bold>{value}</Text>
    {subValue && <Text dimColor>{subValue}</Text>}
  </Box>
)

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  const formatBalance = (balance: bigint) => {
    const value = Number(balance) / 1e6 // Assuming USDC with 6 decimals
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatPL = (pl: bigint, percentage: number) => {
    const value = Number(pl) / 1e6
    const sign = value >= 0 ? "+" : ""
    const color = value >= 0 ? "green" : "red"
    return (
      <Text color={color}>
        {sign}${Math.abs(value).toFixed(2)} ({sign}
        {percentage.toFixed(2)}%)
      </Text>
    )
  }

  return (
    <Box borderStyle="single" paddingX={1} gap={2}>
      <MetricBox label="Balance" value={formatBalance(metrics.balance)} />
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>P&L</Text>
        {formatPL(metrics.profitLoss, metrics.profitLossPercentage)}
      </Box>
      <MetricBox label="Pools" value={metrics.poolsMonitored.toString()} />
      <MetricBox label="Chains" value={metrics.chainsMonitored.toString()} />
      <MetricBox label="Assets" value={metrics.assetsMonitored.length.toString()} />
      <MetricBox
        label="Opportunities"
        value={metrics.opportunitiesDetected.toString()}
        subValue={`✓${metrics.successfulTrades} ✗${metrics.failedTrades}`}
      />
    </Box>
  )
}
