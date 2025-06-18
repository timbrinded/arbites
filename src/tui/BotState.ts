import { Data, Effect, Layer, Ref, Stream, SubscriptionRef } from "effect"
import type { Token } from "../blockchain/types.js"
import type { ExecutionResult } from "../execution/ExecutionEngine.js"
import type { ArbitrageOpportunity } from "../monitoring/types.js"

export class BotMetrics extends Data.Class<{
  readonly balance: bigint
  readonly initialBalance: bigint
  readonly profitLoss: bigint
  readonly profitLossPercentage: number
  readonly poolsMonitored: number
  readonly chainsMonitored: number
  readonly assetsMonitored: readonly Token[]
  readonly opportunitiesDetected: number
  readonly successfulTrades: number
  readonly failedTrades: number
}> {}

export class OpportunityStatus extends Data.Class<{
  readonly id: string
  readonly opportunity: ArbitrageOpportunity
  readonly status: "pending" | "testing" | "executing" | "completed" | "failed"
  readonly reason?: string
  readonly timestamp: Date
}> {
  static create(opportunity: ArbitrageOpportunity) {
    return new OpportunityStatus({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      opportunity,
      status: "pending",
      timestamp: new Date(),
    })
  }
}

export class ActivityEntry extends Data.Class<{
  readonly id: string
  readonly timestamp: Date
  readonly type: "success" | "failure" | "info"
  readonly message: string
  readonly profit?: bigint
}> {
  static create(type: "success" | "failure" | "info", message: string, profit?: bigint) {
    const entry: {
      id: string
      timestamp: Date
      type: "success" | "failure" | "info"
      message: string
      profit?: bigint
    } = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      type,
      message,
    }

    if (profit !== undefined) {
      entry.profit = profit
    }

    return new ActivityEntry(entry)
  }
}

export interface BotState {
  readonly metrics: BotMetrics
  readonly status: "running" | "paused" | "stopped"
  readonly opportunities: readonly OpportunityStatus[]
  readonly activityHistory: readonly ActivityEntry[]
}

export const makeBotStateManager = () =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<BotState>({
      metrics: new BotMetrics({
        balance: 10000n * 10n ** 6n, // $10,000 in USDC (6 decimals)
        initialBalance: 10000n * 10n ** 6n,
        profitLoss: 0n,
        profitLossPercentage: 0,
        poolsMonitored: 0,
        chainsMonitored: 1,
        assetsMonitored: [],
        opportunitiesDetected: 0,
        successfulTrades: 0,
        failedTrades: 0,
      }),
      status: "running",
      opportunities: [],
      activityHistory: [],
    })

    // Create a subscription ref for state changes
    const subscription = yield* SubscriptionRef.make(yield* Ref.get(stateRef))

    // Update subscription whenever state changes
    const updateState = (updater: (state: BotState) => BotState) =>
      Effect.gen(function* () {
        const newState = yield* Ref.updateAndGet(stateRef, updater)
        yield* SubscriptionRef.set(subscription, newState)
        return newState
      })

    const updateMetrics = (updater: (metrics: BotMetrics) => BotMetrics) =>
      updateState((state) => ({
        ...state,
        metrics: updater(state.metrics),
      }))

    const addOpportunity = (opportunity: ArbitrageOpportunity) =>
      updateState((state) => ({
        ...state,
        opportunities: [
          ...state.opportunities.filter((o) => o.status !== "completed" && o.status !== "failed"),
          OpportunityStatus.create(opportunity),
        ].slice(-10), // Keep only last 10
        metrics: {
          ...state.metrics,
          opportunitiesDetected: state.metrics.opportunitiesDetected + 1,
        },
      }))

    const updateOpportunityStatus = (
      opportunity: ArbitrageOpportunity,
      status: OpportunityStatus["status"],
      reason?: string,
    ) =>
      updateState((state) => ({
        ...state,
        opportunities: state.opportunities.map((o) => {
          if (o.opportunity !== opportunity) return o

          const props: {
            id: string
            opportunity: ArbitrageOpportunity
            status: OpportunityStatus["status"]
            reason?: string
            timestamp: Date
          } = {
            id: o.id,
            opportunity: o.opportunity,
            status,
            timestamp: new Date(),
          }

          if (reason !== undefined) {
            props.reason = reason
          }

          return new OpportunityStatus(props)
        }),
      }))

    const addExecutionResult = (result: ExecutionResult) =>
      Effect.gen(function* () {
        const profit = result.actualProfit || 0n
        const message =
          result.status === "success"
            ? `Executed ${result.opportunity.tokenIn.symbol}→${result.opportunity.tokenOut.symbol} for +$${(Number(profit) / 1e6).toFixed(2)} profit`
            : `Failed ${result.opportunity.tokenIn.symbol}→${result.opportunity.tokenOut.symbol} - ${result.reason || "Unknown error"}`

        yield* updateState((state) => ({
          ...state,
          metrics: {
            ...state.metrics,
            balance: state.metrics.balance + (result.status === "success" ? profit : 0n),
            profitLoss: state.metrics.profitLoss + (result.status === "success" ? profit : 0n),
            profitLossPercentage:
              Number(
                ((state.metrics.profitLoss + (result.status === "success" ? profit : 0n)) *
                  10000n) /
                  state.metrics.initialBalance,
              ) / 100,
            successfulTrades:
              state.metrics.successfulTrades + (result.status === "success" ? 1 : 0),
            failedTrades: state.metrics.failedTrades + (result.status === "failed" ? 1 : 0),
          },
          activityHistory: [
            ...state.activityHistory,
            ActivityEntry.create(
              result.status === "success" ? "success" : "failure",
              message,
              result.status === "success" ? profit : undefined,
            ),
          ].slice(-20), // Keep last 20 entries
        }))
      })

    const setStatus = (status: BotState["status"]) => updateState((state) => ({ ...state, status }))

    const getStateStream = () =>
      Effect.sync(() => {
        // Return a stream that emits state changes
        return Stream.fromEffect(SubscriptionRef.get(subscription))
      })

    return {
      updateMetrics,
      addOpportunity,
      updateOpportunityStatus,
      addExecutionResult,
      setStatus,
      getStateStream,
      getState: () => Ref.get(stateRef),
    }
  })

export class BotStateManagerLive extends Effect.Tag("BotStateManager")<
  BotStateManagerLive,
  Effect.Effect.Success<ReturnType<typeof makeBotStateManager>>
>() {
  static readonly Live = Layer.effect(this, makeBotStateManager())
}
