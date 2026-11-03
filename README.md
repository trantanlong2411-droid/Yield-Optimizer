# Yield Optimizer — Pharos Agent Arena (Hard · 200 pts)

[Public Cloudflare Worker](https://yield-optimizer.trantanlong2411.workers.dev/) · [GitHub source](https://github.com/trantanlong2411-droid/Yield-Optimizer)

## Verified deployed Mainnet proof

- [Permanent proof with all three real vault yields and the conservative decision](./proof/README.md)
- [Verified JSON summary](./proof/verified-run.json)
- [GitHub Actions run 41623535068](https://github.com/trantanlong2411-droid/Yield-Optimizer/actions/runs/41623535068) passed 8/8 tests and actual deployed three-vault comparisons.

## User-exported original evidence

[Seven-day scenario: original JSON, independently recalculated vault rates, gas, fees and STAY_PUT result](./proof/USER-PROOF.md). The submitted browser result uses block 22008931 and a 7-day holding period against a 30-day minimum. The CI script runs the arithmetic again without fabricating live data.

## What the app actually does

A safe, read-only on-chain yield research agent for Pharos Pacific Mainnet (chain ID 1672). It compares **three actual USDC-denominated vault contracts** using their rate/share price at two real historical blocks about seven days apart. An independent mainnet RPC query determines the block timestamps and annualizes share price changes over the observed period.

Unlike a prefilled APY table, the historic rates are read live from on-chain contracts on every user request. Unreadable, zero or unsupported price history means **APY unavailable**, not 0% or a fabricated default.

The app then models potential gain over a configurable holding period, subtracts entry/exit fee assumptions, a slippage reserve, and a gas-cost estimate denominated in USD using the live PROS/USD price oracle. It returns **STAY_PUT** unless an end-to-end executable move is verified. This initial implementation deliberately does *not* prepare transactions, sign, approve tokens, send assets or hold user keys.

## Three live on-chain yield sources

| Vault | Address | Current / historic read | Underlying |
| --- | --- | --- | --- |
| Morpho · RockawayX USDC | 0x047cd0a91e9b92ed979189a6c8a120bf280f02e5 | ERC4626 \`convertToAssets(1e18)\` | Pharos USDC |
| Centrifuge · JTRSY USDC | 0x160e0dd4c4f693b05eca83bc2ec6fd51954fc434 | \`pricePerShare()\` | Pharos USDC |
| Centrifuge · HYB USDC | 0x74189e017d3aefee48f3cc5bf592694b2a016da8 | \`pricePerShare()\` | Pharos USDC |

All three addresses are found in the publicly listed Morpho curator adapter or Centrifuge's official deployment registry. On each request, the Worker independently verifies bytecode and \`asset()\` equals the official Pharos USDC contract \`0xc879c018db60520f4355c26ed1a6d572cdac1815\` before comparing rates.

The yield estimate is **annualized historical share-price growth**, not guaranteed APY and not an oracle-forward yield prediction. Centrifuge share prices can update irregularly and may decline. Converting a short observation interval to yearly returns can be noisy; the model requires at least one day of actual block timestamps.

## Net-gain model

\`\`\`
grossGainUSD = capitalUSDC * (
    (1 + targetObservedAPY/100)^(holdingDays / 365.2425)
  - (1 + currentObservedAPY/100)^(holdingDays / 365.2425)
)
feeUSD = capitalUSDC * (exitFeeBps + entryFeeBps + slippageBps) / 10000
gasCostUSD = gasPriceWei / 1e18 * totalAssumedGasUnits * PROS_USD_OraclePrice
netGainUSD = grossGainUSD - feeUSD - gasCostUSD
\`\`\`

If the current allocation is \`wallet\`, its baseline yield is assumed 0% *for illustration only*, and no vault exit fee is charged. The model uses current PROS/USD Oracle \`latestAnswer()\` (18 decimals) and \`latestTimestamp()\`, and rejects stale values older than 24h.

Default assumptions are **1000 USDC capital, 90-day holding, minimum 30 days, 15 bps entry fee, 15 bps exit fee, 20 bps slippage reserve, 420000 assumed total gas units, minimum $1 hypothetical net gain**. These inputs are not chain-verified vault execution fees, price quotes or actual gas estimates. They can be edited before each analysis.

## Why it often recommends STAY_PUT

- Centrifuge supports asynchronous redemption/settlement; requesting funds does not guarantee they can be immediately withdrawn at the quoted price.
- \`maxDeposit(address)\` may be zero because the address lacks permission, the vault is paused, or the vault has no room. An observed 0 is correctly treated as **not verified as able to deposit**.
- This agent has no on-chain liquidity/redemption route checks, pending request checks or actual transaction build/approval/signing flow.
- A rate advantage is not by itself a trade recommendation. Positive gross modeled difference minus fees and gas may still be negative.
- If any APY, gas quote or oracle price cannot be read, the relevant comparison is **unavailable** and no invented value is used.

This is a **recommendation-only** build. The task permits recommendation **or** execution. Since execution is not implemented, the condition "if executing, prepare transactions for user signature only" is satisfied by having *no* transaction functionality, not by pretending a transaction has been prepared.

## Complete flow

\`\`\`mermaid
flowchart TD
 A[User parameters: current vault, amount, holding period, fee assumptions] --> B[Read Pharos Mainnet block and find historical block]
 B --> C[Verify 3 vault codes, common USDC and current/history share rates]
 C --> D[Compute observed annualized growth for each source]
 D --> E[Fetch mainnet gas quote and PROS/USD oracle]
 E --> F[Model future yield difference minus gas, entry, exit and slippage]
 F --> G{Can execution and deposit capacity be verified?}
 G -->|No| H[STAY_PUT with exact reasons and hypothetical net gain]
 G -->|Unknown| H
 H --> I[Export reproducible JSON with contracts and both blocks]
\`\`\`

## Task requirements mapping

| Task requirement | Evidence |
| --- | --- |
| Compare three yields with live on-chain data | Three pinned vault share-rate calls at current and prior blocks, actual timestamps and the same Pharos USDC underlying |
| Account for gas, entry/exit fees and minimum holding period | Live \`eth_gasPrice\`, \`latestAnswer()\` and \`latestTimestamp()\`, editable fee/slippage/gas assumptions, min holding check |
| Clear recommendation and modeled net, or stay-put reason | Break-even comparison rows and explicit STAY_PUT with missing deposit capacity/async exit explanations |
| Execution only with wallet signature, never private keys | Execution intentionally not supported; no transaction methods or private keys in the Worker |

## Reviewer walkthrough

1. Open [the website](https://yield-optimizer.trantanlong2411.workers.dev/).
2. Keep the public sample wallet. Select Morpho as the initial vault, with 1000 USDC capital, 90-day holding period and 30-day minimum.
3. Click **Compare live yield sources**.
4. Examine real current and historical rates for Morpho, JTRSY and HYB, with both block numbers.
5. Review gas, PROS/USD price, exit/entry fees, expected modeled net and STAY_PUT reason. No transfers occur.
6. Change holding period to 7 days while keeping the 30-day minimum, then repeat: insufficient holding period should be named as a stay-put reason.
7. Click **Export JSON proof**. The public GitHub Actions workflow also tests the deployed Worker and saves a full live on-chain JSON artifact.

### Restrictions and evidence honesty

The application does not have a trade execution or simulation service. "Gas units" and entry/exit fee percentages are user-supplied **assumptions**, not actual signed transactions or guaranteed costs. No balance transfers, deposit requests or withdrawals occur.

A Centrifuge "vault" can be ERC-7540 asynchronous and may require additional permission/KYC, so this site does not claim instant moveability. A prospective yield advantage alone is insufficient to overcome liquidity, fulfillment timing and protocol risks.

An offline test does not prove the three on-chain APYs are available; the separate GitHub Actions deployed live suite must show all three valid historical rates before the task is marked complete.

## Run

\`\`\`bash
npm install
npm test
npm run build
npx wrangler deploy
\`\`\`

[GitHub Actions workflow](https://github.com/trantanlong2411-droid/Yield-Optimizer/actions/workflows/verify.yml).

## Official supporting sources

- [Morpho vault mechanics](https://docs.morpho.org/developers/earn/concepts/vault-mechanics/)
- [Morpho RockawayX Pharos vault source](https://github.com/DefiLlama/dimension-adapters/blob/master/factory/curators.ts)
- [Official Centrifuge deployed USDC vaults](https://docs.centrifuge.io/developer/protocol/deployments/)
- [Centrifuge price and settlement caveats](https://docs.centrifuge.io/user/concepts/pricing/)
- [PROS/USD price oracle on Pharos](https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe)
