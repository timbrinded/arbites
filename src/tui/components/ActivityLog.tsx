import { Box, Text } from "ink"
import type React from "react"
import type { ActivityEntry } from "../BotState.js"

interface ActivityLogProps {
  activities: readonly ActivityEntry[]
}

const ActivityRow: React.FC<{ activity: ActivityEntry }> = ({ activity }) => {
  const timeStr = activity.timestamp.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const icon = activity.type === "success" ? "✓" : activity.type === "failure" ? "✗" : "ℹ"

  const color = activity.type === "success" ? "green" : activity.type === "failure" ? "red" : "blue"

  return (
    <Box gap={1}>
      <Text dimColor>[{timeStr}]</Text>
      <Text color={color}>{icon}</Text>
      <Text>{activity.message}</Text>
    </Box>
  )
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ activities }) => {
  // Show last 5 activities
  const recentActivities = activities.slice(-5).reverse()

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold>Recent Activity</Text>
      <Box flexDirection="column" paddingTop={1} height={6}>
        {recentActivities.length === 0 ? (
          <Text dimColor>No recent activity...</Text>
        ) : (
          recentActivities.map((activity) => <ActivityRow key={activity.id} activity={activity} />)
        )}
      </Box>
    </Box>
  )
}
