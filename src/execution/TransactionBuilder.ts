import { Effect, Layer } from "effect"
import { type Address, encodeFunctionData, parseAbi } from "viem"
import type { Token, Transaction } from "../blockchain/types.js"
import type { ArbitrageOpportunity } from "../monitoring/types.js"

const ERC20_ABI = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"])

const UNISWAP_V2_ROUTER_ABI = parseAbi([
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
])

export interface TransactionBuilder {
  readonly buildApprovalTransaction: (token: Token, spender: string, amount: bigint) => Transaction

  readonly buildSwapTransaction: (
    opportunity: ArbitrageOpportunity,
    routerAddress: string,
    recipientAddress: string,
    slippageTolerance: number, // in basis points, e.g., 50 = 0.5%
  ) => Transaction
}

export const makeTransactionBuilder = (): TransactionBuilder => {
  const buildApprovalTransaction = (token: Token, spender: string, amount: bigint): Transaction => {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender as Address, amount],
    })

    return {
      to: token.address,
      data,
      value: 0n,
      gasLimit: 100000n, // Standard approval gas limit
    }
  }

  const buildSwapTransaction = (
    opportunity: ArbitrageOpportunity,
    routerAddress: string,
    recipientAddress: string,
    slippageTolerance: number,
  ): Transaction => {
    // Calculate minimum output with slippage
    const slippageMultiplier = 10000n - BigInt(slippageTolerance)
    const amountOutMin = (opportunity.expectedProfit * slippageMultiplier) / 10000n

    // Set deadline to 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

    const path = [opportunity.tokenIn.address, opportunity.tokenOut.address]

    const data = encodeFunctionData({
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [
        opportunity.amountIn,
        amountOutMin,
        path as Address[],
        recipientAddress as Address,
        deadline,
      ],
    })

    return {
      to: routerAddress,
      data,
      value: 0n,
      gasLimit: 300000n, // Conservative estimate for swap
    }
  }

  return {
    buildApprovalTransaction,
    buildSwapTransaction,
  }
}

export class TransactionBuilderLive extends Effect.Tag("TransactionBuilder")<
  TransactionBuilderLive,
  TransactionBuilder
>() {
  static readonly Live = Layer.sync(this, makeTransactionBuilder)
}
