import {initial, decode} from '../play/engine.js';
import {legal, apply, payload} from './rules.js';
const N = 7, ARROW = ['↑', '→', '↓', '←'];
const $ = id => document.getElementById(id);
let S, human = 1, busy = false, sel = {}, last = null, animate = null;
const history = [];
function arrowSVG(dir) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g style="transform: rotate(${dir * 90}deg)">
    <path d="M50 14 L80 46 L63 46 L63 86 L50 76 L37 86 L37 46 L20 46 Z" fill="var(--arrow)"
      stroke="rgba(0,0,0,.35)" stroke-width="3" stroke-linejoin="round"/></g></svg>`;
}

function movesFiltered() {
  if (!S || S.ended || S.player !== human) return [];
  return S.moves.filter(m => m.length &&
    (sel.r === undefined || (m[0] === sel.r && m[1] === sel.c)) &&
    (sel.nd === undefined || m[2] === sel.nd) &&
    (sel.pr === undefined || (m[3] === sel.pr && m[4] === sel.pc)));
}

function phase() {
  if (sel.r === undefined) return 'rotate';
  if (sel.nd === undefined) return 'rotateDir';
  return 'place';
}

function render() {
  const board = $('board');
  board.innerHTML = '';
  const ms = movesFiltered();
  const ph = phase();
  const myTurn = S && !S.ended && S.player === human && !busy;
  const key = (r, c) => r * N + c;
  const pickable = new Set(), targets = new Set();
  if (myTurn) {
    if (ph === 'rotate') ms.forEach(m => pickable.add(key(m[0], m[1])));
    if (ph === 'place') ms.forEach(m => targets.add(key(m[3], m[4])));
  }
  const flippedSet = new Set((animate?.flipped || []).map(([r, c]) => key(r, c)));
  const lp = last?.placed, lr = last?.rotated;

  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    let v = S ? S.board[r][c] : 0;
    let ghost = false;
    // 선택 미리보기
    if (sel.r === r && sel.c === c && sel.nd !== undefined) v = Math.sign(v) * (sel.nd + 1);
    if (sel.pr === r && sel.pc === c) { v = human * 1; ghost = true; }

    if (v !== 0) {
      const t = document.createElement('div');
      const dir = Math.abs(v) - 1;
      t.className = 'tile ' + (v > 0 ? 'g' : 'b');
      if (ghost) t.classList.add('ghost');
      if (pickable.has(key(r, c))) { t.classList.add('pickable'); t.onclick = () => { sel = { r, c }; render(); }; }
      if (sel.r === r && sel.c === c) t.classList.add('selected');
      if (!ghost && lp && lp[0] === r && lp[1] === c) t.classList.add('last-place');
      if (!ghost && lr && lr[0] === r && lr[1] === c) t.classList.add('last-rotate');
      if (flippedSet.has(key(r, c))) t.classList.add('flip');
      if (animate?.placed && animate.placed[0] === r && animate.placed[1] === c) t.classList.add('pop');
      t.innerHTML = ghost ? '' : arrowSVG(dir);
      // 기존 타일을 다른 상대 타일로 바꿔 고르기
      if (myTurn && ph !== 'rotate' && Math.sign(v) === -human && !(sel.r === r && sel.c === c) &&
          S.moves.some(m => m.length && m[0] === r && m[1] === c)) {
        t.classList.add('pickable'); t.onclick = () => { sel = { r, c }; render(); };
      }
      cell.appendChild(t);
    } else if (targets.has(key(r, c))) {
      cell.classList.add('target');
      if (human === -1) cell.classList.add('mine-b');
      cell.onclick = () => submit(ms.find(m => m[3] === r && m[4] === c));
      const preview = ms.find(m => m[3] === r && m[4] === c);
      cell.innerHTML = arrowSVG(preview[5]);
    }

    // 방향 고르기
    if (myTurn && ph === 'rotateDir' && sel.r === r && sel.c === c) {
      cell.appendChild(picker([...new Set(ms.map(m => m[2]))], d => { sel.nd = d; render(); }));
    }
    const clickable = cell.onclick ? cell : cell.querySelector('.tile.pickable');
    if (clickable) {
      clickable.tabIndex = 0;
      clickable.setAttribute('role', 'button');
      clickable.setAttribute('aria-label', `${r + 1}행 ${c + 1}열 ${v ? '상대 타일 선택' : '타일 놓기'}`);
      clickable.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickable.click(); } };
    }
    board.appendChild(cell);
  }
  animate = null;
  $('undoBtn').disabled = history.length === 0;
  $('cancelBtn').disabled = !(myTurn && sel.r !== undefined);
  renderStatus();
}

function picker(dirs, onPick) {
  const p = document.createElement('div');
  p.className = 'picker';
  dirs.sort().forEach(d => {
    const b = document.createElement('button');
    b.className = 'd' + d;
    b.textContent = ARROW[d];
    b.title = ['북', '동', '남', '서'][d];
    b.onclick = e => { e.stopPropagation(); onPick(d); };
    p.appendChild(b);
  });
  return p;
}


function renderStatus() {
  $('numG').textContent = S.green;
  $('numB').textContent = S.brown;
  $('sideG').classList.toggle('turn', !S.ended && S.player === 1);
  $('sideB').classList.toggle('turn', !S.ended && S.player === -1);
  const st = $('status');
  if (S.ended) {
    st.textContent = `${S.winner === 1 ? '초록 승리!' : S.winner === -1 ? '갈색 승리!' : '무승부!'} (초록 ${S.green} : 갈색 ${S.brown})`;
    return;
  }
  const turn = S.player === 1 ? '초록' : '갈색';
  if (!S.moves[0].length) {
    st.textContent = `${turn} 차례 · 둘 수 있는 수가 없습니다. `;
    const button = document.createElement('button');
    button.textContent = '패스'; button.onclick = () => submit([]); st.appendChild(button); return;
  }
  const tips = {rotate: '① 돌릴 상대 타일을 고르세요.', rotateDir: '② 돌릴 방향을 고르세요.', place: '③ 빈칸을 고르면 표시된 방향으로 놓습니다.'};
  st.textContent = `${turn} 차례 · ${tips[phase()]}`;
}
function submit(move) {
  const board = S.board.flat();
  const action = legal(board, S.player).find(a => JSON.stringify(decode(a)) === JSON.stringify(move));
  if (action === undefined || S.ended) return;
  history.push({S, last});
  const next = apply(board, S.player, action);
  S = payload(next.board, -S.player); human = S.player;
  last = next.last; animate = last; sel = {}; render();
}
function newGame() {
  S = payload(initial(), 1); human = 1; history.length = 0;
  sel = {}; last = null; animate = null; render();
}
$('newBtn').onclick = newGame;
$('cancelBtn').onclick = () => { sel = {}; render(); };
$('undoBtn').onclick = () => {
  const previous = history.pop(); if (!previous) return;
  S = previous.S; human = S.player; last = previous.last; sel = {}; animate = null; render();
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') { sel = {}; render(); } });
newGame();
