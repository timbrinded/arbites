import { Effect, Fiber, Layer, Ref } from "effect"
import { render } from "ink"
import * as React from "react"
import type { Token } from "../blockchain/types.js"
import type { ExecutionResult } from "../execution/ExecutionEngine.js"
import type { ArbitrageOpportunity } from "../monitoring/types.js"
import { App } from "./App.js"
import {
  type AssetInfo,
  type BotState,
  BotStateManagerLive,
  type ChainInfo,
  type PoolInfo,
} from "./BotState.js"

export interface TuiService {
  readonly start: () => Effect.Effect<void>
  readonly stop: () => Effect.Effect<void>
  readonly updatePoolCount: (count: number) => Effect.Effect<void>
  readonly updateAssets: (assets: readonly Token[]) => Effect.Effect<void>
  readonly reportOpportunity: (opportunity: ArbitrageOpportunity) => Effect.Effect<void>
  readonly reportExecution: (result: ExecutionResult) => Effect.Effect<void>
  readonly updateOpportunityStatus: (
    opportunity: ArbitrageOpportunity,
    status: "testing" | "executing",
  ) => Effect.Effect<void>
  readonly getStatus: () => Effect.Effect<"running" | "paused" | "stopped">
  readonly updateChainInfo: (chainInfo: readonly ChainInfo[]) => Effect.Effect<void>
  readonly updateAssetInfo: (assetInfo: readonly AssetInfo[]) => Effect.Effect<void>
  readonly updatePoolInfo: (poolInfo: readonly PoolInfo[]) => Effect.Effect<void>
  readonly setIsLive: (isLive: boolean) => Effect.Effect<void>
  readonly onGoLiveRequested: Ref.Ref<(() => Effect.Effect<void>) | null>
}

export const makeTuiService = () =>
  Effect.gen(function* () {
    const stateManager = yield* BotStateManagerLive
    const fiberRef = yield* Ref.make<Fiber.RuntimeFiber<void> | null>(null)
    const inkInstanceRef = yield* Ref.make<ReturnType<typeof render> | null>(null)
    const goLiveCallbackRef = yield* Ref.make<(() => Effect.Effect<void>) | null>(null)

    const start = () =>
      Effect.gen(function* () {
        const initialState = yield* stateManager.getState()

        // Create a simple async iterable that polls the state
        const asyncIterable: AsyncIterable<BotState> = {
          [Symbol.asyncIterator]: () => {
            let cancelled = false
            return {
              async next(): Promise<IteratorResult<BotState>> {
                if (cancelled) {
                  return { done: true, value: undefined as any }
                }
                // Poll state every 100ms
                await new Promise((resolve) => setTimeout(resolve, 100))
                const state = await Effect.runPromise(stateManager.getState())
                return { done: false, value: state }
              },
              return(): Promise<IteratorResult<BotState>> {
                cancelled = true
                return Promise.resolve({ done: true, value: undefined as any })
              },
            }
          },
        }

        const onPause = () => Effect.runSync(stateManager.setStatus("paused"))
        const onResume = () => Effect.runSync(stateManager.setStatus("running"))
        const onQuit = () => {
          Effect.runSync(
            Effect.gen(function* () {
              yield* stateManager.setStatus("stopped")
              const inkInstance = yield* Ref.get(inkInstanceRef)
              if (inkInstance) {
                inkInstance.unmount()
              }
            }),
          )
          // Exit the process
          process.exit(0)
        }
        const onToggleExpand = (view: BotState["expandedView"]) =>
          Effect.runSync(stateManager.setExpandedView(view))

        const onGoLive = () => {
          Effect.runSync(
            Effect.gen(function* () {
              const callback = yield* Ref.get(goLiveCallbackRef)
              if (callback) {
                yield* callback()
              } else {
                // If no callback is set, just update the state
                yield* stateManager.setIsLive(true)
              }
            }),
          )
        }

        // Render the TUI
        const instance = render(
          React.createElement(App, {
            initialState,
            onPause,
            onResume,
            onQuit,
            onToggleExpand,
            onGoLive,
            stateStream: asyncIterable,
          }),
        )

        yield* Ref.set(inkInstanceRef, instance)
      })

    const stop = () =>
      Effect.gen(function* () {
        const fiber = yield* Ref.get(fiberRef)
        if (fiber) {
          yield* Fiber.interrupt(fiber)
        }
        const inkInstance = yield* Ref.get(inkInstanceRef)
        if (inkInstance) {
          inkInstance.unmount()
        }
      })

    const updatePoolCount = (count: number) =>
      stateManager.updateMetrics((metrics) => ({
        ...metrics,
        poolsMonitored: count,
      }))

    const updateAssets = (assets: readonly Token[]) =>
      stateManager.updateMetrics((metrics) => ({
        ...metrics,
        assetsMonitored: assets,
      }))

    const reportOpportunity = (opportunity: ArbitrageOpportunity) =>
      stateManager.addOpportunity(opportunity)

    const reportExecution = (result: ExecutionResult) =>
      Effect.gen(function* () {
        yield* stateManager.addExecutionResult(result)
        yield* stateManager.updateOpportunityStatus(
          result.opportunity,
          result.status === "success" ? "completed" : "failed",
          result.reason,
        )
      })

    const updateOpportunityStatus = (
      opportunity: ArbitrageOpportunity,
      status: "testing" | "executing",
    ) => stateManager.updateOpportunityStatus(opportunity, status)

    const getStatus = () => stateManager.getState().pipe(Effect.map((state) => state.status))

    const updateChainInfo = (chainInfo: readonly ChainInfo[]) =>
      stateManager.updateChains(chainInfo)
    const updateAssetInfo = (assetInfo: readonly AssetInfo[]) =>
      stateManager.updateAssets(assetInfo)
    const updatePoolInfo = (poolInfo: readonly PoolInfo[]) => stateManager.updatePools(poolInfo)
    const setIsLive = (isLive: boolean) => stateManager.setIsLive(isLive)

    return {
      start,
      stop,
      updatePoolCount,
      updateAssets,
      reportOpportunity,
      reportExecution,
      updateOpportunityStatus,
      getStatus,
      updateChainInfo,
      updateAssetInfo,
      updatePoolInfo,
      setIsLive,
      onGoLiveRequested: goLiveCallbackRef,
    } satisfies TuiService
  })

export class TuiServiceLive extends Effect.Tag("TuiService")<TuiServiceLive, TuiService>() {
  static readonly Live = Layer.effect(this, makeTuiService()).pipe(
    Layer.provide(BotStateManagerLive.Live),
  )
}
