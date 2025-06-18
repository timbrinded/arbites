import { Box, Text } from "ink"
import Spinner from "ink-spinner"
import type React from "react"
import type { OpportunityStatus } from "../BotState.js"

interface OpportunitiesViewProps {
  opportunities: readonly OpportunityStatus[]
}

const OpportunityRow: React.FC<{ opportunity: OpportunityStatus }> = ({ opportunity }) => {
  const { tokenIn, tokenOut, buyDex, sellDex, profitPercentage } = opportunity.opportunity

  const statusDisplay = () => {
    switch (opportunity.status) {
      case "pending":
        return <Text dimColor>Waiting...</Text>
      case "testing":
        return (
          <Text color="yellow">
            <Spinner type="dots" /> Testing...
          </Text>
        )
      case "executing":
        return (
          <Text color="blue">
            <Spinner type="dots" /> Executing...
          </Text>
        )
      case "completed":
        return <Text color="green">✓ Success</Text>
      case "failed":
        return <Text color="red">✗ {opportunity.reason || "Failed"}</Text>
    }
  }

  return (
    <Box gap={2} paddingX={1}>
      <Box width={15}>
        <Text>
          {tokenIn.symbol}→{tokenOut.symbol}
        </Text>
      </Box>
      <Box width={25}>
        <Text dimColor>
          {buyDex}→{sellDex}
        </Text>
      </Box>
      <Box width={10}>
        <Text color="green">+{profitPercentage.toFixed(2)}%</Text>
      </Box>
      <Box width={20}>{statusDisplay()}</Box>
    </Box>
  )
}

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({ opportunities }) => {
  const activeOpportunities = opportunities.filter(
    (o) => o.status !== "completed" && o.status !== "failed",
  )

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold>Live Opportunities</Text>
      <Box height={8} flexDirection="column" paddingTop={1}>
        {activeOpportunities.length === 0 ? (
          <Text dimColor>No active opportunities...</Text>
        ) : (
          activeOpportunities.map((opp) => <OpportunityRow key={opp.id} opportunity={opp} />)
        )}
      </Box>
    </Box>
  )
}
