import { Effect, Layer } from "effect"
import { type Address, createPublicClient, createWalletClient, http, parseAbi } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { moonbeam } from "viem/chains"
import type {
  BlockchainConnector,
  PoolReserves,
  PriceQuote,
  Transaction,
  TransactionReceipt,
} from "./types.js"
import { ContractError, InsufficientLiquidityError, NetworkError, Token } from "./types.js"

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
])

const UNISWAP_V2_PAIR_ABI = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
])

const UNISWAP_V2_ROUTER_ABI = parseAbi([
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
])

export interface ViemConnectorConfig {
  readonly rpcUrl: string
  readonly chainId: number
}

export const makeViemConnector = (
  config: ViemConnectorConfig,
): Effect.Effect<BlockchainConnector, never> =>
  Effect.sync(() => {
    const publicClient = createPublicClient({
      chain: config.chainId === 1284 ? moonbeam : moonbeam, // TODO: support other chains
      transport: http(config.rpcUrl),
    })

    return {
      getBlockNumber: () =>
        Effect.tryPromise({
          try: async () => {
            const block = await publicClient.getBlockNumber()
            return block
          },
          catch: (error) =>
            new NetworkError({ reason: "Failed to get block number", cause: error }),
        }),

      getBalance: (address: string, token?: Token) =>
        Effect.tryPromise({
          try: async () => {
            if (!token) {
              const balance = await publicClient.getBalance({
                address: address as Address,
              })
              return balance
            } else {
              const balance = await publicClient.readContract({
                address: token.address as Address,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [address as Address],
              })
              return balance
            }
          },
          catch: (_error) =>
            new ContractError({
              contractAddress: token?.address || "native",
              method: "balanceOf",
              reason: "Failed to get balance",
              params: { address, token },
            }),
        }),

      getPoolReserves: (poolAddress: string) =>
        Effect.tryPromise({
          try: async () => {
            const [reserves, token0Address, token1Address] = await Promise.all([
              publicClient.readContract({
                address: poolAddress as Address,
                abi: UNISWAP_V2_PAIR_ABI,
                functionName: "getReserves",
              }),
              publicClient.readContract({
                address: poolAddress as Address,
                abi: UNISWAP_V2_PAIR_ABI,
                functionName: "token0",
              }),
              publicClient.readContract({
                address: poolAddress as Address,
                abi: UNISWAP_V2_PAIR_ABI,
                functionName: "token1",
              }),
            ])

            const [token0Decimals, token0Symbol, token1Decimals, token1Symbol] = await Promise.all([
              publicClient.readContract({
                address: token0Address,
                abi: ERC20_ABI,
                functionName: "decimals",
              }),
              publicClient.readContract({
                address: token0Address,
                abi: ERC20_ABI,
                functionName: "symbol",
              }),
              publicClient.readContract({
                address: token1Address,
                abi: ERC20_ABI,
                functionName: "decimals",
              }),
              publicClient.readContract({
                address: token1Address,
                abi: ERC20_ABI,
                functionName: "symbol",
              }),
            ])

            return {
              token0: Token.make({
                address: token0Address,
                symbol: token0Symbol,
                decimals: token0Decimals,
                chainId: config.chainId,
              }),
              token1: Token.make({
                address: token1Address,
                symbol: token1Symbol,
                decimals: token1Decimals,
                chainId: config.chainId,
              }),
              reserve0: BigInt(reserves[0]),
              reserve1: BigInt(reserves[1]),
              fee: 30, // 0.3% for Uniswap V2
            } satisfies PoolReserves
          },
          catch: (_error) =>
            new ContractError({
              contractAddress: poolAddress,
              method: "getReserves",
              reason: "Failed to get pool reserves",
              params: { poolAddress },
            }),
        }),

      getPriceQuote: (tokenIn: Token, tokenOut: Token, amountIn: bigint, dexAddress: string) =>
        Effect.tryPromise({
          try: async () => {
            const path = [tokenIn.address, tokenOut.address]
            const amounts = await publicClient.readContract({
              address: dexAddress as Address,
              abi: UNISWAP_V2_ROUTER_ABI,
              functionName: "getAmountsOut",
              args: [amountIn, path as Address[]],
            })

            if (amounts.length < 2 || amounts[1] === 0n) {
              throw new InsufficientLiquidityError({
                tokenIn,
                tokenOut,
                requestedAmount: amountIn,
              })
            }

            const outputAmount = amounts[1]
            const priceImpact = calculatePriceImpact(amountIn, outputAmount, tokenIn, tokenOut)

            return {
              inputAmount: amountIn,
              outputAmount,
              priceImpact,
              route: path,
            } satisfies PriceQuote
          },
          catch: (error) => {
            if (error instanceof InsufficientLiquidityError) return error
            return new ContractError({
              contractAddress: dexAddress,
              method: "getAmountsOut",
              reason: "Failed to get price quote",
              params: { tokenIn, tokenOut, amountIn, dexAddress },
            })
          },
        }),

      estimateGas: (transaction: Transaction) =>
        Effect.tryPromise({
          try: async () => {
            const gas = await publicClient.estimateGas({
              to: transaction.to as Address,
              data: transaction.data as `0x${string}`,
              value: transaction.value,
            })
            return gas
          },
          catch: (error) => new NetworkError({ reason: "Failed to estimate gas", cause: error }),
        }),

      sendTransaction: (transaction: Transaction, privateKey: string) =>
        Effect.tryPromise({
          try: async () => {
            const account = privateKeyToAccount(privateKey as `0x${string}`)
            const walletClient = createWalletClient({
              account,
              chain: config.chainId === 1284 ? moonbeam : moonbeam,
              transport: http(config.rpcUrl),
            })

            const hash = await walletClient.sendTransaction({
              to: transaction.to as Address,
              data: transaction.data as `0x${string}`,
              value: transaction.value,
              gas: transaction.gasLimit,
            })

            // Wait for the transaction to be mined
            const receipt = await publicClient.waitForTransactionReceipt({ hash })

            return {
              hash,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed,
              status: receipt.status === "success" ? "success" : "reverted",
              logs: receipt.logs.map((log) => ({
                address: log.address,
                topics: log.topics,
                data: log.data,
              })),
            } satisfies TransactionReceipt
          },
          catch: (error) =>
            new NetworkError({ reason: "Failed to send transaction", cause: error }),
        }),
      waitForTransaction: (txHash: string, confirmations = 1) =>
        Effect.tryPromise({
          try: async () => {
            const receipt = await publicClient.waitForTransactionReceipt({
              hash: txHash as `0x${string}`,
              confirmations,
            })

            return {
              hash: txHash,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed,
              status: receipt.status === "success" ? "success" : "reverted",
              logs: receipt.logs.map((log) => ({
                address: log.address,
                topics: log.topics,
                data: log.data,
              })),
            } satisfies TransactionReceipt
          },
          catch: (error) =>
            new NetworkError({ reason: "Failed to wait for transaction", cause: error }),
        }),
    } satisfies BlockchainConnector
  })

function calculatePriceImpact(
  _amountIn: bigint,
  _amountOut: bigint,
  _tokenIn: Token,
  _tokenOut: Token,
): number {
  // Simplified price impact calculation
  // In production, this should consider the pool reserves and liquidity depth
  return 0.1 // 0.1% placeholder
}

export class ViemConnectorLive extends Effect.Tag("ViemConnector")<
  ViemConnectorLive,
  BlockchainConnector
>() {
  static readonly Live = (config: ViemConnectorConfig) =>
    Layer.effect(this, makeViemConnector(config))
}
