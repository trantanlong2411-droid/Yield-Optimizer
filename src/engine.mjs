import {Interface} from 'ethers';
export const CFG={
 chainId:1672,rpc:'https://rpc.pharos.xyz',USDC:'0xc879c018db60520f4355c26ed1a6d572cdac1815',
 oracle:'0x371Ed36aEe5bFFbED1A2aa9b7deD7F4EB30F5466',
 defaultWallet:'0x74B2c2E4E4B771F0C75dcE44f40787468E323f79',
 vaults:[
  {id:'morpho',name:'Morpho · RockawayX USDC',protocol:'Morpho',contract:'0x047cd0a91e9b92ed979189a6c8a120bf280f02e5',method:'convertToAssets',shares:'1000000000000000000',asyncExit:false,
   source:'https://github.com/DefiLlama/dimension-adapters/blob/master/factory/curators.ts'},
  {id:'jtrsy',name:'Centrifuge · JTRSY / USDC',protocol:'Centrifuge',contract:'0x160e0dd4c4f693b05eca83bc2ec6fd51954fc434',method:'pricePerShare',asyncExit:true,
   source:'https://docs.centrifuge.io/developer/protocol/deployments/'},
  {id:'hyb',name:'Centrifuge · HYB / USDC',protocol:'Centrifuge',contract:'0x74189e017d3aefee48f3cc5bf592694b2a016da8',method:'pricePerShare',asyncExit:true,
   source:'https://docs.centrifuge.io/developer/protocol/deployments/'}
 ]
};
export const ABI=new Interface([
 'function asset() view returns(address)',
 'function convertToAssets(uint256) view returns(uint256)',
 'function pricePerShare() view returns(uint256)',
 'function maxDeposit(address) view returns(uint256)',
 'function latestAnswer() view returns(int256)',
 'function latestTimestamp() view returns(uint256)'
]);
export function validateRequest(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected request object');
 const decimal=(name,value,min,max)=>{
  const str=String(value);
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(str))throw Error(name+' must be a non-negative decimal (max 4 places)');
  const n=Number(str);
  if(!Number.isFinite(n)||n<min||n>max)throw Error(name+' must be within '+min+' and '+max);
  return n;
 };
 const capital=decimal('capitalUSDC',input.capitalUSDC??'1000',10,10000000);
 const days=decimal('holdingDays',input.holdingDays??'90',1,730);
 const minDays=decimal('minHoldingDays',input.minHoldingDays??'30',1,730);
 const entryBps=decimal('entryFeeBps',input.entryFeeBps??'15',0,1000);
 const exitBps=decimal('exitFeeBps',input.exitFeeBps??'15',0,1000);
 const slippageBps=decimal('slippageBps',input.slippageBps??'20',0,1000);
 const gasUnits=decimal('totalGasUnits',input.totalGasUnits??'420000',21000,10000000);
 const minNetUSD=decimal('minNetUSD',input.minNetUSD??'1',0,1000000);
 const current=String(input.current||'morpho');
 if(!['morpho','jtrsy','hyb','wallet'].includes(current))throw Error('Unknown current allocation');
 const wallet=String(input.wallet||CFG.defaultWallet);
 if(!/^0x[0-9A-Fa-f]{40}$/.test(wallet))throw Error('Invalid EVM wallet');
 return {capital,days,minDays,entryBps,exitBps,slippageBps,gasUnits,minNetUSD,current,wallet};
}
export const hex=n=>'0x'+BigInt(n).toString(16);
export async function readContract(rpc,address,method,args,block){
 const data=ABI.encodeFunctionData(method,args);
 const raw=await rpc('eth_call',[{to:address,data},hex(block)]);
 if(!raw||raw==='0x')throw Error(method+' empty response');
 return ABI.decodeFunctionResult(method,raw)[0];
}
export async function findHistoricalBlock(rpc,head,targetDays=7){
 const headBlock=await rpc('eth_getBlockByNumber',[hex(head),false]);
 if(!headBlock?.timestamp)throw Error('Latest block timestamp missing');
 const latestTime=Number(BigInt(headBlock.timestamp)),desired=latestTime-targetDays*86400;
 let lo=BigInt(head)>5000000n?BigInt(head)-5000000n:1n,hi=BigInt(head);
 let older=await rpc('eth_getBlockByNumber',[hex(lo),false]);
 if(!older?.timestamp)throw Error('Historical RPC is not available');
 if(Number(BigInt(older.timestamp))>desired){lo=1n;older=await rpc('eth_getBlockByNumber',[hex(lo),false])}
 if(!older?.timestamp||Number(BigInt(older.timestamp))>desired)throw Error('Insufficient age for 7-day yield history');
 for(let i=0;i<25&&hi-lo>1n;i++){
  const mid=(lo+hi)/2n;
  const b=await rpc('eth_getBlockByNumber',[hex(mid),false]);
  if(!b?.timestamp)throw Error('RPC cannot access historical state');
  if(Number(BigInt(b.timestamp))<=desired)lo=mid;else hi=mid;
 }
 const prior=await rpc('eth_getBlockByNumber',[hex(lo),false]);
 return {current:BigInt(head).toString(),prior:lo.toString(),
  currentTimestamp:latestTime,priorTimestamp:Number(BigInt(prior.timestamp)),
  days:(latestTime-Number(BigInt(prior.timestamp)))/86400,
  targetDays};
}
export async function readVault(rpc,v,bounds,wallet){
 const result={id:v.id,name:v.name,protocol:v.protocol,contract:v.contract,source:v.source,
  modelMethod:v.method,asyncExit:v.asyncExit,block:bounds.current,priorBlock:bounds.prior,
  available:false,apyPercent:null,quantityUnit:'USDC'};
 const block=bounds.current;
 try{
  const code=await rpc('eth_getCode',[v.contract,hex(block)]);
  if(!code||code==='0x')throw Error('No verified vault code on pinned block');
  const asset=String(await readContract(rpc,v.contract,'asset',[],block));
  result.asset=asset;
  if(asset.toLowerCase()!==CFG.USDC.toLowerCase())throw Error('Underlying asset is not Pharos USDC');
  const args=v.method==='convertToAssets'?[BigInt(v.shares)]:[];
  const current=BigInt(await readContract(rpc,v.contract,v.method,args,block));
  const prior=BigInt(await readContract(rpc,v.contract,v.method,args,bounds.prior));
  result.currentRateRaw=current.toString();result.priorRateRaw=prior.toString();
  result.rateUnits='USDC smallest units / normalized 1 share (same method on both blocks)';
  try{
   const cap=BigInt(await readContract(rpc,v.contract,'maxDeposit',[wallet],block));
   result.maxDepositRaw=cap.toString();result.depositCapacityAvailable=cap>0n;
  }catch(e){result.maxDepositRaw=null;result.depositCapacityAvailable=false;
    result.capacityWarning='maxDeposit(wallet) unavailable: '+String(e.message).slice(0,110)}
  if(current<=0n||prior<=0n)throw Error('Zero rate: historical APY cannot be determined');
  const ratio=Number(current)/Number(prior),elapsed=bounds.days*86400;
  if(!(ratio>0)||!Number.isFinite(ratio)||elapsed<86400)
   throw Error('Insufficient valid historical price interval (requires at least 1 day)');
  const apr=(Math.exp(Math.log(ratio)*365.2425*86400/elapsed)-1)*100;
  if(!Number.isFinite(apr)||apr<=-100||apr>1000)throw Error('Annualized historical rate outside plausibility guard');
  result.apyPercent=apr;result.available=true;
  result.metric='Historical 7-day share-price annualization, NOT a guaranteed forward APY';
  result.risk=v.asyncExit?'Centrifuge redemptions are asynchronous; execution time and settlement price are not guaranteed.':'Deposits and withdrawal capacity must be checked with the actual wallet before any rebalance.';
 }catch(e){result.reason=String(e.message||e).slice(0,260)}
 return result;
}
export async function readOracle(rpc,head,now){
 const out={available:false,contract:CFG.oracle,block:head,source:'https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe'};
 try{
  const [price,stamp]=await Promise.all([
   readContract(rpc,CFG.oracle,'latestAnswer',[],head),
   readContract(rpc,CFG.oracle,'latestTimestamp',[],head)
  ]);
  const n=Number(price)/1e18,ts=Number(stamp),age=now-ts;
  Object.assign(out,{priceUSD:n,oracleTimestamp:ts,ageSeconds:age,
   available:n>0&&Number.isFinite(n)&&age>=0&&age<86400});
  if(!out.available)out.reason='Oracle negative, zero or older than 24h';
 }catch(e){out.reason=String(e.message||e).slice(0,180)}
 return out;
}
export async function loadSnapshot(rpc,config,at=new Date().toISOString()){
 const chain=await rpc('eth_chainId',[]);
 if(Number(BigInt(chain))!==CFG.chainId)throw Error('Expected Pharos Mainnet 1672');
 const latest=BigInt(await rpc('eth_blockNumber',[]));
 const bounds=await findHistoricalBlock(rpc,latest,7);
 const vaults=[];
 for(const v of CFG.vaults)vaults.push(await readVault(rpc,v,bounds,config.wallet));
 const gasWei=BigInt(await rpc('eth_gasPrice',[]));
 const oracle=await readOracle(rpc,bounds.current,bounds.currentTimestamp);
 return {schema:'pharos-yield-snapshot-v1',chainId:1672,observedAt:at,
  blocks:bounds,vaults,oracle,gasPriceWei:gasWei.toString(),
  input:config,readOnly:true,transactionBroadcast:false,
  note:'Historical vault share price change is not forward APY. No withdrawal liquidity, subscription access or execution eligibility is promised.'};
}
export function recommend(snapshot){
 const c=snapshot.input,list=snapshot.vaults,baseline=list.find(v=>v.id===c.current);
 const reasons=[],year=365.2425;
 const modeled=[];
 let gasCostUSD=null;
 if(snapshot.oracle.available){
  gasCostUSD=Number(snapshot.gasPriceWei)/1e18*c.gasUnits*snapshot.oracle.priceUSD;
 }else reasons.push('Cannot translate gas to USD: on-chain PROS/USD oracle is unavailable or stale');
 if(c.days<c.minDays)reasons.push('Proposed holding period is shorter than configured minimum');
 if(c.current!=='wallet'&&!baseline?.available)reasons.push('Current vault historical yield is unavailable');
 const originApy=c.current==='wallet'?0:baseline?.apyPercent??null;
 for(const v of list){
  if(v.id===c.current)continue;
  const warnings=[];
  if(!v.available)warnings.push(v.reason||'Historical APY unavailable');
  if(v.asyncExit)warnings.push('Async Centrifuge redeem/settlement prevents assuming immediate rebalance');
  if(!v.depositCapacityAvailable)warnings.push('maxDeposit(wallet) returned zero or could not be verified');
  if(originApy===null)warnings.push('Current source APY not verified');
  if(gasCostUSD===null)warnings.push('Gas USD price not verified');
  const feeUSD=c.capital*((c.current==='wallet'?0:c.exitBps)+c.entryBps+c.slippageBps)/10000;
  let grossGainUSD=null,netGainUSD=null;
  if(v.available&&originApy!==null&&gasCostUSD!==null){
   const toFactor=Math.pow(1+v.apyPercent/100,c.days/year);
   const fromFactor=Math.pow(1+originApy/100,c.days/year);
   grossGainUSD=c.capital*(toFactor-fromFactor);
   netGainUSD=grossGainUSD-feeUSD-gasCostUSD;
  }
  modeled.push({target:v.id,name:v.name,contract:v.contract,targetHistoricalApy:v.apyPercent,
   sourceHistoricalApy:originApy,grossGainUSD,feeUSD,gasCostUSD,netGainUSD,
   modeledNotGuaranteed:true,sourceBlock:snapshot.blocks.current,
   reasons:warnings});
 }
 modeled.sort((a,b)=>(b.netGainUSD??-Infinity)-(a.netGainUSD??-Infinity));
 const best=modeled.find(x=>x.netGainUSD!==null&&x.netGainUSD>c.minNetUSD);
 if(best){
  const target=list.find(x=>x.id===best.target);
  if(target.asyncExit)reasons.push('Best modeled target requires asynchronous redemption or fulfillment; immediate exit cannot be assumed');
  if(!target.depositCapacityAvailable)reasons.push('Best modeled target cannot currently accept a deposit for this address (maxDeposit unavailable or zero)');
 }
 if(!best)reasons.push('No verified positive net gain above the configured minimum');
 // Read-only conservative policy: the assistant has no verified path for atomic exit + entry.
 // It never presents a candidate as executable without both exit liquidity and permission checks.
 reasons.push('No verified end-to-end withdrawal, redeem queue, deposit/approval route or signature plan is available; do not execute from this estimate');
 return {decision:'STAY_PUT',recommendation:'Stay put — no safe, executable rebalance is verified.',
  mostPromisingModel:best||modeled[0]||null,
  compared:modeled,gasCostUSD,reason:[...new Set(reasons)],
  methodology:'Annualized on-chain share-price observations over real block timestamps; hypothetical holding period, estimated fees and gas. Forward returns may differ.',
  transactionPrepared:false,transactionBroadcast:false,privateKeysHandled:false};
}
