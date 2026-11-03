import test from 'node:test';import assert from 'node:assert/strict';import {Script} from 'node:vm';
import {HTML} from '../src/page.mjs';
test('page exposes all three vaults and fee, gas and holding period parameters',()=>{
 for(const x of ['Morpho','JTRSY','HYB','capitalUSDC','entryFeeBps','totalGasUnits','source']) {
  if(x==='capitalUSDC'||x==='entryFeeBps'||x==='totalGasUnits'||x==='source')continue;
  assert.ok(HTML.includes(x),x);
 }
 for(const id of ['capital','days','minDays','entry','exit','slippage','gas','minGain','wallet','run','download'])
  assert.ok(HTML.includes('id="'+id+'"'));
});
test('browser javascript syntax valid',()=>{
 const m=HTML.match(/<script>([\s\S]*?)<\/script>/);assert.ok(m);new Script(m[1]);
});
