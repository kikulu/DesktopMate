# 自訂角色(外掛)格式

把資料夾放進「系統匣 → 角色 → 開啟自訂角色資料夾」,資料夾內需有 `character.json`。
然後「重新載入角色」即可在選單切換。內建範例請看 `default-cat/`(svg)與 `example-sprite/`(sprite)。

## 共通欄位
| 欄位 | 說明 |
|---|---|
| `name` | 顯示名稱 |
| `type` | `svg` / `sprite` / `model3d` |
| `size` | 顯示大小(px,48–512,預設 96) |
| `facing` | 原圖朝向 `right`(預設)或 `left`,用來決定何時左右翻轉(3D 不適用) |
| `proceduralMotion` | 是否使用程式化的彈跳/搖擺動畫(svg 預設 true,其餘 false) |
| `eyeY` | 眼睛高度比例(0–1,預設 0.56),用於 svg 眼睛追蹤 |
| `speech` | `{ "talk": [...], "dreams": [...] }` 覆寫對話與夢話 |

## 狀態名稱
`idle` `walk` `follow` `climb` `dance` `sleep` `jump` `drag`。缺少的狀態一律退回 `idle`。

## type: svg
```json
"svg": { "file": "cat.svg", "eyes": { "left": "#pL", "right": "#pR", "max": 2.6 } }
```
- `eyes` 可省略;指向的是「瞳孔」群組的 id,會跟著游標移動。
- 睡覺時,class 為 `eyes-open` 的元素會隱藏、`eyes-closed` 的元素會顯示。
- 會自動移除 `<script>`、`<foreignObject>` 與 `on*` 事件屬性。

## type: sprite
```json
"sprite": { "pixelated": true, "states": { "idle": { "src": "idle.png", "frames": 4, "fps": 6 } } }
```
- `src` 為**橫向排列**的等寬序列圖;`frames` 為格數。`frames: 1` 可直接用 PNG / GIF / APNG / WebP 動圖。
- 每格會被縮放成 `size × size`,建議使用正方形格。
- 必須有 `idle`。

## type: model3d(需先 `npm install`)
```json
"model3d": { "file": "model.glb", "zoom": 1, "rotationY": 0,
             "animations": { "idle": "Idle", "walk": "Walk", "dance": "Dance" } }
```
- 支援 `.glb` / `.gltf`;`animations` 把狀態對應到動畫片段名稱,沒設定時會依名稱(idle/walk/dance…)自動猜測。
- 模型預設朝 +Z(面向螢幕);若方向不對用 `rotationY`(度)修正。移動時會轉向行進方向。

## type: vrm(需先 `npm install`)
```json
"vrm": { "file": "model.vrm", "armAngle": 1.2, "zoom": 1, "rotationY": 0 }
```
- 支援 VRM 0.x / 1.0,不需要動作檔:走路、跳舞、跳躍、睡覺低頭等姿勢由程式即時產生。
- 自動眨眼;眼睛(視線)與頭部會跟著游標;跳舞/跳躍時會切換「happy」表情,睡覺時閉眼。
- `armAngle`:手臂從 T 字姿勢放下的角度(弧度)。若手臂放錯方向或太直,調整這個值(可用負值)。

## 滑鼠穿透
只有點到「不透明的部分」才會攔截點擊,其餘區域會穿透到下方視窗:
svg 以元素命中判斷、sprite 讀取像素 alpha、model3d / vrm 以射線檢測。

---

# 動作定義設定檔 `actions.json`

放在角色資料夾裡(和 `character.json` 並排),**只需要寫想覆蓋的欄位**,其餘沿用預設。
任何類型的角色(svg / sprite / model3d / vrm)都適用。完整預設值見 `shared/actions.js`。

```json
{
  "movement": { "walkSpeed": 1.2, "followSpeed": 2.6, "climbSpeed": 1.4, "jumpPower": 14, "gravity": 0.8 },
  "sleepAfterSeconds": 60,
  "behaviors": {
    "walk":   { "enabled": true, "weight": 30, "duration": [2, 6] },
    "dance":  { "weight": 0 },
    "climb":  { "enabled": false }
  },
  "speech": {
    "talk":    ["今天也要加油"],
    "onClick": ["摸摸我~", "喵?"],
    "onSleep": []
  }
}
```

| 欄位 | 說明 |
|---|---|
| `movement.*` | 速度單位為「像素 / 60fps 的一個畫面」,不受螢幕更新率影響。`jumpPower` 與 `gravity` 決定跳多高 |
| `sleepAfterSeconds` | 幾秒沒互動就睡著;`0` = 永不睡覺 |
| `behaviors.<名稱>` | 名稱:`walk` `idle` `follow` `dance` `climb` `talk`。`enabled` 開關、`weight` 權重(越大越常發生,`0` 等於關閉)、`duration` = `[最短, 最長]` 秒 |
| `speech.<事件>` | 一組台詞,隨機挑一句。`[]` = 該事件不說話。可用 `{h}`(小時)、`{name}`(角色名稱) |

台詞事件:`talk`(自言自語)、`onClick` `onDoubleClick` `onLoad` `onWake` `onSleep` `onDrag` `onFollow` `onCatch` `onDance` `onClimbEnd` `onChime`、`dreams`(睡覺時的夢話)。

優先順序:內建預設 < `character.json` 的 `speech` < `actions.json`。

## sprite 的「沿用」
`character.json` 的 `sprite.states` 值可以寫成字串,表示沿用另一個狀態:
```json
"states": { "idle": {...}, "walk": {...}, "climb": "walk", "follow": "walk" }
```

---

# 用寵物照片製作角色

系統匣 →「角色 → 角色製作工具…」開啟視窗:

1. **基本資料**:代號(資料夾名稱)、顯示名稱、桌面大小、照片裡寵物的朝向。
2. **動作照片**:為每個動作(待機、走路、跟著滑鼠、跳舞、睡覺、跳躍、被抓住、爬牆)加入照片。
   - 只有「待機」是必填;沒有照片的動作會退回待機,也可以選「沿用其他動作」。
   - 一個動作放多張照片會依序播放成動畫(◀ ▶ 調整順序);只有一張時,勾選「程式化動作」會自動加上彈跳/搖擺。
   - 加入照片時會自動去背:以四角顏色當背景色,從邊緣向內填色,並只保留最大的主體。背景複雜時可調「容許度」,再用**橡皮擦 / 還原筆刷 / 點選去背**修細節,可復原。
   - 輸出時會把每張照片裁到主體範圍,以腳底對齊、置中放進 256×256 的格子。
3. **行為設定**:即 `actions.json` 的圖形介面(移動、隨機行為權重與時間、各事件台詞)。
4. 按「儲存並使用」:會寫入使用者角色資料夾(`character.json`、`actions.json`、每個動作一張 PNG 序列圖),並立刻套用到桌面上的寵物。

拍照小技巧:背景單純(白牆、素色地毯)、光線均勻、拍攝距離一致、盡量同一個朝向,去背效果最好。
