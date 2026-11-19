# Desktop Mate

桌面寵物(Electron)。透明置頂、只有點到角色才攔截滑鼠,支援 SVG / Sprite / 3D(glb)/ VRM 自訂角色。

## 開發
```bash
npm install
npm start          # 離開:系統匣選單,或 Ctrl+Shift+Q
```

## 打包成安裝檔
```bash
npm run pack         # 只產生未封裝的資料夾(快速測試)  → dist/
npm run dist         # 目前平台的安裝檔
npm run dist:win     # Windows  NSIS 安裝程式 (.exe)
npm run dist:mac     # macOS    .dmg(x64 + arm64)
npm run dist:linux   # Linux    .AppImage + .deb
```
- 請在**目標平台**上打包(macOS 的 dmg 只能在 macOS 上做;Windows 跨平台打包需要 wine)。
- 輸出在 `dist/`,檔名格式 `DesktopMate-<版本>-<平台>-<架構>.<副檔名>`。
- 打包前請修改 `package.json` 裡的 `appId`、`author`(Linux 的 deb 需要作者 email)。
- 安裝檔**未簽章**:Windows 會出現 SmartScreen 警告;macOS 需右鍵開啟,或自行加上簽章與公證。

## 發布流程(GitHub Actions)
```bash
# 1. 修改 package.json 的 version,並更新下方版本紀錄
git commit -am "chore: release v0.3.1"
git tag v0.3.1
git push && git push --tags      # 觸發三平台打包,安裝檔會附到 GitHub Release
```
`.github/workflows/release.yml` 使用 `npm install`;建議執行一次 `npm install` 後把 `package-lock.json` 一起 commit,讓版本固定。

## 用寵物照片做角色
系統匣 →「角色 → 角色製作工具…」:匯入照片 → 自動去背 → 組成各動作動畫 → 設定行為與台詞 → 一鍵儲存並套用。
行為由每個角色的 `actions.json` 定義(移動速度、隨機行為權重、睡眠時間、各事件台詞),詳見 [`characters/README.md`](characters/README.md)。

## 自訂角色
見 [`characters/README.md`](characters/README.md)。使用者的自訂角色放在系統匣選單「角色 → 開啟自訂角色資料夾」(位於 userData 資料夾,不會因更新而被覆蓋)。

## 專案結構
```
main.js        主程序:視窗、系統匣、mate:// 協定、角色掃描
preload.js     IPC 橋接
core.js        行為引擎(與角色格式無關,由 actions.json 驅動)
shared/        動作定義預設值與合併(core 與製作工具共用)
tools/         角色製作工具(照片去背、動畫組合、行為設定)
renderers/     svg / sprite / model3d / vrm 渲染器
characters/    內建角色(default-cat、example-sprite)
build/         打包用圖示
```

## 版本紀錄
- **0.4.0** 角色製作工具(照片→角色)、`actions.json` 動作定義、行為改以時間計算
- **0.3.0** 加入 electron-builder 打包、單一實例鎖、GitHub Actions 發布流程
- **0.2.x** VRM 渲染器、像素級滑鼠穿透、角色外掛系統
- **0.1.x** 基本行為、系統匣選單
