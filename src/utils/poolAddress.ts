import { encodePacked, getAddress, keccak256 } from "viem"
import type { Token } from "../blockchain/types.js"

// Uniswap V2 init code hash (common across most V2 forks)
const INIT_CODE_HASH = "0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f"

export function computePoolAddress(
  factoryAddress: string,
  tokenA: Token,
  tokenB: Token,
  initCodeHash: string = INIT_CODE_HASH,
): string {
  // Sort tokens
  const [token0, token1] = tokenA.address < tokenB.address ? [tokenA, tokenB] : [tokenB, tokenA]

  const salt = keccak256(
    encodePacked(["address", "address"], [getAddress(token0.address), getAddress(token1.address)]),
  )

  const pool = getAddress(
    `0x${keccak256(
      encodePacked(
        ["bytes1", "address", "bytes32", "bytes32"],
        ["0xff", getAddress(factoryAddress), salt, initCodeHash],
      ),
    ).slice(26)}`,
  )

  return pool
}

// Factory init code hashes for different DEXs on Moonbeam
export const DEX_INIT_CODE_HASHES = {
  stellaswap: "0x48a6ca3d52d0d0a6c53a83cc3c8688dd46ea4cb786b169ee959b95ad30f61643",
  beamswap: "0x720ae8db0e46acdccab06fed98e5a80b53bb0eed66e34b2aa5a7ad0eff06ca77",
  solarflare: "0xf187ed688403aa4f7acfada758d8d53698753b998a3071b06f1b777f4330eaf3",
} as const
