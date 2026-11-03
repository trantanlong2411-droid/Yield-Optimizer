import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {CFG,recommend,validateRequest} from '../src/engine.mjs';
const root=(process.env.YIELD_URL||'https://yield-optimizer.trantanlong2411.workers.dev').replace(/\/$/,'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,payload){
 const r=await fetch(root+path,{method:payload?'POST':'GET',
  headers:payload?{'content-type':'application/json'}:{},
  body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(180000)});
 const body=await r.text();let parsed;
 try{parsed=JSON.parse(body)}catch{throw Error('Invalid non-JSON HTTP '+r.status+' '+body.slice(0,150))}
 if(!r.ok||!parsed.ok)throw Error(path+' HTTP '+r.status+': '+JSON.stringify(parsed).slice(0,600));
 return parsed;
}
let health;
for(let i=0;i<24;i++){
 try{health=await api('/api/health');if(health.service==='yield-optimizer')break;}
 catch(e){console.log('WAIT WORKER',i+1,String(e.message).slice(0,160))}
 await sleep(5000);
}
assert.equal(health?.chainId,1672,'Worker not yet deployed');
assert.equal(health?.executionEnabled,false);
const request={wallet:CFG.defaultWallet,current:'morpho',capitalUSDC:'1000',
 holdingDays:'90',minHoldingDays:'30',entryFeeBps:'15',exitFeeBps:'15',
 slippageBps:'20',totalGasUnits:'420000',minNetUSD:'1'};
let result,error;
for(let retry=0;retry<3;retry++){
 try{result=await api('/api/analyze',request);break}
 catch(e){error=e;console.log('LIVE RPC RETRY',retry+1,e.message);if(retry<2)await sleep(17000)}
}
if(!result)throw Error('Public Worker failed live on-chain compare: '+error?.message);
const data=result.data,plan=result.plan;
assert.equal(result.source,'PHAROS_MAINNET_LIVE_ONCHAIN');
assert.equal(data.chainId,1672);
assert.equal(data.vaults.length,3);
assert.deepEqual(data.vaults.map(x=>x.id),CFG.vaults.map(x=>x.id));
assert.ok(BigInt(data.blocks.current)>BigInt(data.blocks.prior));
assert.ok(data.blocks.days>6.8&&data.blocks.days<7.2);
assert.equal(result.transactionBroadcast,false);
assert.equal(result.privateKeysUsed,false);
assert.equal(data.transactionBroadcast,false);
assert.equal(plan.transactionBroadcast,false);
assert.equal(plan.transactionPrepared,false);
assert.equal(plan.decision,'STAY_PUT');
assert.ok(plan.compared.length>=2);
for(const vault of data.vaults){
 assert.equal(vault.block,data.blocks.current);
 assert.equal(vault.priorBlock,data.blocks.prior);
 assert.equal(vault.asset.toLowerCase(),CFG.USDC.toLowerCase());
 console.log('VERIFIED ACTUAL PHAROS YIELD SOURCE',JSON.stringify({
  id:vault.id,contract:vault.contract,
  historicalRate:vault.priorRateRaw,currentRate:vault.currentRateRaw,
  annualizedHistoricalApy:vault.apyPercent,available:vault.available,
  maxDepositRaw:vault.maxDepositRaw,warning:vault.reason||vault.risk
 }));
}
assert.equal(data.vaults.filter(x=>x.available).length,3,
 'Three historical on-chain vault yields required; inspect raw vault errors');
assert.equal(data.oracle.available,true,'Cannot model gas USD using stale/unavailable oracle');
assert.ok(Number(data.gasPriceWei)>=0);
for(const comparison of plan.compared){
 assert.ok(Number.isFinite(comparison.feeUSD));
 assert.ok(comparison.netGainUSD===null||Number.isFinite(comparison.netGainUSD));
 if(comparison.netGainUSD!==null)
  assert.ok(Math.abs(comparison.netGainUSD-(comparison.grossGainUSD-comparison.feeUSD-comparison.gasCostUSD))<1e-7);
}
const replay=recommend({...data,input:validateRequest(request)});
assert.deepEqual(replay,plan);
const short=recommend({...data,input:validateRequest({...request,holdingDays:'7',minHoldingDays:'30'})});
assert.ok(short.reason.some(x=>/shorter/.test(x)));
await mkdir('proof',{recursive:true});
await writeFile('proof/live-yield-proof.json',JSON.stringify({
 schema:'pharos-yield-optimizer-live-v1',testedAt:new Date().toISOString(),
 notes:'Real Pharos mainnet seven-day share-rate history, official USDC vault addresses and price oracle. No transaction prepared or sent.',
 website:root,liveResponse:result,shortHoldingPolicyDecision:short
},null,2)+'\n');
console.log('YIELD OPTIMIZER FULL LIVE PROOF SUCCESS',JSON.stringify({
 block:data.blocks.current,prior:data.blocks.prior,days:data.blocks.days,
 sources:data.vaults.map(x=>({id:x.id,apy:x.apyPercent})),
 oracleUSD:data.oracle.priceUSD,gasPriceWei:data.gasPriceWei,
 decision:plan.decision,reason:plan.reason,artifact:'proof/live-yield-proof.json'}));
