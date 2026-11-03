---
name: pharos-yield-optimizer
description: Read three Pharos USDC vaults at two real on-chain blocks, compare seven-day annualized historical yield, deduct assumed execution fees and gas oracle costs, and explain a conservative stay-put recommendation. No signatures or transfers.
---
# Pharos Yield Optimizer

1. User inputs a public address, current source, amount in USDC, intended holding period, minimum holding period, entry/exit fees, slippage reserve and assumed gas units.
2. Verify chain 1672. Find a block approximately 7 days before the current block using actual block timestamps, not an assumed block interval.
3. For Morpho RockawayX USDC, Centrifuge JTRSY USDC and Centrifuge HYB USDC, check bytecode and \`asset()\` = the same USDC, then read current and historical \`convertToAssets\` / \`pricePerShare\`.
4. Annualize the historical share-price ratio over real elapsed seconds; label clearly as historical and refuse missing or zero data.
5. Fetch gas price and the on-chain PROS/USD oracle answer and timestamp. Reject stale oracle prices.
6. Compare future *hypothetical* gross difference at the observed rates minus explicit assumed fees, slippage and gas; check minimum holding period.
7. Query \`maxDeposit(wallet)\` and flag permission/no capacity, and asynchronous redemption of Centrifuge. If an executable route cannot be verified, say STAY_PUT with precise reasons.
8. Export complete JSON showing three vault addresses, block numbers, on-chain rates, costs and decision. Never collect keys, sign or submit transactions.

Read-only recommendation, not a strategy execution or promise of future APY.
