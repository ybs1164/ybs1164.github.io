// Browser port of gyeol_ai/GyeolLogic.py. Action indices match the trained policy.
export const N = 7, PASS = 3136;
const dirs = [[-1,0],[0,1],[1,0],[0,-1]];
export function initial() { const b = Array(49).fill(0); b[23]=2; b[24]=-4; return b; }
function bounds(b) {
  let r0=7,r1=0,c0=7,c1=0;
  b.forEach((v,i)=>{if(v){const r=Math.floor(i/7),c=i%7;r0=Math.min(r0,r);r1=Math.max(r1,r);c0=Math.min(c0,c);c1=Math.max(c1,c);}});
  return [r0,r1,c0,c1];
}
export function decode(a) {
  if(a===PASS)return [];
  const pd=a%4, nb=Math.floor(a/4)%4, nd=Math.floor(a/16)%4, cell=Math.floor(a/64),r=Math.floor(cell/7),c=cell%7;
  return [r,c,nd,r+dirs[nb][0],c+dirs[nb][1],pd];
}
export function legal(b,p) {
  const [r0,r1,c0,c1]=bounds(b), out=[];
  b.forEach((v,i)=>{if(v*p>=0)return;const r=Math.floor(i/7),c=i%7;
    for(let nd=0;nd<4;nd++)if(nd!==Math.abs(v)-1)for(let nb=0;nb<4;nb++){
      const pr=r+dirs[nb][0],pc=c+dirs[nb][1];
      if(pr<0||pr>=7||pc<0||pc>=7||b[pr*7+pc]||Math.max(r1,pr)-Math.min(r0,pr)>=5||Math.max(c1,pc)-Math.min(c0,pc)>=5)continue;
      for(let pd=0;pd<4;pd++)out.push(i*64+nd*16+nb*4+pd);
    }
  });
  return out.length?out:[PASS];
}
export function result(b,p) {
  if(b.filter(Boolean).length<25 && (legal(b,p)[0]!==PASS||legal(b,-p)[0]!==PASS))return 0;
  return Math.sign(b.reduce((s,v)=>s+Math.sign(v),0)*p)||0.0001;
}
export function apply(b,p,a) {
  b=b.slice();if(a===PASS)return {board:b,last:{pass:true}};
  const [r,c,nd,pr,pc,pd]=decode(a);b[r*7+c]=-p*(nd+1);b[pr*7+pc]=p*(pd+1);
  let rr=pr+dirs[pd][0],cc=pc+dirs[pd][1],path=[],flipped=[];const seen=new Set();
  while(rr>=0&&rr<7&&cc>=0&&cc<7&&b[rr*7+cc]){
    const i=rr*7+cc,v=b[i];
    if(v*p>0){if(rr!==pr||cc!==pc)flipped=path;break;}
    if(seen.has(i))break;seen.add(i);path.push([rr,cc]);const d=Math.abs(v)-1;rr+=dirs[d][0];cc+=dirs[d][1];
  }
  for(const [fr,fc] of flipped)b[fr*7+fc]*=-1;
  const [r0,r1,c0,c1]=bounds(b),dr=Math.floor((7-(r1-r0+1))/2)-r0,dc=Math.floor((7-(c1-c0+1))/2)-c0;
  const out=Array(49).fill(0);b.forEach((v,i)=>{if(v)out[(Math.floor(i/7)+dr)*7+i%7+dc]=v;});
  return {board:out,last:{rotated:[r+dr,c+dc],placed:[pr+dr,pc+dc],flipped:flipped.map(([r,c])=>[r+dr,c+dc])}};
}
export function payload(b,p,extra={}) {
  const end=result(b,p);
  return {board:Array.from({length:7},(_,r)=>b.slice(r*7,r*7+7)),player:p,ended:end!==0,winner:end>0.5?p:end<-.5?-p:0,green:b.filter(v=>v>0).length,brown:b.filter(v=>v<0).length,moves:end?[]:legal(b,p).map(decode),model:{loaded:true},...extra};
}
export async function search(board,sims,predict) {
  const tree=new Map();
  async function visit(b){
    const end=result(b,1);if(end)return -end;
    const key=b.join(',');let node=tree.get(key);
    if(!node){
      const {policy,value}=await predict(b),actions=legal(b,1);
      let sum=actions.reduce((s,a)=>s+policy[a],0);
      node={n:0,edges:actions.map(a=>({a,p:sum>0?policy[a]/sum:1/actions.length,n:0,q:0}))};tree.set(key,node);return -value;
    }
    let best=node.edges[0],score=-Infinity;
    for(const e of node.edges){const u=e.n?e.q+1.5*e.p*Math.sqrt(node.n)/(1+e.n):1.5*e.p*Math.sqrt(node.n+1e-8);if(u>score){score=u;best=e;}}
    const v=await visit(apply(b,1,best.a).board.map(v=>-v));
    best.q=(best.q*best.n+v)/(best.n+1);best.n++;node.n++;return -v;
  }
  for(let i=0;i<sims;i++)await visit(board);
  const edges=tree.get(board.join(',')).edges,max=Math.max(...edges.map(e=>e.n)),best=edges.filter(e=>e.n===max);
  return best[Math.floor(Math.random()*best.length)].a;
}

// Estimate final tile margin by completing games with the trained policy.
// Unlike the value head (win/loss), terminal margins have actual tile units.
export async function estimateTiles(board,player,predict,samples=12) {
  const margin=b=>b.reduce((sum,v)=>sum+Math.sign(v),0);
  if(result(board,player))return {tiles:margin(board),samples:0,exact:true};
  let seed=2166136261;
  for(const v of [...board,player])seed=Math.imul(seed^(v+5),16777619)>>>0;
  function random(){
    seed=(seed+0x6D2B79F5)>>>0;
    let t=Math.imul(seed^(seed>>>15),1|seed);
    t^=t+Math.imul(t^(t>>>7),61|t);
    return ((t^(t>>>14))>>>0)/4294967296;
  }
  const cache=new Map(),margins=[];
  for(let sample=0;sample<samples;sample++){
    let b=board.slice(),p=player;
    for(let ply=0;!result(b,p);ply++){
      if(ply>=50)throw Error('Tile evaluation did not reach a terminal position.');
      const canon=b.map(v=>v*p),actions=legal(canon,1);
      let a=actions[0];
      if(actions.length>1){
        const key=canon.join(',');
        let weights=cache.get(key);
        if(!weights){
          const {policy}=await predict(canon);
          // Use the learned policy directly; no invented win-to-tile conversion.
          weights=actions.map(action=>Math.max(0,policy[action]||0));
          cache.set(key,weights);
        }
        const total=weights.reduce((sum,w)=>sum+w,0);
        if(total>0){
          let draw=random()*total;
          a=actions[actions.length-1];
          for(let i=0;i<actions.length;i++)if((draw-=weights[i])<0){a=actions[i];break;}
        }else a=actions[Math.floor(random()*actions.length)];
      }
      b=apply(b,p,a).board;p=-p;
    }
    margins.push(margin(b));
  }
  return {tiles:margins.reduce((sum,v)=>sum+v,0)/samples,samples,exact:false};
}
