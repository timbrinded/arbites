import { Effect, HashMap, Layer, Option, Ref } from "effect"
import type { DexInfo, DexRegistry } from "./types.js"
import { MOONBEAM_DEXES } from "./types.js"

export const makeDexRegistry = Effect.gen(function* () {
  const registryRef = yield* Ref.make(
    HashMap.fromIterable(Object.entries(MOONBEAM_DEXES).map(([_key, dex]) => [dex.name, dex])),
  )

  const getDex = (name: string) =>
    Effect.gen(function* () {
      const registry = yield* Ref.get(registryRef)
      return Option.getOrUndefined(HashMap.get(registry, name))
    })

  const getAllDexes = () =>
    Effect.gen(function* () {
      const registry = yield* Ref.get(registryRef)
      return Array.from(HashMap.values(registry))
    })

  const addDex = (dex: DexInfo) =>
    Ref.update(registryRef, (registry) => HashMap.set(registry, dex.name, dex))

  const removeDex = (name: string) =>
    Ref.update(registryRef, (registry) => HashMap.remove(registry, name))

  return {
    getDex: (name: string) => Effect.runSync(getDex(name)),
    getAllDexes: () => Effect.runSync(getAllDexes()),
    addDex: (dex: DexInfo) => Effect.runSync(addDex(dex)),
    removeDex: (name: string) => Effect.runSync(removeDex(name)),
  } satisfies DexRegistry
})

export class DexRegistryLive extends Effect.Tag("DexRegistry")<DexRegistryLive, DexRegistry>() {
  static readonly Live = Layer.effect(this, makeDexRegistry)
}
