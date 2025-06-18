import { Effect } from "effect"
import { Box, useApp, useInput } from "ink"
import type React from "react"
import { useEffect, useState } from "react"
import type { BotState } from "./BotState.js"
import { ActivityLog } from "./components/ActivityLog.js"
import { Header } from "./components/Header.js"
import { MetricsBar } from "./components/MetricsBar.js"
import { OpportunitiesView } from "./components/OpportunitiesView.js"

interface AppProps {
  initialState: BotState
  onPause: () => Effect.Effect<void>
  onResume: () => Effect.Effect<void>
  onQuit: () => Effect.Effect<void>
  stateStream: AsyncIterable<BotState>
}

export const App: React.FC<AppProps> = ({
  initialState,
  onPause,
  onResume,
  onQuit,
  stateStream,
}) => {
  const { exit } = useApp()
  const [state, setState] = useState<BotState>(initialState)

  // Subscribe to state updates
  useEffect(() => {
    let cancelled = false

    const updateState = async () => {
      for await (const newState of stateStream) {
        if (cancelled) break
        setState(newState)
      }
    }

    updateState().catch(console.error)

    return () => {
      cancelled = true
    }
  }, [stateStream])

  // Handle keyboard input
  useInput((input, _key) => {
    if (input === "q" || input === "Q") {
      Effect.runPromise(onQuit()).then(() => exit())
    } else if (input === "p" || input === "P") {
      if (state.status === "running") {
        Effect.runPromise(onPause())
      }
    } else if (input === "r" || input === "R") {
      if (state.status === "paused") {
        Effect.runPromise(onResume())
      }
    }
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Header status={state.status} />
      <MetricsBar metrics={state.metrics} />
      <OpportunitiesView opportunities={state.opportunities} />
      <ActivityLog activities={state.activityHistory} />
    </Box>
  )
}
