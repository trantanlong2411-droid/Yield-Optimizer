import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest,recommend,CFG} from '../src/engine.mjs';
const base=validateRequest({capitalUSDC:'1000',holdingDays:'90'});
const snapshot={input:base,vaults:[
 {id:'morpho',available:true,apyPercent:3,depositCapacityAvailable:false,asyncExit:false},
 {id:'jtrsy',available:true,apyPercent:8,depositCapacityAvailable:false,asyncExit:true},
 {id:'hyb',available:true,apyPercent:2,depositCapacityAvailable:false,asyncExit:true}],
 gasPriceWei:'10000000000',oracle:{available:true,priceUSD:0.5},blocks:{current:'20000000'}};
test('exactly three identified on-chain yield sources, same underlying intended',()=>{
 assert.equal(CFG.vaults.length,3);
 assert.equal(new Set(CFG.vaults.map(x=>x.contract.toLowerCase())).size,3);
});
test('config requires nonnegative bounded values and known vault',()=>{
 assert.equal(base.capital,1000);
 assert.throws(()=>validateRequest({capitalUSDC:'-5'}),/non-negative/);
 assert.throws(()=>validateRequest({current:'unknown'}),/Unknown/);
 assert.throws(()=>validateRequest({minHoldingDays:'0'}),/within/);
});
test('net model subtracts exit entry slippage fees and gas',()=>{
 const result=recommend(snapshot);
 const candidate=result.compared.find(x=>x.target==='jtrsy');
 assert.equal(candidate.gasCostUSD,0.0021);
 assert.equal(candidate.feeUSD,5);
 assert.ok(candidate.grossGainUSD>candidate.netGainUSD);
 assert.equal(result.decision,'STAY_PUT');
});
test('higher yield does not imply executable rebalance without deposit capacity and async settlement',()=>{
 const result=recommend(snapshot);
 assert.equal(result.transactionPrepared,false);
 assert.equal(result.transactionBroadcast,false);
 assert.ok(result.reason.some(x=>/asynchronous/.test(x)));
});
test('min holding and unknown gas oracle prohibit numeric recommendation',()=>{
 const s={...snapshot,input:validateRequest({holdingDays:'7',minHoldingDays:'30'}),oracle:{available:false}};
 const r=recommend(s);
 assert.equal(r.gasCostUSD,null);
 assert.ok(r.reason.some(x=>/shorter/.test(x)));
 assert.ok(r.compared.every(x=>x.netGainUSD===null));
});
test('unknown historical APY never replaced by zero',()=>{
 const s={...snapshot,vaults:snapshot.vaults.map(x=>({...x,available:false,apyPercent:null}))};
 assert.equal(recommend(s).compared.every(x=>x.netGainUSD===null),true);
});
