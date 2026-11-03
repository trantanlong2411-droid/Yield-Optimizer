import {CFG,validateRequest,loadSnapshot,recommend} from './engine.mjs';
import {HTML} from './page.mjs';
const asJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','x-frame-options':'DENY'}});
let number=0;
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
export async function rpc(method,params=[]){
 const allowed=['eth_chainId','eth_blockNumber','eth_getBlockByNumber',
  'eth_getCode','eth_call','eth_gasPrice'];
 if(!allowed.includes(method))throw Error('Read-only RPC method not permitted: '+method);
 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const id=++number;
   const r=await fetch(CFG.rpc,{method:'POST',
    headers:{'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id,method,params}),
    signal:AbortSignal.timeout(16000)});
   if(!r.ok)throw Error('Pharos RPC HTTP '+r.status);
   const body=await r.json();
   if(body.id!==id||body.jsonrpc!=='2.0')throw Error('Pharos JSON-RPC response mismatch');
   if(body.error)throw Error(method+': '+String(body.error.message||'RPC error'));
   if(body.result===undefined||body.result===null)throw Error(method+' returned null');
   return body.result;
  }catch(e){last=e;if(attempt<2)await sleep(450*(attempt+1));}
 }
 throw Error(String(last?.message||'RPC request failed').slice(0,240));
}
export default{
 async fetch(request){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/')return new Response(HTML,{
   headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff'}});
  if(request.method==='GET'&&url.pathname==='/api/health')
   return asJson({ok:true,service:'yield-optimizer',chainId:1672,readOnly:true,
    executionEnabled:false,sources:CFG.vaults.map(x=>x.id),
    note:'This endpoint does not check live RPC or archive availability.'});
  if(request.method!=='POST'||url.pathname!=='/api/analyze')
   return asJson({ok:false,error:'Not found'},404);
  let config;
  try{
   if(Number(request.headers.get('content-length')||0)>4000)throw Error('Input too large');
   const raw=await request.text();
   if(raw.length>4000)throw Error('Input too large');
   config=validateRequest(JSON.parse(raw));
  }catch(error){return asJson({ok:false,decision:'NO_ANALYSIS',error:String(error.message||error)},400)}
  try{
   const data=await loadSnapshot(rpc,config);
   const plan=recommend(data);
   return asJson({ok:true,source:'PHAROS_MAINNET_LIVE_ONCHAIN',
    data,plan,comparisonCount:data.vaults.length,
    transactionBroadcast:false,
    privateKeysUsed:false});
  }catch(error){
   return asJson({ok:false,decision:'NO_VERIFIED_ANALYSIS',
    error:String(error.message||error).slice(0,300),
    transactionBroadcast:false,privateKeysUsed:false},502);
  }
 }
};
