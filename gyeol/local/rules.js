import {legal, apply as applyMove, payload} from '../play/engine.js';

export {legal, payload};

export function apply(board, player, action) {
  if (!legal(board, player).includes(action)) throw new Error('둘 수 없는 수입니다.');
  return applyMove(board, player, action);
}
