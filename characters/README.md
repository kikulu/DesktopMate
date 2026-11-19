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
