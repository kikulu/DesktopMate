// 去背與邊界計算。d = RGBA Uint8ClampedArray(ImageData.data),w/h = 尺寸。
const dist2 = (d, p, r, g, b) => { const i = p*4, dr = d[i]-r, dg = d[i+1]-g, db = d[i+2]-b; return dr*dr + dg*dg + db*db; };

function flood(w, h, seeds, ok) {                       // 4 連通填色,回傳遮罩
  const m = new Uint8Array(w*h), q = new Int32Array(w*h); let qh = 0, qt = 0;
  const push = p => { if (!m[p] && ok(p)) { m[p] = 1; q[qt++] = p; } };
  for (const s of seeds) push(s);
  while (qh < qt) {
    const p = q[qh++], x = p % w;
    if (x > 0) push(p-1); if (x < w-1) push(p+1);
    if (p >= w) push(p-w); if (p < w*(h-1)) push(p+w);
  }
  return m;
}
function largest(keep, w, h) {                           // 只保留最大的連通前景區塊
  const seen = new Uint8Array(w*h), q = new Int32Array(w*h); let best = [];
  for (let s = 0; s < w*h; s++) {
    if (!keep[s] || seen[s]) continue;
    let qh = 0, qt = 0; q[qt++] = s; seen[s] = 1;
    while (qh < qt) {
      const p = q[qh++], x = p % w, nb = [];
      if (x > 0) nb.push(p-1); if (x < w-1) nb.push(p+1); if (p >= w) nb.push(p-w); if (p < w*(h-1)) nb.push(p+w);
      for (const n of nb) if (keep[n] && !seen[n]) { seen[n] = 1; q[qt++] = n; }
    }
    if (qt > best.length) best = Array.from(q.subarray(0, qt));
  }
  const out = new Uint8Array(w*h); for (const i of best) out[i] = 1; return out;
}
export function cornerColor(d, w, h) {                   // 以四個角落的平均色當作背景色
  const n = Math.max(2, Math.min(10, w >> 3, h >> 3)); let r = 0, g = 0, b = 0, c = 0;
  for (const [x0, y0] of [[0,0],[w-n,0],[0,h-n],[w-n,h-n]])
    for (let y = y0; y < y0+n; y++) for (let x = x0; x < x0+n; x++) { const i = (y*w+x)*4; r += d[i]; g += d[i+1]; b += d[i+2]; c++; }
  return [r/c, g/c, b/c];
}
export function removeBackground(d, w, h, { tol = 40, keepLargest = true } = {}) {
  const [r, g, b] = cornerColor(d, w, h), t2 = tol*tol, seeds = [];
  for (let x = 0; x < w; x++) seeds.push(x, (h-1)*w + x);
  for (let y = 0; y < h; y++) seeds.push(y*w, y*w + w-1);
  const bg = flood(w, h, seeds, p => d[p*4+3] < 10 || dist2(d, p, r, g, b) < t2);
  let fg = new Uint8Array(w*h); for (let i = 0; i < w*h; i++) fg[i] = bg[i] ? 0 : 1;
  if (keepLargest) fg = largest(fg, w, h);
  for (let p = 0; p < w*h; p++) {                         // 邊緣內縮 1px 並半透明,去掉白邊
    if (!fg[p]) { d[p*4+3] = 0; continue; }
    const x = p % w;
    const edge = (x > 0 && !fg[p-1]) || (x < w-1 && !fg[p+1]) || (p >= w && !fg[p-w]) || (p < w*(h-1) && !fg[p+w]);
    d[p*4+3] = edge ? 128 : 255;
  }
}
export function floodRemove(d, w, h, x, y, tol = 40) {    // 點選去背:移除與點選處顏色相近的連通區域
  const s = y*w + x, i = s*4, r = d[i], g = d[i+1], b = d[i+2], t2 = tol*tol;
  const m = flood(w, h, [s], p => d[p*4+3] > 0 && dist2(d, p, r, g, b) < t2);
  let n = 0; for (let p = 0; p < w*h; p++) if (m[p]) { d[p*4+3] = 0; n++; }
  return n;
}
export function bboxOf(d, w, h, thr = 16) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y*w+x)*4+3] > thr) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1-x0+1, h: y1-y0+1 };
}
