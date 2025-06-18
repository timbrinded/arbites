import { Box, useApp, useInput } from "ink"
import React, { useEffect, useState } from "react"
import type { BotState } from "./BotState.js"
import { ActivityLog } from "./components/ActivityLog.js"
import { ExpandedView } from "./components/ExpandedView.js"
import { Header } from "./components/Header.js"
import { MetricsBar } from "./components/MetricsBar.js"
import { OpportunitiesView } from "./components/OpportunitiesView.js"

interface AppProps {
  initialState: BotState
  onPause: () => void
  onResume: () => void
  onQuit: () => void
  onToggleExpand: (view: BotState["expandedView"]) => void
  onGoLive: () => void
  stateStream: AsyncIterable<BotState>
}

export const App: React.FC<AppProps> = ({
  initialState,
  onPause,
  onResume,
  onQuit,
  onToggleExpand,
  onGoLive,
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
      onQuit()
      exit()
    } else if (input === "p" || input === "P") {
      if (state.status === "running") {
        onPause()
      }
    } else if (input === "r" || input === "R") {
      if (state.status === "paused") {
        onResume()
      }
    } else if (input === "g" || input === "G") {
      if (!state.isLive) {
        onGoLive()
      }
    } else if (input === "c" || input === "C") {
      onToggleExpand(state.expandedView === "chains" ? "none" : "chains")
    } else if (input === "a" || input === "A") {
      onToggleExpand(state.expandedView === "assets" ? "none" : "assets")
    } else if (input === "l" || input === "L") {
      onToggleExpand(state.expandedView === "pools" ? "none" : "pools")
    }
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Header status={state.status} expandedView={state.expandedView} isLive={state.isLive} />
      <MetricsBar metrics={state.metrics} />
      {state.expandedView === "none" ? (
        <>
          <OpportunitiesView opportunities={state.opportunities} />
          <ActivityLog activities={state.activityHistory} />
        </>
      ) : (
        <ExpandedView
          view={state.expandedView}
          chains={state.chains}
          assets={state.assets}
          pools={state.pools}
          isLive={state.isLive}
        />
      )}
    </Box>
  )
}
