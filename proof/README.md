# Yield Optimizer — Verified Pharos Mainnet on-chain proof

Verified on **3 November 2026** by a successful deployed Cloudflare Worker GitHub Actions run.

- [Live website](https://yield-optimizer.trantanlong2411.workers.dev/)
- [GitHub Actions passing live proof](https://github.com/trantanlong2411-droid/Yield-Optimizer/actions/runs/41623535068)
- [Permanent machine-readable verified summary](./verified-run.json)
- [Full reproducible on-chain implementation and fee model](../src/engine.mjs)
- [Three-source independent live smoke test](../scripts/smoke-deployed.mjs)

## Actual on-chain observations

All three vaults were called on **Pharos Mainnet chain ID 1672** at block **22007085** and historical block **21397148** (real timestamp gap: 7 days). Each was validated as a contract using Pharos USDC as the underlying asset.

| Vault | On-chain rate method | Prior share quote (raw) | Current share quote (raw) | Seven-day growth annualized |
| --- | --- | ---: | ---: | ---: |
| Morpho / RockawayX USDC | `convertToAssets(1e18)` | 1007666 | 1008550 | **4.6817%** |
| Centrifuge JTRSY / USDC | `pricePerShare()` | 1120518 | 1121374 | **4.0649%** |
| Centrifuge HYB / USDC | `pricePerShare()` | 989357 | 992826 | **20.0371%** |

This is historical annualized share-rate change over 7 days, **not promised forward APY, a guaranteed future return or a representation that funds can be immediately withdrawn**.

## Actual fees and optimizer decision

- Gas price observed from Pharos Mainnet: **10 Gwei**.
- PROS/USD oracle price observed on chain: **$0.5157429244883943 / PROS**.
- Assumed route gas: 420,000 units; assumed entry fee 15 bps; assumed exit fee 15 bps; assumed slippage reserve 20 bps.
- Principal for test: 1,000 USDC, 90-day modeled holding, minimum holding rule 30 days, minimum expected net gain $1.
- Gas fee model uses the on-chain gas price and PROS/USD oracle; the transaction gas unit count and bps rates are **editable assumptions**, not claims of exact future fees.

### Decision: STAY_PUT

Even if the highest historical annualized rate appears attractive, the sample wallet's live **maxDeposit was 0** for the three vaults and Centrifuge redemptions may be asynchronous. There is no validated immediate exit/entry route, deposit authorization, redeem queue state, or permitted signing workflow.

The agent therefore **does not recommend an actionable rebalance**. It provides only hypothetical gross/net gain comparisons, subtracts gas and fee assumptions, and explains why staying put is safer.

No transaction was prepared, signed or submitted; no keys were used.

## Mapping to all four Arena requirements

| Requirement | Verified implementation |
| --- | --- |
| Compare at least three on-chain yield sources | Three real USDC vault contracts, two timestamps and independently decoded share-price inputs, verified live |
| Account for gas, entry/exit fees and minimum holding | Fee-aware net gain model, actual gas price and on-chain oracle with user-set gas units/bps, min hold rule |
| Clear recommendation and net gain, or stay-put reason | Named STAY_PUT with observed maxDeposit=0 and Centrifuge async redemption; model table displays hypothetical net |
| If executing, only user-signed transactions | No execution implemented, no transaction functions or private keys |

## Reviewer verification

Open the [website](https://yield-optimizer.trantanlong2411.workers.dev/), leave the default assumptions, and click **Compare live yield sources**. Inspect each share-price source, original block numbers, actual on-chain quotes, gas and oracle prices, estimated net differences, and STAY_PUT reasons. Try a 7-day holding period with a 30-day minimum and repeat. Export the complete JSON and compare to the successful [GitHub Actions run](https://github.com/trantanlong2411-droid/Yield-Optimizer/actions/runs/41623535068).

The GitHub Actions run passed **8/8 automated tests**, compiled the Cloudflare Worker and independently verified all three actual on-chain historical yields. Its downloaded `pharos-yield-optimizer-mainnet-proof` JSON artifact contains the full live result for 30 days.

This is an advisory tool and should not be treated as financial advice, a guaranteed yield calculator or an automatic vault migration system.
