import { Data } from "effect"

export type DexType = "uniswap-v2" | "uniswap-v3" | "curve" | "balancer"

export class DexInfo extends Data.Class<{
  readonly name: string
  readonly type: DexType
  readonly routerAddress: string
  readonly factoryAddress: string
  readonly chainId: number
  readonly fee: number // basis points
}> {}

export interface DexRegistry {
  readonly getDex: (name: string) => DexInfo | undefined
  readonly getAllDexes: () => readonly DexInfo[]
  readonly addDex: (dex: DexInfo) => void
  readonly removeDex: (name: string) => void
}

// Common DEX addresses on Moonbeam
export const MOONBEAM_DEXES = {
  stellaswap: new DexInfo({
    name: "StellaSwap",
    type: "uniswap-v2",
    routerAddress: "0xd0A01ec574D1fC6652eDF79cb2F880fd47D34Ab1",
    factoryAddress: "0x68A384D826D3678f78BB9FB1533c7E9577dACc0E",
    chainId: 1284,
    fee: 30, // 0.3%
  }),
  beamswap: new DexInfo({
    name: "BeamSwap",
    type: "uniswap-v2",
    routerAddress: "0x96b244391D98B62D19aE89b1A4dCcf0fc56970C7",
    factoryAddress: "0x985BcA32293A7A496300a48081947321177a86FD",
    chainId: 1284,
    fee: 30, // 0.3%
  }),
  solarflare: new DexInfo({
    name: "Solarflare",
    type: "uniswap-v2",
    routerAddress: "0x53b17e88bE5Cdf0FFF31BbA7050Cb1699A3D1C14",
    factoryAddress: "0x19B85ae92947E0725d5265fFB3b8109B0B71186C",
    chainId: 1284,
    fee: 30, // 0.3%
  }),
} as const
