import { Box, Text } from "ink"
import type React from "react"

interface HeaderProps {
  status: "running" | "paused" | "stopped"
}

export const Header: React.FC<HeaderProps> = ({ status }) => {
  const statusColor = status === "running" ? "green" : status === "paused" ? "yellow" : "red"
  const statusText = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between" width="100%">
      <Text>
        <Text bold color="cyan">
          Arbitrage Bot
        </Text>{" "}
        v1.0.0
      </Text>
      <Box gap={2}>
        <Text>
          Status:{" "}
          <Text color={statusColor} bold>
            {statusText}
          </Text>
        </Text>
        <Text dimColor>[Q]uit [P]ause [R]esume</Text>
      </Box>
    </Box>
  )
}
