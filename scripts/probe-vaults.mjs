import {Interface} from 'ethers';
const rpc='https://rpc.pharos.xyz';
const abi=new Interface(['function asset() view returns(address)','function decimals() view returns(uint8)','function symbol() view returns(string)','function convertToAssets(uint256) view returns(uint256)','function totalAssets() view returns(uint256)','function totalSupply() view returns(uint256)','function pricePerShare() view returns(uint256)','function maxDeposit(address) view returns(uint256)','function latestAnswer() view returns(int256)','function latestTimestamp() view returns(uint256)']);
let id=0;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(method,params=[]){for(let attempt=0;attempt<3;attempt++){
 try{const resp=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(20000)});if(!resp.ok)throw Error('HTTP '+resp.status);const data=await resp.json();if(data.error)throw Error(String(data.error.message));return data.result;}catch(e){if(attempt===2)throw e;await sleep(1000*(attempt+1));}}}
const addresses=[
 ['Morpho RockawayX','0x047cd0a91e9b92ed979189a6c8a120bf280f02e5'],
 ['Centrifuge JTRSY','0x160e0dd4c4f693b05eca83bc2ec6fd51954fc434'],
 ['Centrifuge JAAA','0x499a9f1ec1d60e6d0d49d3812d326ea659efd6c2'],
 ['Centrifuge HYB','0x74189e017d3aefee48f3cc5bf592694b2a016da8'],
 ['Centrifuge deJTRSY','0xc427d079bda79a703749da3a7b22b121b6bea603']
];
const chain=await call('eth_chainId');const head=BigInt(await call('eth_blockNumber'));
const prev=head-100000n;
console.log('RPC_CHAIN',chain,'HEAD',head.toString(),'OLDER',prev.toString());
for(const [name,address] of addresses){
 const output={name,address,code:false};
 try{const code=await call('eth_getCode',[address,'latest']);output.code=code!=='0x';}catch(e){output.codeError=e.message}
 for(const method of ['asset','decimals','symbol','convertToAssets','totalAssets','totalSupply','pricePerShare','maxDeposit']){
  const args=method==='convertToAssets'?[1000000000000000000n]:method==='maxDeposit'?['0x74B2c2E4E4B771F0C75dcE44f40787468E323f79']:[];
  try{const data=abi.encodeFunctionData(method,args);const r=await call('eth_call',[{to:address,data},'latest']);output[method]=String(abi.decodeFunctionResult(method,r)[0]);}
  catch(e){output[method]='UNAVAILABLE: '+String(e.message).slice(0,85)}
 }
 for(const tag of [prev]){
  try{
   const r=await call('eth_call',[{to:address,data:abi.encodeFunctionData('convertToAssets',[1000000000000000000n])},'0x'+tag.toString(16)]);
   output.historicalRate=String(abi.decodeFunctionResult('convertToAssets',r)[0]);
  }catch(e){output.historicalRate='UNAVAILABLE: '+e.message.slice(0,85)}
 }
 console.log('VAULT_PROBE',JSON.stringify(output));
}
for(const method of ['latestAnswer','latestTimestamp']){
 try{const r=await call('eth_call',[{to:'0x371Ed36aEe5bFFbED1A2aa9b7deD7F4EB30F5466',data:abi.encodeFunctionData(method)},'latest']);console.log('ORACLE_PROBE',method,abi.decodeFunctionResult(method,r)[0].toString());}
 catch(e){console.log('ORACLE_PROBE_FAILED',method,e.message);}
}
