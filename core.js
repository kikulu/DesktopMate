import { DEFAULT_ACTIONS, mergeActions } from './shared/actions.js';

const pet = document.getElementById('pet'), body = document.getElementById('body'), bubble = document.getElementById('bubble');
let A = DEFAULT_ACTIONS;                                   // 目前角色的動作定義

let W = 96, x = innerWidth/2, y = innerHeight - 96, vy = 0, dir = 1, rot = 0, wall = 'L';
let paused = false, state = 'idle', timer = 0, dragging = false, off = {x:0,y:0};     // timer 單位:秒
let mx = innerWidth/2, my = innerHeight/2, lastInteract = Date.now(), lastChime = -1;
let ch = null, loadToken = 0;                              // ch = { info, adapter, facing, eyeY }
const pick = a => a[Math.random()*a.length|0];

function say(t, ms = 2200) {
  bubble.textContent = t; bubble.style.display = 'block';
  clearTimeout(say.t); say.t = setTimeout(() => bubble.style.display = 'none', ms);
}
// 依事件名稱說話(讀取動作定義的台詞;空陣列 = 不說話)
function speak(key, ms, vars = {}) {
  const v = A.speech[key], t = Array.isArray(v) ? (v.length ? pick(v) : null) : (v || null);
  if (!t) return;
  say(t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''), ms);
}
function setState(s, dur) {
  state = s; timer = dur;
  if (s !== 'climb') rot = 0;
  ['walk','follow','climb','dance','sleep'].forEach(c => pet.classList.toggle(c, c === s));
  ch && ch.adapter.setState(s);
}
function jump() {
  vy = -A.movement.jumpPower; pet.classList.add('jump'); ch && ch.adapter.setState('jump');
  setTimeout(() => { pet.classList.remove('jump'); ch && ch.adapter.setState(dragging ? 'drag' : state); }, 500);
}
function wake() {
  const was = state === 'sleep'; lastInteract = Date.now();
  if (was) { setState('idle', 1); speak('onWake'); }
  return was;
}

// ───── 角色載入(外掛入口)─────
async function loadCharacter(info) {
  const token = ++loadToken, m = info.manifest;
  const size = Math.min(512, Math.max(48, +m.size || 96));
  try {
    const mod = await import(`./renderers/${m.type}.js`);
    const container = document.createElement('div');
    container.style.cssText = 'width:100%;height:100%';
    const adapter = await mod.create({ manifest: m, baseUrl: info.baseUrl, size, container });
    if (token !== loadToken) { adapter.destroy && adapter.destroy(); return true; }
    ch && ch.adapter.destroy && ch.adapter.destroy();
    body.replaceChildren(container);
    ch = { info, adapter, facing: m.facing === 'left' ? -1 : 1, eyeY: m.eyeY ?? 0.56 };
    A = mergeActions(DEFAULT_ACTIONS, { speech: m.speech }, info.actions);   // 預設 < manifest.speech < actions.json
    W = size;
    pet.style.width = pet.style.height = body.style.width = body.style.height = size + 'px';
    pet.classList.toggle('no-motion', m.proceduralMotion === false || (m.proceduralMotion === undefined && m.type !== 'svg'));
    x = Math.max(0, Math.min(x, innerWidth - W)); y = Math.min(y, innerHeight - W);
    adapter.setState(state);
    speak('onLoad', 2200, { name: m.name || info.id });
    return true;
  } catch (e) {
    console.error('角色載入失敗', info.key, e);
    say('角色載入失敗:' + e.message, 4000);
    return false;
  }
}
async function initCharacters() {
  const { list, current } = await window.mate.listCharacters();
  const def = list.find(c => c.key === 'builtin:default-cat');
  const info = list.find(c => c.key === current) || def || list[0];
  if (!info) return say('找不到任何角色');
  if (!(await loadCharacter(info)) && def && info !== def) setTimeout(() => loadCharacter(def), 4200);
}

// ───── 行為決策(依 actions.behaviors 的權重)─────
function think() {
  if (paused) { timer = 1; return; }
  if (A.sleepAfterSeconds > 0 && Date.now() - lastInteract > A.sleepAfterSeconds * 1000 && state !== 'sleep') {
    setState('sleep', 1e9); speak('onSleep'); return;
  }
  if (state === 'sleep') { timer = 1e9; return; }
  const B = A.behaviors, ids = Object.keys(B).filter(k => B[k].enabled !== false && B[k].weight > 0);
  if (!ids.length) { setState('idle', 2); return; }
  let r = Math.random() * ids.reduce((s, k) => s + B[k].weight, 0), id = ids[ids.length - 1];
  for (const k of ids) if ((r -= B[k].weight) < 0) { id = k; break; }
  const [lo, hi] = B[id].duration || [2, 4], dur = lo + Math.random() * (hi - lo);
  if (id === 'walk') { dir = pick([-1, 1]); setState('walk', dur); }
  else if (id === 'idle') setState('idle', dur);
  else if (id === 'follow') { setState('follow', dur); speak('onFollow'); }
  else if (id === 'dance') { setState('dance', dur); speak('onDance'); }
  else if (id === 'climb') startClimb(dur);
  else if (id === 'talk') { setState('idle', dur); speak('talk'); }
}
function startClimb(dur = 5) {
  wall = Math.random() < 0.5 ? 'L' : 'R';
  x = wall === 'L' ? 0 : innerWidth - W; y = innerHeight - W; dir = 1;
  setState('climb', dur); rot = wall === 'L' ? 90 : -90;
}
function endClimb() { rot = 0; setState('idle', 1.5); speak('onClimbEnd'); }

// ───── 事件 ─────
// 穿透判斷:滑鼠位置 → 角色本地座標(抵銷位移/旋轉/翻轉)→ 交給角色的 hitTest(只有點到不透明部分才攔截點擊)
let ignoring = true;
function setIgnore(v) { if (v !== ignoring) { ignoring = v; window.mate.setIgnore(v); } }
function hitCheck(cx, cy) {
  if (dragging) return;
  if (!ch) return setIgnore(true);
  const px = cx - (x + W/2), py = cy - (y + W/2);
  const a = -rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  let lx = px * c - py * s; const ly0 = px * s + py * c;
  if (!ch.adapter.handlesFlip) lx *= dir * ch.facing;
  lx += W/2; const ly = ly0 + W/2;
  const inside = lx >= 0 && ly >= 0 && lx < W && ly < W;
  setIgnore(!(inside && (!ch.adapter.hitTest || ch.adapter.hitTest({ lx, ly, sx: cx, sy: cy }))));
}
pet.addEventListener('mousedown', e => {
  dragging = true; setIgnore(false); pet.classList.add('drag'); off = {x: e.clientX - x, y: e.clientY - y}; vy = 0;
  const was = wake(); setState('idle', 1); ch && ch.adapter.setState('drag');
  if (!was) speak('onDrag');
});
window.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  if (dragging) { x = e.clientX - off.x; y = e.clientY - off.y; } else hitCheck(mx, my);
});
window.addEventListener('mouseup', e => {
  if (!dragging) return;
  const moved = Math.hypot(e.clientX - off.x - x, e.clientY - off.y - y);
  dragging = false; pet.classList.remove('drag'); ch && ch.adapter.setState(state);
  if (moved < 3) speak('onClick');
  hitCheck(e.clientX, e.clientY);
});
pet.addEventListener('dblclick', () => { jump(); speak('onDoubleClick'); });

window.mate.onCommand(c => {
  if (c === 'character') initCharacters();
  else if (c === 'pause') { paused = true; if (state !== 'sleep') setState('idle', 1); say('暫停中 ⏸'); }
  else if (c === 'resume') { paused = false; lastInteract = Date.now(); setState('idle', 0.5); say('繼續囉 ▶'); }
  else if (c === 'hello') { wake(); jump(); speak('onClick'); }
  else if (c === 'jump') { wake(); jump(); speak('onDoubleClick'); }
  else if (c === 'dance') { wake(); setState('dance', 3.3); speak('onDance'); }
  else if (c === 'follow') { wake(); setState('follow', 5); speak('onFollow'); }
  else if (c === 'climb') { wake(); startClimb(); }
  else if (c === 'sleep') { setState('sleep', 1e9); speak('onSleep'); }
  else if (c === 'wake') wake();
});

(function dreamLoop() {
  const d = A.speech.dreams;
  if (state === 'sleep' && !dragging && d && d.length) say('💭 ' + pick(d), 3500);
  setTimeout(dreamLoop, 6000 + Math.random() * 6000);
})();
setInterval(() => {
  const d = new Date();
  if (d.getMinutes() === 0 && d.getHours() !== lastChime) {
    lastChime = d.getHours(); wake();
    if (state === 'climb') endClimb();
    setState('idle', 3.3); jump(); speak('onChime', 5000, { h: d.getHours() });
  }
}, 15000);

// ───── 主迴圈(以 dt 換算,高更新率螢幕速度也一致)─────
let last = performance.now(), frame = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000), k = dt * 60; last = now;
  const M = A.movement, floor = innerHeight - W;
  if (!dragging) {
    if (state === 'climb') {
      y -= M.climbSpeed * k; x = wall === 'L' ? 0 : innerWidth - W;
      if (y < innerHeight * 0.35) endClimb();
    } else { vy += M.gravity * k; y += vy * k; if (y >= floor) { y = floor; vy = 0; } }
    const grounded = y >= floor;
    if (state === 'walk' && grounded) {
      x += dir * M.walkSpeed * k;
      if (x < 0 || x > innerWidth - W) { dir *= -1; x = Math.max(0, Math.min(x, innerWidth - W)); }
    } else if (state === 'follow' && grounded) {
      const dx = mx - W/2 - x;
      if (Math.abs(dx) < 12) { setState('idle', 1.5); speak('onCatch'); }
      else { dir = dx > 0 ? 1 : -1; x += dir * M.followSpeed * k; }
    }
    if ((timer -= dt) <= 0) think();
  }
  if (++frame % 3 === 0) hitCheck(mx, my);          // 角色自己移動時也要更新穿透狀態
  pet.style.transform = `translate(${x}px,${y}px)`;
  if (ch) {
    const own = ch.adapter.handlesFlip, flip = dir * ch.facing;
    body.style.transform = `rotate(${rot}deg) scaleX(${own ? 1 : flip})`;
    ch.adapter.tick({ dt, dir: own ? dir : flip, rot, state: dragging ? 'drag' : state,
                      lookX: mx - (x + W/2), lookY: my - (y + W * ch.eyeY) });
  }
  requestAnimationFrame(loop);
}
initCharacters().then(() => { setState('idle', 1); requestAnimationFrame(loop); });
