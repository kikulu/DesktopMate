// 動作定義的預設值。角色資料夾內的 actions.json 只需寫要覆蓋的欄位。
// 時間單位一律為「秒」,速度單位為「像素 / 60fps 的一個畫面」。
export const DEFAULT_ACTIONS = {
  movement: { walkSpeed: 1.2, followSpeed: 2.6, climbSpeed: 1.4, jumpPower: 14, gravity: 0.8 },
  sleepAfterSeconds: 60,                       // 多久沒互動就睡著;0 = 不睡覺
  behaviors: {                                 // 隨機行為:weight 越大越常發生,duration = [最短, 最長] 秒
    walk:   { enabled: true, weight: 30, duration: [2, 6] },
    idle:   { enabled: true, weight: 20, duration: [1.5, 4.5] },
    follow: { enabled: true, weight: 15, duration: [4, 4] },
    dance:  { enabled: true, weight: 15, duration: [2.5, 2.5] },
    climb:  { enabled: true, weight: 12, duration: [5, 5] },
    talk:   { enabled: true, weight: 8,  duration: [2, 2] }
  },
  speech: {                                    // 每個事件一組台詞,隨機挑一句;空陣列 [] = 不說話
    talk:          ['你好呀!', '今天也要加油 ✨', '該休息一下囉', '摸摸我~', '肚子餓了…', '陪我玩!'],
    onClick:       ['你好呀!', '摸摸我~', '陪我玩!'],
    onDoubleClick: ['嘿咻!'],
    onLoad:        ['我是{name}!'],
    onWake:        ['嗯…醒了'],
    onSleep:       ['呼~ 我先睡一下 💤'],
    onDrag:        ['哎呀!'],
    onFollow:      ['等等我!'],
    onCatch:       ['抓到你了!'],
    onDance:       ['♪ ♫'],
    onClimbEnd:    ['哇啊~'],
    onChime:       ['現在 {h} 點囉!'],
    dreams:        ['魚…好多魚…🐟', '再吃一口就好…', '別跑~ 小毛線球', '主人…不要關電腦…', 'zzz…摸摸…', '我是…桌面之王…👑', '好暖和…☀️', '那個游標…別逃…']
  }
};

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function deep(t, s) {
  for (const k of Object.keys(s)) {
    if (isObj(s[k]) && isObj(t[k])) deep(t[k], s[k]);
    else if (s[k] !== undefined) t[k] = s[k];
  }
}
export function mergeActions(base, ...overrides) {
  const out = structuredClone(base);
  for (const o of overrides) if (isObj(o)) deep(out, o);
  return out;
}
