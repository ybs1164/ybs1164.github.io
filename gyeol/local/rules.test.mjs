import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial, decode, legal as defaultLegal, PASS} from '../play/engine.js';
import {legal, apply, payload} from './rules.js';

test('placement always points at the rotated opponent in all four directions', () => {
  const board = initial(), directions = new Set();
  for (const player of [1, -1]) {
    const actions = legal(board, player);
    assert.deepEqual(actions, defaultLegal(board, player));
    for (const action of actions) {
      const [r, c, , pr, pc, pd] = decode(action);
      const [dr, dc] = [[-1,0],[0,1],[1,0],[0,-1]][pd];
      assert.equal(pr + dr, r); assert.equal(pc + dc, c);
      directions.add(pd);
    }
    const invalid = defaultLegal(board, -player)[0];
    assert.throws(() => apply(board, player, invalid));
  }
  assert.equal(directions.size, 4);
});

test('alternating full games preserve limits and reach a scored ending', () => {
  for (let game = 0; game < 20; game++) {
    let board = initial(), player = 1, turns = 0;
    while (!payload(board, player).ended) {
      const actions = legal(board, player), action = actions[(game * 17 + turns * 7) % actions.length];
      const before = board.filter(Boolean).length;
      board = apply(board, player, action).board;
      assert.equal(board.filter(Boolean).length, before + (action === PASS ? 0 : 1));
      const occupied = board.flatMap((v, i) => v ? [i] : []);
      for (const coords of [occupied.map(i => Math.floor(i / 7)), occupied.map(i => i % 7)])
        assert.ok(Math.max(...coords) - Math.min(...coords) < 5);
      player = -player;
      assert.ok(++turns < 50);
    }
    const state = payload(board, player);
    assert.equal(state.winner, Math.sign(state.green - state.brown));
    assert.deepEqual(state.moves, []);
  }
});

test('a player with no opponent tiles can pass; a full board ends', () => {
  const board = initial().map(v => Math.abs(v));
  assert.deepEqual(legal(board, 1), [PASS]);
  assert.equal(payload(board, 1).ended, false);
  assert.deepEqual(apply(board, 1, PASS).board, board);
  const full = Array(49).fill(0);
  for (let r = 1; r <= 5; r++) for (let c = 1; c <= 5; c++) full[r * 7 + c] = 1;
  assert.equal(payload(full, -1).ended, true);
  assert.equal(payload(full, -1).winner, 1);
});
