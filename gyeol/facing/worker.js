import * as ort from '../play/vendor/ort.wasm.min.mjs';
import {initial,legal,decode,apply,payload,search,result,estimateTiles} from './engine.js';
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=new URL('../play/vendor/',import.meta.url).href;
let session;
async function predict(b){
  session??=ort.InferenceSession.create(new URL('./model.onnx?v=42eabafdc67e61e2',import.meta.url).href,{executionProviders:['wasm']});
  const net=await session;
  const out=await net.run({board:new ort.Tensor('float32',Float32Array.from(b),[1,7,7])});
  if(out.log_policy.data.length!==785)throw Error('마주보기 규칙용 모델이 아닙니다.');
  return {policy:Array.from(out.log_policy.data,Math.exp),value:out.value.data[0]};
}
self.onmessage=async({data:{id,path,body={}}})=>{
  try{
    let out;
    if(path==='/api/evaluate')out=await estimateTiles(body.board.flat(),body.player,predict);
    else if(path==='/api/new')out=payload(initial(),1);
    else {
      const b=body.board.flat(),p=body.player;
      if(result(b,p))throw Error('이미 끝난 게임입니다.');
      let a,extra={};
      if(path==='/api/ai'){
        const canon=b.map(v=>v*p);
        a=await search(canon,50,predict);
        extra={aiMove:decode(a),aiValue:(await predict(canon)).value};
      }else if(path==='/api/move'){
        a=legal(b,p).find(a=>JSON.stringify(decode(a))===JSON.stringify(body.move));
        if(a===undefined)throw Error('둘 수 없는 수입니다.');
      }else throw Error('알 수 없는 요청입니다.');
      const next=apply(b,p,a);out=payload(next.board,-p,{last:next.last,...extra});
    }
    self.postMessage({id,data:out});
  }catch(e){session=undefined;self.postMessage({id,error:e.message});}
};
