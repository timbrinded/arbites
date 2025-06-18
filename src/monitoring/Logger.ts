import { Console, Data, Effect, Layer } from "effect"
import type { ExecutionResult } from "../execution/ExecutionEngine.js"
import type { ArbitrageOpportunity } from "./types.js"

export class LogLevel extends Data.Class<{
  readonly level: "debug" | "info" | "warn" | "error"
  readonly value: number
}> {
  static readonly Debug = new LogLevel({ level: "debug", value: 0 })
  static readonly Info = new LogLevel({ level: "info", value: 1 })
  static readonly Warn = new LogLevel({ level: "warn", value: 2 })
  static readonly Error = new LogLevel({ level: "error", value: 3 })
}

export interface LogEntry {
  readonly timestamp: Date
  readonly level: LogLevel
  readonly message: string
  readonly data?: unknown
}

export interface Logger {
  readonly debug: (message: string, data?: unknown) => Effect.Effect<void>
  readonly info: (message: string, data?: unknown) => Effect.Effect<void>
  readonly warn: (message: string, data?: unknown) => Effect.Effect<void>
  readonly error: (message: string, data?: unknown) => Effect.Effect<void>
  readonly logOpportunity: (opportunity: ArbitrageOpportunity) => Effect.Effect<void>
  readonly logExecution: (result: ExecutionResult) => Effect.Effect<void>
}

export const makeLogger = (minLevel: LogLevel = LogLevel.Info) =>
  Effect.gen(function* () {
    const log = (level: LogLevel, message: string, data?: unknown) =>
      Effect.gen(function* () {
        if (level.value >= minLevel.value) {
          const timestamp = new Date().toISOString()
          const prefix = `[${timestamp}] [${level.level.toUpperCase()}]`

          if (data) {
            yield* Console.log(`${prefix} ${message}`, data)
          } else {
            yield* Console.log(`${prefix} ${message}`)
          }

          // In production, also send to monitoring service
          // yield* sendToMonitoring({ timestamp, level, message, data })
        }
      })

    const logOpportunity = (opportunity: ArbitrageOpportunity) =>
      log(
        LogLevel.Info,
        `Arbitrage opportunity found: ${opportunity.tokenIn.symbol} -> ${opportunity.tokenOut.symbol}`,
        {
          buyDex: opportunity.buyDex,
          sellDex: opportunity.sellDex,
          profitPercentage: opportunity.profitPercentage,
          expectedProfit: opportunity.expectedProfit.toString(),
          gasEstimate: opportunity.gasEstimate.toString(),
          netProfit: opportunity.netProfit.toString(),
        },
      )

    const logExecution = (result: ExecutionResult) => {
      const level =
        result.status === "success"
          ? LogLevel.Info
          : result.status === "failed"
            ? LogLevel.Error
            : LogLevel.Warn

      return log(
        level,
        `Execution ${result.status}: ${result.opportunity.tokenIn.symbol} -> ${result.opportunity.tokenOut.symbol}`,
        {
          reason: result.reason,
          approvalTx: result.approvalTx?.hash,
          swapTx: result.swapTx?.hash,
          actualProfit: result.actualProfit?.toString(),
        },
      )
    }

    return {
      debug: (message: string, data?: unknown) => log(LogLevel.Debug, message, data),
      info: (message: string, data?: unknown) => log(LogLevel.Info, message, data),
      warn: (message: string, data?: unknown) => log(LogLevel.Warn, message, data),
      error: (message: string, data?: unknown) => log(LogLevel.Error, message, data),
      logOpportunity,
      logExecution,
    } satisfies Logger
  })

export class LoggerLive extends Effect.Tag("Logger")<LoggerLive, Logger>() {
  static readonly Live = (minLevel: LogLevel = LogLevel.Info) =>
    Layer.effect(this, makeLogger(minLevel))
}
