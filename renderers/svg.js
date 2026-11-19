// manifest.svg = { file, eyes?: { left: "#id", right: "#id", max?: 2.6 } }
export async function create({ manifest, baseUrl, size, container }) {
  const cfg = manifest.svg || {};
  const res = await fetch(baseUrl + encodeURI(cfg.file || 'character.svg'));
  if (!res.ok) throw new Error('找不到 SVG 檔');
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.nodeName.toLowerCase() !== 'svg') throw new Error('SVG 格式錯誤');
  // 安全處理:移除腳本與事件屬性
  svg.querySelectorAll('script,foreignObject').forEach(n => n.remove());
  [svg, ...svg.querySelectorAll('*')].forEach(n => [...n.attributes].forEach(a => {
    if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
  }));
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  const root = document.importNode(svg, true);
  container.appendChild(root);

  const e = cfg.eyes, L = e && container.querySelector(e.left), R = e && container.querySelector(e.right), max = e?.max ?? 2.6;
  return {
    setState() {},                       // 狀態由 CSS class 驅動(見 index.html)
    tick({ dir, rot, lookX, lookY }) {
      if (!L || !R) return;
      const a = -rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const lx = (lookX * c - lookY * s) * dir, ly = lookX * s + lookY * c;   // 抵銷旋轉與翻轉
      const d = Math.hypot(lx, ly) || 1, k = Math.min(max, d / 40);
      L.style.transform = R.style.transform = `translate(${lx/d*k}px,${ly/d*k}px)`;
    },
    // 只有點到有繪製內容的元素才算(點到 svg 空白處不算)
    hitTest({ sx, sy }) {
      const el = document.elementsFromPoint(sx, sy).find(n => container.contains(n));
      return !!el && el !== root;
    },
    destroy() { container.replaceChildren(); }
  };
}
