import { Effect, Fiber, Layer, Ref, Stream } from "effect"
import { render } from "ink"
import React from "react"
import type { Token } from "../blockchain/types.js"
import type { ExecutionResult } from "../execution/ExecutionEngine.js"
import type { ArbitrageOpportunity } from "../monitoring/types.js"
import { App } from "./App.js"
import { BotStateManagerLive } from "./BotState.js"

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
}

export const makeTuiService = () =>
  Effect.gen(function* () {
    const stateManager = yield* BotStateManagerLive
    const fiberRef = yield* Ref.make<Fiber.RuntimeFiber<void> | null>(null)
    const inkInstanceRef = yield* Ref.make<ReturnType<typeof render> | null>(null)

    const start = () =>
      Effect.gen(function* () {
        const initialState = yield* stateManager.getState()
        const stream = yield* stateManager.getStateStream()
        const stateStream = yield* Effect.promise(() =>
          Stream.toReadableStream(stream),
        )

        // Create async iterable from stream
        const asyncIterable = {
          [Symbol.asyncIterator]: () => {
            const reader = stateStream.getReader()
            return {
              async next() {
                const result = await reader.read()
                if (result.done) {
                  return { done: true, value: undefined }
                }
                return { done: false, value: result.value }
              },
            }
          },
        }

        const onPause = () => stateManager.setStatus("paused")
        const onResume = () => stateManager.setStatus("running")
        const onQuit = () =>
          Effect.gen(function* () {
            yield* stateManager.setStatus("stopped")
            const inkInstance = yield* Ref.get(inkInstanceRef)
            if (inkInstance) {
              inkInstance.unmount()
            }
          })

        // Render the TUI
        const instance = render(
          React.createElement(App, {
            initialState,
            onPause,
            onResume,
            onQuit,
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

    return {
      start,
      stop,
      updatePoolCount,
      updateAssets,
      reportOpportunity,
      reportExecution,
      updateOpportunityStatus,
    } satisfies TuiService
  })

export class TuiServiceLive extends Effect.Tag("TuiService")<TuiServiceLive, TuiService>() {
  static readonly Live = Layer.effect(this, makeTuiService()).pipe(
    Layer.provide(BotStateManagerLive.Live),
  )
}
