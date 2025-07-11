#!/usr/bin/env node

import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import { mainRun } from "./Cli.js"

const program = mainRun(process.argv).pipe(Effect.provide(NodeContext.layer))

NodeRuntime.runMain(program as Effect.Effect<void, any, never>, { disableErrorReporting: true })
