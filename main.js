const { app, BrowserWindow, Tray, Menu, screen, ipcMain, globalShortcut, nativeImage, protocol, net, shell } = require('electron');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');

// mate://app/…(程式本體)  mate://builtin/…(內建角色)  mate://user/…(使用者自訂角色)
protocol.registerSchemesAsPrivileged([{ scheme: 'mate',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

let win, tray, paused = false;
const DEFAULT_KEY = 'builtin:default-cat';
const roots = () => ({ app: __dirname, builtin: path.join(__dirname, 'characters'), user: path.join(app.getPath('userData'), 'characters') });
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const loadSettings = () => { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } };
const saveSettings = o => { try { fs.writeFileSync(settingsFile(), JSON.stringify({ ...loadSettings(), ...o })); } catch {} };
const send = cmd => win && win.webContents.send('cmd', cmd);

function scanCharacters() {
  const out = [];
  for (const source of ['builtin', 'user']) {
    const root = roots()[source];
    let dirs = [];
    try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()); } catch {}
    for (const d of dirs) {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(root, d.name, 'character.json'), 'utf8'));
        if (!['svg', 'sprite', 'model3d', 'vrm'].includes(m.type)) throw new Error('未知的 type: ' + m.type);
        out.push({ key: `${source}:${d.name}`, source, id: d.name, name: m.name || d.name,
                   baseUrl: `mate://${source}/${encodeURIComponent(d.name)}/`, manifest: m });
      } catch (e) { console.warn('略過角色', d.name, e.message); }
    }
  }
  return out;
}

function buildMenu() {
  const chars = scanCharacters(), cur = loadSettings().character || DEFAULT_KEY;
  return Menu.buildFromTemplate([
    { label: win.isVisible() ? '隱藏寵物' : '顯示寵物', click: () => { win.isVisible() ? win.hide() : win.show(); refresh(); } },
    { label: '暫停自動行為', type: 'checkbox', checked: paused, click: m => { paused = m.checked; send(paused ? 'pause' : 'resume'); } },
    { type: 'separator' },
    { label: '角色', submenu: [
        ...chars.map(c => ({ label: c.name + (c.source === 'user' ? '(自訂)' : ''), type: 'radio', checked: c.key === cur,
          click: () => { saveSettings({ character: c.key }); send('character'); } })),
        { type: 'separator' },
        { label: '開啟自訂角色資料夾', click: () => { fs.mkdirSync(roots().user, { recursive: true }); shell.openPath(roots().user); } },
        { label: '重新載入角色', click: () => { refresh(); send('character'); } }
    ] },
    { label: '互動', submenu: [
        { label: '打招呼', click: () => send('hello') }, { label: '跳一下', click: () => send('jump') },
        { label: '跳舞', click: () => send('dance') }, { label: '跟著滑鼠', click: () => send('follow') },
        { label: '爬牆', click: () => send('climb') }, { label: '去睡覺', click: () => send('sleep') },
        { label: '叫醒', click: () => send('wake') } ] },
    { label: '置頂顯示', type: 'checkbox', checked: win.isAlwaysOnTop(), click: m => win.setAlwaysOnTop(m.checked, 'screen-saver') },
    { label: '開機自動啟動', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: m => app.setLoginItemSettings({ openAtLogin: m.checked }) },
    { type: 'separator' },
    { label: '離開 (Ctrl+Shift+Q)', click: () => app.quit() }
  ]);
}
function refresh() { tray && tray.setContextMenu(buildMenu()); }

if (!app.requestSingleInstanceLock()) app.quit();          // 已有一隻在執行就直接退出
app.on('second-instance', () => { if (win) { win.show(); } });

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  fs.mkdirSync(roots().user, { recursive: true });

  protocol.handle('mate', req => {
    const u = new URL(req.url), root = roots()[u.hostname];
    if (!root) return new Response('not found', { status: 404 });
    const file = path.normalize(path.join(root, decodeURIComponent(u.pathname)));
    if (!file.startsWith(root + path.sep)) return new Response('forbidden', { status: 403 });
    // 加上 CORS 標頭,讓 sprite 可以讀取像素做穿透判斷
    return net.fetch(pathToFileURL(file).toString()).then(r => {
      const h = new Headers(r.headers); h.set('Access-Control-Allow-Origin', '*');
      return new Response(r.body, { status: r.status, headers: h });
    });
  });

  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({ x, y, width, height, transparent: true, frame: false, resizable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadURL('mate://app/index.html');

  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')));
  tray.setToolTip('Desktop Mate');
  refresh();
  tray.on('click', () => tray.popUpContextMenu(buildMenu()));
  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
});
ipcMain.on('set-ignore', (_e, ignore) => win && win.setIgnoreMouseEvents(ignore, { forward: true }));
ipcMain.handle('characters:list', () => ({ list: scanCharacters(), current: loadSettings().character || DEFAULT_KEY }));
app.on('window-all-closed', () => app.quit());
