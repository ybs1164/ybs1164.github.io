import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,legal,apply,result,estimateTiles} from './engine.js';

const policy = Array(3137).fill(1);
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
      const policy=Array(3137).fill(0);policy[legal(canon,1)[0]]=1;
      return {policy,value:0};
    };
    const estimate=await estimateTiles(initial(),player,prediction,3);
    assert.equal(estimate.tiles,expected);
  }
});
