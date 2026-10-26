import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,legal,decode,apply,result,estimateTiles,PASS} from './engine.js';

const policy = Array(PASS + 1).fill(1);

test('default actions fix placement toward the rotated opponent in every direction',()=>{
  assert.equal(PASS,784);
  const directions=[[-1,0],[0,1],[1,0],[0,-1]], seen=new Set();
  for(const player of [1,-1]){
    const board=initial(), actions=legal(board,player);
    assert.equal(actions.length,9);
    for(const action of actions){
      const [r,c,nd,pr,pc,pd]=decode(action), [dr,dc]=directions[pd];
      assert.equal(pr+dr,r);
      assert.equal(pc+dc,c);
      assert.notEqual(nd,Math.abs(board[r*7+c])-1);
      const next=apply(board,player,action);
      const [rr,rc]=next.last.rotated, [nr,nc]=next.last.placed;
      assert.equal(nr+dr,rr);
      assert.equal(nc+dc,rc);
      assert.equal(next.board[nr*7+nc],player*(pd+1));
      seen.add(pd);
    }
  }
  assert.equal(seen.size,4);
});

test('captures follow the rotated tile and leave loops uncaptured',()=>{
  const board=Array(49).fill(0);
  board[3*7+2]=2;
  board[3*7+3]=-1;
  const action=legal(board,1).find(a=>JSON.stringify(decode(a))===JSON.stringify([3,3,3,3,4,3]));
  assert.notEqual(action,undefined);
  const next=apply(board,1,action);
  assert.deepEqual(next.last.flipped,[next.last.rotated]);
  assert.equal(next.board.filter(v=>v>0).length,3);

  const loop=legal(board,1).find(a=>JSON.stringify(decode(a))===JSON.stringify([3,3,1,3,4,3]));
  assert.notEqual(loop,undefined);
  assert.deepEqual(apply(board,1,loop).last.flipped,[]);
});
test('terminal scores are exact tile margins in green perspective', async()=>{
  const b=Array(49).fill(0);
  for(let r=1;r<=5;r++)for(let c=1;c<=5;c++)b[r*7+c]=r<4?1:-1;
  for(const p of [1,-1]){
    assert.deepEqual(await estimateTiles(b,p,()=>{throw Error('No inference needed');}),
      {tiles:5,samples:0,exact:true});
  }
});

test('rollouts are deterministic, bounded, and independent of win value',async()=>{
  const b=initial(),copy=b.slice();
  const first=await estimateTiles(b,1,async()=>({policy,value:1}),12);
  const second=await estimateTiles(b,1,async()=>({policy,value:-1}),12);
  assert.deepEqual(first,second);
  assert.deepEqual(b,copy);
  assert.ok(Math.abs(first.tiles)<=25);
  assert.equal(first.samples,12);
  assert.equal(first.exact,false);
});

test('a forced learned policy yields its actual final margin for either player',async()=>{
  for(const player of [1,-1]){
    let b=initial(),p=player;
    while(!result(b,p)){b=apply(b,p,legal(b,p)[0]).board;p=-p;}
    const expected=b.reduce((sum,v)=>sum+Math.sign(v),0);
    const prediction=async canon=>{
      const policy=Array(PASS+1).fill(0);policy[legal(canon,1)[0]]=1;
      return {policy,value:0};
    };
    const estimate=await estimateTiles(initial(),player,prediction,3);
    assert.equal(estimate.tiles,expected);
  }
});
