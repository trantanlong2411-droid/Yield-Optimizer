import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CFG,recommend,validateRequest} from '../src/engine.mjs';

const file=JSON.parse(await readFile(new URL('../proof/user-export-2026-11-03.json',import.meta.url),'utf8'));
assert.equal(file.ok,true);
assert.equal(file.source,'PHAROS_MAINNET_LIVE_ONCHAIN');
assert.equal(file.transactionBroadcast,false);
assert.equal(file.privateKeysUsed,false);
assert.equal(file.comparisonCount,3);

const s=file.data,c=s.input,plan=file.plan;
assert.equal(s.schema,'pharos-yield-snapshot-v1');
assert.equal(s.chainId,1672);
assert.equal(s.blocks.current,'22008931');
assert.equal(s.blocks.prior,'21399233');
assert.equal(s.blocks.days,7);
assert.equal(s.blocks.currentTimestamp-s.blocks.priorTimestamp,7*86400);
assert.equal(s.readOnly,true);
assert.equal(s.transactionBroadcast,false);
assert.equal(s.vaults.length,3);
assert.deepEqual(s.vaults.map(v=>v.id),['morpho','jtrsy','hyb']);
assert.equal(new Set(s.vaults.map(v=>v.contract.toLowerCase())).size,3);
assert.equal(c.days,7);
assert.equal(c.minDays,30);
assert.equal(c.capital,1000);
assert.equal(c.current,'morpho');

const near=(actual,expected,label)=>assert.ok(
 Number.isFinite(actual)&&Number.isFinite(expected)&&
 Math.abs(actual-expected)<1e-8*Math.max(1,Math.abs(expected)),
 label+' expected '+expected+' got '+actual);

for(const vault of s.vaults){
 assert.equal(vault.block,s.blocks.current);
 assert.equal(vault.priorBlock,s.blocks.prior);
 assert.equal(vault.asset.toLowerCase(),CFG.USDC.toLowerCase());
 assert.equal(vault.available,true);
 assert.equal(vault.maxDepositRaw,'0');
 assert.equal(vault.depositCapacityAvailable,false);
 assert.equal(vault.contract.toLowerCase(),CFG.vaults.find(v=>v.id===vault.id).contract.toLowerCase());
 const old=BigInt(vault.priorRateRaw),current=BigInt(vault.currentRateRaw);
 assert.ok(old>0n&&current>0n);
 const annual=(Math.exp(Math.log(Number(current)/Number(old))*365.2425/s.blocks.days)-1)*100;
 near(annual,vault.apyPercent,vault.id+' observed annualized rate');
}
assert.equal(s.oracle.available,true);
assert.equal(s.oracle.contract.toLowerCase(),CFG.oracle.toLowerCase());
assert.ok(s.oracle.ageSeconds>=0&&s.oracle.ageSeconds<86400);
assert.equal(s.gasPriceWei,'10000000000');
const gasUSD=Number(s.gasPriceWei)/1e18*c.gasUnits*s.oracle.priceUSD;
near(gasUSD,plan.gasCostUSD,'oracle-valued gas');
const origin=s.vaults.find(x=>x.id===c.current);
for(const modeled of plan.compared){
 const target=s.vaults.find(x=>x.id===modeled.target);
 assert.ok(target);
 const gross=c.capital*(
  Math.pow(1+target.apyPercent/100,c.days/365.2425)
  -Math.pow(1+origin.apyPercent/100,c.days/365.2425));
 const fee=c.capital*(c.entryBps+c.exitBps+c.slippageBps)/10000;
 near(gross,modeled.grossGainUSD,modeled.target+' gross');
 near(fee,modeled.feeUSD,modeled.target+' fees');
 near(gasUSD,modeled.gasCostUSD,modeled.target+' gas');
 near(gross-fee-gasUSD,modeled.netGainUSD,modeled.target+' net');
 assert.ok(modeled.netGainUSD<0,'No positive net gain for this test case');
 assert.ok(modeled.reasons.some(x=>x.includes('maxDeposit')));
}
assert.equal(plan.decision,'STAY_PUT');
assert.equal(plan.transactionBroadcast,false);
assert.equal(plan.transactionPrepared,false);
assert.equal(plan.privateKeysHandled,false);
assert.ok(plan.reason.some(x=>x.includes('shorter than configured minimum')));
assert.ok(plan.reason.some(x=>x.includes('No verified positive net gain')));
const normalizedConfig=validateRequest({
 wallet:c.wallet,current:c.current,capitalUSDC:String(c.capital),
 holdingDays:String(c.days),minHoldingDays:String(c.minDays),
 entryFeeBps:String(c.entryBps),exitFeeBps:String(c.exitBps),
 slippageBps:String(c.slippageBps),totalGasUnits:String(c.gasUnits),
 minNetUSD:String(c.minNetUSD)
});
assert.deepEqual(normalizedConfig,c);
assert.deepEqual(recommend(s),plan,'User-exported optimizer output must replay exactly from inputs');
const longer=recommend({...s,input:validateRequest({
 wallet:c.wallet,current:c.current,capitalUSDC:String(c.capital),
 holdingDays:'45',minHoldingDays:'30',
 entryFeeBps:String(c.entryBps),exitFeeBps:String(c.exitBps),
 slippageBps:String(c.slippageBps),totalGasUnits:String(c.gasUnits),
 minNetUSD:String(c.minNetUSD)
})});
assert.ok(!longer.reason.some(x=>x.includes('shorter than configured minimum')));
assert.equal(longer.transactionBroadcast,false);
assert.equal(longer.decision,'STAY_PUT');
console.log('USER YIELD EXPORT REPLAY VERIFIED',JSON.stringify({
 block:s.blocks.current,prior:s.blocks.prior,days:s.blocks.days,
 historicRates:s.vaults.map(v=>({id:v.id,apy:v.apyPercent})),
 comparisons:plan.compared.map(v=>({target:v.target,netUSD:v.netGainUSD})),
 gasCostUSD:plan.gasCostUSD,policyDecision:plan.decision,
 holdingPeriodRuleVerified:true,transactionBroadcast:false
}));
