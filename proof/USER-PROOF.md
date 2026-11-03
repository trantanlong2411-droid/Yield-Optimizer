# User-exported Yield Optimizer run — 3 November 2026

The original browser-exported JSON for the user's seven-day scenario is saved unchanged here.

- [Full original JSON](./user-export-2026-11-03.json)
- [Deterministic verification script](../scripts/verify-user-export.mjs)
- [Live Yield Optimizer](https://yield-optimizer.trantanlong2411.workers.dev/)
- [Independent deployed live test](https://github.com/trantanlong2411-droid/Yield-Optimizer/actions/runs/41623899446)
- Original file SHA-256: `4def3495539b8a9f8cff37ed4e94348f01e9c0061439ce3fa73d780d481a22f4`

## Recorded source data

- Source: Pharos Mainnet on-chain reads, chain ID 1672 (as reported by the web app).
- Observation time: `2026-11-03T11:30:40.734Z`.
- Current block: `22008931`; earlier block: `21399233`; time difference exactly 7 days.
- All three contracts reported USDC as underlying: `0xc879c018db60520f4355c26ed1a6d572cdac1815`.

| Source | Contract | Prior / current raw share quote | Historical rate annualized |
| --- | --- | --- | ---: |
| Morpho / RockawayX USDC | `0x047cd0a91e9b92ed979189a6c8a120bf280f02e5` | 1007670 → 1008553 | 4.6762% |
| Centrifuge JTRSY / USDC | `0x160e0dd4c4f693b05eca83bc2ec6fd51954fc434` | 1120518 → 1121374 | 4.0649% |
| Centrifuge HYB / USDC | `0x74189e017d3aefee48f3cc5bf592694b2a016da8` | 989357 → 992826 | 20.0371% |

These are seven-day share-rate observations mathematically annualized for comparison, not guaranteed future APYs. Morpho's `convertToAssets` and Centrifuge's `pricePerShare` are read-only accounting conversions, not promises of immediate redemption.

## Cost calculations and recommendation

The user's assumptions were 1,000 USDC capital, current allocation Morpho, 7-day holding period, 30-day minimum holding period, 15 bps entry, 15 bps exit, 20 bps slippage reserve, and 420,000 assumed gas units.

The mainnet result included an on-chain gas quote of 10 Gwei, plus a PROS/USD oracle reading of $0.5157429244883943.

| Candidate | Hypothetical extra gross gain | Estimated fees/slippage | Oracle-valued gas | Net difference |
| --- | ---: | ---: | ---: | ---: |
| Centrifuge HYB | +$2.6300 | $5.0000 | $0.0022 | -$2.3721 |
| Centrifuge JTRSY | -$0.1123 | $5.0000 | $0.0022 | -$5.1145 |

The optimizer returned `STAY_PUT`. The 7-day proposed period is shorter than the configured minimum 30 days, and neither modeled move clears the minimum net-gain threshold. All three vaults also returned `maxDeposit(wallet)=0` for the sample wallet. Centrifuge redemption and settlement may be asynchronous.

Neither an executable rebalance nor a transaction authorization was demonstrated; the saved JSON states `transactionPrepared:false`, `transactionBroadcast:false`, and `privateKeysHandled:false`.

## Reproducibility

The CI script reads the original file, independently recalculates all three annualized rates, both modeled gross and net differences, fee cost and oracle-valued gas, and compares the recorded result to the same `recommend()` function in the deployed app's source. It also tests the minimum holding-period rule by changing the hypothetical period without making any blockchain transaction.

This user-exported run is application-generated evidence; it is not a cryptographically signed attestation of all RPC responses. Separate live GitHub Actions integration tests independently exercised the public Worker against mainnet.

## Reviewer walkthrough

Open the live website, choose Morpho as current and enter the parameters above, then press `Compare live yield sources`. The live block numbers and rates can change. Look for the three sources, fee calculations, `STAY_PUT`, and use `Export JSON proof`. Full source and CI evidence are linked above.

Documentation: [Morpho vault conversion mechanics](https://docs.morpho.org/developers/earn/concepts/vault-mechanics/), [Centrifuge asynchronous vaults](https://docs.centrifuge.io/developer/protocol/features/vaults/), and [Centrifuge share price limitations](https://docs.centrifuge.io/user/concepts/pricing/).
