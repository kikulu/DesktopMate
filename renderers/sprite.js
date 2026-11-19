// manifest.sprite = { pixelated?: bool, states: { idle:{src,frames,fps}, walk:{…}, … } }
// 每個 src 是「橫向排列」的序列圖(frames=1 時可為 PNG / GIF / APNG / WebP 動圖)
export async function create({ manifest, baseUrl, size, container }) {
  const cfg = manifest.sprite || {}, states = cfg.states || {};
  if (!states.idle) throw new Error('sprite.states 必須包含 idle');
  const url = s => baseUrl + encodeURI(s.src);
  const imgs = {}, ctxs = {};
  await Promise.all(Object.values(states).map(s => new Promise((ok, no) => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => { imgs[s.src] = i; ok(); }; i.onerror = () => no(new Error('找不到圖片 ' + s.src)); i.src = url(s);
  })));
  const ctxFor = src => ctxs[src] || (ctxs[src] = (() => {
    const i = imgs[src], c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(i, 0, 0); return g;
  })());
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;background-repeat:no-repeat;` + (cfg.pixelated ? 'image-rendering:pixelated;' : '');
  container.appendChild(el);
  let cur, curName, t = 0, frame = 0;
  const apply = name => {
    if (name === curName) return;
    curName = name; cur = states[name] || states.idle; t = 0; frame = 0;
    el.style.backgroundImage = `url("${url(cur)}")`;
    el.style.backgroundSize = `${(cur.frames || 1) * 100}% 100%`;
    el.style.backgroundPosition = '0 0';
  };
  apply('idle');
  return {
    setState: apply,
    tick({ dt }) {
      const n = cur.frames || 1; if (n < 2) return;
      t += dt;
      frame = Math.floor(t * (cur.fps || 8)) % n;
      el.style.backgroundPosition = `${frame / (n - 1) * 100}% 0`;
    },
    // 讀取目前這一格在該位置的 alpha 值
    hitTest({ lx, ly }) {
      const img = imgs[cur.src], n = cur.frames || 1, fw = img.naturalWidth / n, fh = img.naturalHeight;
      const px = Math.min(img.naturalWidth - 1, Math.floor(frame * fw + lx / size * fw)), py = Math.min(fh - 1, Math.floor(ly / size * fh));
      try { return ctxFor(cur.src).getImageData(px, py, 1, 1).data[3] > 20; } catch { return true; }
    },
    destroy() { el.remove(); }
  };
}
