import { Box, Text } from "ink"
import React from "react"

interface HeaderProps {
  status: "running" | "paused" | "stopped"
  expandedView: "none" | "chains" | "assets" | "pools"
  isLive: boolean
}

export const Header: React.FC<HeaderProps> = ({ status, expandedView, isLive }) => {
  const statusColor = status === "running" ? "green" : status === "paused" ? "yellow" : "red"
  const statusText = status.charAt(0).toUpperCase() + status.slice(1)

  const getExpandControls = () => {
    const chains = expandedView === "chains" ? <Text color="cyan">[C]hains</Text> : "[C]hains"
    const assets = expandedView === "assets" ? <Text color="cyan">[A]ssets</Text> : "[A]ssets"
    const pools = expandedView === "pools" ? <Text color="cyan">Poo[L]s</Text> : "Poo[L]s"

    return (
      <>
        {chains} {assets} {pools}
      </>
    )
  }

  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between" width="100%">
      <Box gap={2}>
        <Text>
          <Text bold color="cyan">
            Arbitrage Bot
          </Text>{" "}
          v1.0.0
        </Text>
        <Text>
          Mode:{" "}
          <Text color={isLive ? "green" : "yellow"} bold>
            {isLive ? "LIVE" : "DRY RUN"}
          </Text>
        </Text>
      </Box>
      <Box gap={2}>
        <Text>
          Status:{" "}
          <Text color={statusColor} bold>
            {statusText}
          </Text>
        </Text>
        <Text dimColor>
          {status === "running" && (
            <>
              [Q]uit [P]ause {!isLive && "[G]o Live (Exit Dry Run)"} | {getExpandControls()}
            </>
          )}
          {status === "paused" && (
            <>
              [Q]uit [R]esume {!isLive && "[G]o Live (Exit Dry Run)"} | {getExpandControls()}
            </>
          )}
          {status === "stopped" && "Shutting down..."}
        </Text>
      </Box>
    </Box>
  )
}
