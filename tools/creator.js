import { DEFAULT_ACTIONS, mergeActions } from '../shared/actions.js';
import { removeBackground, floodRemove, bboxOf } from './imgproc.js';

const CELL = 256, MAXPX = 640;
const STATES = [
  { id: 'idle',   label: '待機',     fps: 4,  hint: '必填。站著/坐著的照片;多張可做出呼吸、眨眼' },
  { id: 'walk',   label: '走路',     fps: 8,  hint: '左右移動時使用' },
  { id: 'follow', label: '跟著滑鼠', fps: 10, hint: '追著游標跑;可沿用「走路」' },
  { id: 'dance',  label: '跳舞',     fps: 8,  hint: '開心時搖擺' },
  { id: 'sleep',  label: '睡覺',     fps: 2,  hint: '趴著/閉眼的照片' },
  { id: 'jump',   label: '跳躍',     fps: 6,  hint: '雙擊時' },
  { id: 'drag',   label: '被抓住',   fps: 6,  hint: '被滑鼠拖曳時' },
  { id: 'climb',  label: '爬牆',     fps: 8,  hint: '沿著螢幕邊緣爬;可沿用「走路」' }
];
const BEHAVIORS = { walk: '走路', idle: '發呆', follow: '跟著滑鼠', dance: '跳舞', climb: '爬牆', talk: '自言自語' };
const MOVES = { walkSpeed: '走路速度', followSpeed: '跟隨速度', climbSpeed: '爬牆速度', jumpPower: '跳躍力道', gravity: '重力' };
const SPEECH = { talk: '自言自語', onClick: '被點一下', onDoubleClick: '被點兩下', onLoad: '剛出場', onWake: '被叫醒', onSleep: '去睡覺',
  onDrag: '被抓起來', onFollow: '開始追游標', onCatch: '追到游標', onDance: '開始跳舞', onClimbEnd: '爬完牆', onChime: '整點報時', dreams: '夢話' };

const $ = s => document.querySelector(s);
const data = Object.fromEntries(STATES.map(s => [s.id, { frames: [], fps: s.fps, alias: null }]));
let cur = 'idle', sel = -1, previewTimer = null, refreshT = null;

// ───────── 照片載入 ─────────
async function addFiles(files) {
  for (const f of files) {
    const bmp = await createImageBitmap(f), k = Math.min(1, MAXPX / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const orig = Object.assign(document.createElement('canvas'), { width: w, height: h });
    orig.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const work = Object.assign(document.createElement('canvas'), { width: w, height: h });
    work.getContext('2d', { willReadFrequently: true }).drawImage(orig, 0, 0);
    const fr = { orig, work, hist: [], bbox: undefined };
    bindEditor(fr);
    data[cur].frames.push(fr); sel = data[cur].frames.length - 1;
    autoOne(fr);
  }
  renderAll();
}
const ctxOf = c => c.getContext('2d', { willReadFrequently: true });
const snap = fr => { fr.hist.push(ctxOf(fr.work).getImageData(0, 0, fr.work.width, fr.work.height)); if (fr.hist.length > 15) fr.hist.shift(); };
const touch = fr => { fr.bbox = undefined; clearTimeout(refreshT); refreshT = setTimeout(() => { renderThumbs(); startPreview(); }, 120); };

function autoOne(fr) {
  snap(fr);
  const { width: w, height: h } = fr.orig, id = ctxOf(fr.orig).getImageData(0, 0, w, h);
  removeBackground(id.data, w, h, { tol: +$('#tol').value, keepLargest: $('#largest').checked });
  ctxOf(fr.work).putImageData(id, 0, 0); touch(fr);
}

// ───────── 編輯器(橡皮擦 / 還原 / 點選去背)─────────
function bindEditor(fr) {
  const c = fr.work; let down = false, lx = 0, ly = 0;
  const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  const stamp = (x, y) => {
    const g = ctxOf(c), r = +$('#brush').value / 2;
    g.save(); g.beginPath(); g.arc(x, y, r, 0, 7);
    if ($('input[name=tool]:checked').value === 'erase') { g.globalCompositeOperation = 'destination-out'; g.fill(); }
    else { g.clip(); g.clearRect(x - r, y - r, r * 2, r * 2); g.drawImage(fr.orig, 0, 0); }
    g.restore();
  };
  c.addEventListener('pointerdown', e => {
    const tool = $('input[name=tool]:checked').value, [x, y] = pos(e); snap(fr);
    if (tool === 'pick') {
      const w = c.width, h = c.height, id = ctxOf(c).getImageData(0, 0, w, h);
      floodRemove(id.data, w, h, Math.min(w-1, x|0), Math.min(h-1, y|0), +$('#tol').value);
      ctxOf(c).putImageData(id, 0, 0); touch(fr); return;
    }
    down = true; c.setPointerCapture(e.pointerId); [lx, ly] = [x, y]; stamp(x, y);
  });
  c.addEventListener('pointermove', e => {
    if (!down) return; const [x, y] = pos(e), n = Math.ceil(Math.hypot(x - lx, y - ly) / 4) || 1;
    for (let i = 1; i <= n; i++) stamp(lx + (x - lx) * i / n, ly + (y - ly) * i / n);
    [lx, ly] = [x, y];
  });
  c.addEventListener('pointerup', () => { if (down) { down = false; touch(fr); } });
}
const curFrame = () => data[cur].frames[sel];

// ───────── 組合成 256×256 的一格(腳底對齊、置中)─────────
function bbox(fr) { return fr.bbox !== undefined ? fr.bbox : (fr.bbox = bboxOf(ctxOf(fr.work).getImageData(0, 0, fr.work.width, fr.work.height).data, fr.work.width, fr.work.height)); }
const dimOf = fr => { const b = bbox(fr); return b ? Math.max(b.w, b.h) : 1; };
const allFrames = () => STATES.flatMap(s => data[s.id].alias ? [] : data[s.id].frames);
function scaleFor(sid, fr) {
  const sc = $('#scope').value, list = sc === 'global' ? allFrames() : sc === 'state' ? data[sid].frames : [fr];
  return CELL * 0.92 / Math.max(1, ...list.map(dimOf));
}
function compose(fr, scale) {
  const c = Object.assign(document.createElement('canvas'), { width: CELL, height: CELL }), b = bbox(fr);
  if (b) { const dw = b.w * scale, dh = b.h * scale; c.getContext('2d').drawImage(fr.work, b.x, b.y, b.w, b.h, (CELL - dw) / 2, CELL * 0.97 - dh, dw, dh); }
  return c;
}

// ───────── 畫面 ─────────
function renderTabs() {
  $('#tabs').replaceChildren(...STATES.map(s => {
    const d = data[s.id], n = d.alias ? '沿用' : d.frames.length;
    const b = Object.assign(document.createElement('button'), { className: 'tab' + (s.id === cur ? ' on' : ''), innerHTML: `${s.label}${s.id === 'idle' ? '*' : ''} <small>(${n})</small>` });
    b.onclick = () => { cur = s.id; sel = data[cur].frames.length - 1; renderAll(); };
    return b;
  }));
}
function renderState() {
  const s = STATES.find(x => x.id === cur), d = data[cur];
  $('#stHint').textContent = s.hint;
  const opts = [['', '使用自己的照片'], ...STATES.filter(o => o.id !== cur && data[o.id].frames.length && !data[o.id].alias).map(o => [o.id, `沿用「${o.label}」`])];
  $('#alias').replaceChildren(...opts.map(([v, t]) => Object.assign(document.createElement('option'), { value: v, textContent: t, selected: (d.alias || '') === v })));
  $('#alias').parentElement.style.display = cur === 'idle' ? 'none' : '';
  $('#own').style.display = $('#fpsBox').style.display = $('#editorBox').style.display = d.alias ? 'none' : '';
  $('#editorBox').style.display = d.alias ? 'none' : '';
  $('#fps').value = d.fps; $('#fpsVal').textContent = d.fps;
}
function renderThumbs() {
  const d = data[cur];
  $('#thumbs').replaceChildren(...d.frames.map((fr, i) => {
    const box = document.createElement('div'); box.className = 'th' + (i === sel ? ' on' : '');
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
    const g = c.getContext('2d'), k = Math.min(64 / fr.work.width, 64 / fr.work.height);
    g.drawImage(fr.work, 0, 0, fr.work.width * k, fr.work.height * k);
    c.onclick = () => { sel = i; renderThumbs(); renderStage(); };
    const ops = document.createElement('div'); ops.className = 'ops';
    const mk = (t, f) => Object.assign(document.createElement('button'), { textContent: t, onclick: f });
    ops.append(mk('◀', () => { if (i > 0) { [d.frames[i-1], d.frames[i]] = [d.frames[i], d.frames[i-1]]; sel = i - 1; renderAll(); } }),
               mk('✕', () => { d.frames.splice(i, 1); sel = Math.min(sel, d.frames.length - 1); renderAll(); }),
               mk('▶', () => { if (i < d.frames.length - 1) { [d.frames[i+1], d.frames[i]] = [d.frames[i], d.frames[i+1]]; sel = i + 1; renderAll(); } }));
    box.append(c, ops); return box;
  }));
}
function renderStage() {
  const fr = curFrame();
  $('#stage').replaceChildren(...(fr ? [fr.work] : [Object.assign(document.createElement('span'), { className: 'hint', textContent: '先加入一張照片' })]));
}
function startPreview() {
  clearInterval(previewTimer);
  const sid = data[cur].alias || cur, d = data[sid], g = $('#prev').getContext('2d');
  g.clearRect(0, 0, CELL, CELL);
  if (!d.frames.length) return;
  const imgs = d.frames.map(fr => compose(fr, scaleFor(sid, fr))); let i = 0;
  const tick = () => { g.clearRect(0, 0, CELL, CELL); g.drawImage(imgs[i++ % imgs.length], 0, 0); };
  tick(); if (imgs.length > 1) previewTimer = setInterval(tick, 1000 / (data[cur].alias ? d.fps : data[cur].fps));
}
function renderAll() { renderTabs(); renderState(); renderThumbs(); renderStage(); startPreview(); }

// ───────── 行為設定表單 ─────────
function buildActionsForm(a) {
  $('#movement').replaceChildren(...Object.entries(MOVES).map(([k, t]) => lab(t, `<input id="mv_${k}" type="number" step="0.1" value="${a.movement[k]}">`)),
    lab('幾秒沒互動就睡著(0=不睡)', `<input id="sleepAfter" type="number" min="0" value="${a.sleepAfterSeconds}">`));
  $('#behaviors').innerHTML = '<tr><th>啟用</th><th>行為</th><th>權重</th><th>持續秒數(最短 ~ 最長)</th></tr>' + Object.entries(BEHAVIORS).map(([k, t]) => {
    const b = a.behaviors[k];
    return `<tr><td><input id="bh_${k}_on" type="checkbox" ${b.enabled !== false ? 'checked' : ''}></td><td>${t}</td>
      <td><input id="bh_${k}_w" type="number" min="0" value="${b.weight}"></td>
      <td><input id="bh_${k}_lo" type="number" step="0.5" min="0.5" value="${b.duration[0]}"> ~ <input id="bh_${k}_hi" type="number" step="0.5" min="0.5" value="${b.duration[1]}"></td></tr>`;
  }).join('');
  $('#speech').innerHTML = Object.entries(SPEECH).map(([k, t]) =>
    `<div><b>${t} <span class="hint">${k}</span></b><textarea id="sp_${k}" rows="3">${(a.speech[k] || []).join('\n')}</textarea></div>`).join('');
}
const lab = (t, inner) => Object.assign(document.createElement('label'), { innerHTML: `${t} ${inner}` });
const num = (sel, fb) => { const v = parseFloat($(sel).value); return Number.isFinite(v) ? v : fb; };
function readActions() {
  const D = DEFAULT_ACTIONS, a = { movement: {}, sleepAfterSeconds: num('#sleepAfter', D.sleepAfterSeconds), behaviors: {}, speech: {} };
  for (const k in MOVES) a.movement[k] = num('#mv_' + k, D.movement[k]);
  for (const k in BEHAVIORS) {
    const lo = num(`#bh_${k}_lo`, 2), hi = Math.max(lo, num(`#bh_${k}_hi`, lo));
    a.behaviors[k] = { enabled: $(`#bh_${k}_on`).checked, weight: num(`#bh_${k}_w`, 0), duration: [lo, hi] };
  }
  for (const k in SPEECH) a.speech[k] = $('#sp_' + k).value.split('\n').map(s => s.trim()).filter(Boolean);
  return a;
}

// ───────── 儲存 ─────────
function status(msg, cls = '') { const s = $('#status'); s.textContent = msg; s.className = cls; }
async function save() {
  const id = $('#id').value.trim();
  if (!id) return status('請填寫角色代號', 'err');
  if (!data.idle.frames.length) return status('「待機」至少需要一張照片', 'err');
  const files = {}, states = {};
  for (const s of STATES) {
    const d = data[s.id];
    if (d.alias) { if (data[d.alias].frames.length) states[s.id] = d.alias; continue; }
    if (!d.frames.length) continue;
    const c = Object.assign(document.createElement('canvas'), { width: CELL * d.frames.length, height: CELL }), g = c.getContext('2d');
    d.frames.forEach((fr, i) => g.drawImage(compose(fr, scaleFor(s.id, fr)), i * CELL, 0));
    files[s.id + '.png'] = c.toDataURL('image/png').split(',')[1];
    states[s.id] = { src: s.id + '.png', frames: d.frames.length, fps: d.fps };
  }
  const manifest = { name: $('#name').value.trim() || id, type: 'sprite', size: +$('#size').value, facing: $('#facing').value,
                     proceduralMotion: $('#procedural').checked, sprite: { states } };
  try {
    status('儲存中…');
    const key = await window.mate.saveCharacter({ id, manifest, actions: readActions(), files });
    status(`✔ 已儲存並套用:${key}(寵物視窗已切換成新角色)`, 'ok');
  } catch (e) { status('儲存失敗:' + e.message.replace(/^.*Error: /, ''), 'err'); }
}

// ───────── 事件 ─────────
$('#addBtn').onclick = () => $('#file').click();
$('#file').onchange = async e => { await addFiles([...e.target.files]); e.target.value = ''; };
$('#alias').onchange = e => { data[cur].alias = e.target.value || null; renderAll(); };
$('#fps').oninput = e => { data[cur].fps = +e.target.value; $('#fpsVal').textContent = e.target.value; startPreview(); };
$('#size').oninput = e => $('#sizeVal').textContent = e.target.value;
$('#tol').oninput = e => $('#tolVal').textContent = e.target.value;
$('#scope').onchange = startPreview;
$('#autoBtn').onclick = () => { const fr = curFrame(); if (fr) autoOne(fr); };
$('#autoAllBtn').onclick = () => { allFrames().forEach(autoOne); };
$('#undoBtn').onclick = () => { const fr = curFrame(); if (fr && fr.hist.length) { ctxOf(fr.work).putImageData(fr.hist.pop(), 0, 0); touch(fr); } };
$('#resetBtn').onclick = () => { const fr = curFrame(); if (fr) { snap(fr); const g = ctxOf(fr.work); g.clearRect(0, 0, fr.work.width, fr.work.height); g.drawImage(fr.orig, 0, 0); touch(fr); } };
$('#resetActions').onclick = () => buildActionsForm(DEFAULT_ACTIONS);
$('#save').onclick = save;
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); const fs = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/')); if (fs.length && !data[cur].alias) addFiles(fs); });

buildActionsForm(DEFAULT_ACTIONS); renderAll();
