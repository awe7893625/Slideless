// ============================================================================
// style-packs.js — 成套材質＋家具風格套件（與格局完全解耦，可攜）
// ----------------------------------------------------------------------------
// 可攜性鐵則：
//   1. 本檔只描述「風格」：顏色 / 材質參數 / 磚款 / 家具配色與款式。
//      不含任何座標、bbox、房間 id、格局尺寸 —— 不綁定任何特定 layout.json。
//   2. 任何用 build.py 流程產生的新格局（不同 layout.json），只要 viewer
//      以 <script src="style-packs.js"></script> 載入本檔即可套用全部 5 套。
//   3. 濕區（磁磚牆/石英磚地）由 viewer 依 layout.json 的房間 type
//      （kitchen / bath；無 type 欄位時退回 id 前綴與「廚/浴/衛」用途關鍵字）
//      動態判定，本檔只提供濕區的「材質長相」。
//   4. 貼圖全部由 viewer 以 canvas 程序化生成（灰階細節 × 材質 color 上色，
//      或特殊飾面 slat/concrete/brick 烤進真實色），本檔僅傳參數，零外部圖檔。
//
// schema（每套 pack）：
//   id / name / desc / for      — 識別與文案（AI 設計師、chips 共用）
//   swatch: [c1,c2,c3]          — UI 色票預覽（牆 / 地板 / 家具主色）
//   wall:    {paint, roughness, tex?} — 一般牆面（tex='concrete' → 水泥粉光貼圖）
//   accent                      — （相容欄位）客廳主牆飾面平塗色
//   accentMat:{kind, color, c2?, roughness?} — 客廳主牆「飾面材質」：
//       kind='paint' 平塗跳色 / 'slat' 直立原木格柵 / 'brick' 紅磚牆
//       color=主色；c2=次色（slat 溝縫陰影 / brick 磚縫灰）；roughness 可選
//   wetWall: {color, pattern, roughness} — 濕區牆磚（pattern: square|subway）
//   floor:   {kind, color, roughness, metalness} — 乾區地板（kind: wood|marble）
//   wetFloor:{color, roughness} — 濕區/陽台 石英磚地
//   ceiling / door / frame / sill / curtain — 天花 / 門板 / 門窗框 / 窗台 / 窗簾
//   furniture: 家具成組定義（配色 + 材質 + 款式）
//     sofa/cushion/wood/mattress/bedding/pillow/tv/counter/countertop/metal — 色票
//     fabric:  weave(布織) | leather(皮革，低粗糙度)
//     legStyle: wood(木腳/木框) | metal(金屬細腳/黑鐵框/黃銅腳)
//     shape:   rounded(圓潤厚扶手) | square(俐落薄扶手/低座)
//
// 本輪設計目標（Rain 驗收）：五套「一眼可分辨」——牆 / 地板 / 家具主體色與材質
// 都隨套件大幅改變，不再只做同色系 tint。家具主體色兩兩套件 ΔRGB 平均 ≥ 60。
// ============================================================================
window.STYLE_PACKS = {
  version: 2,
  // 舊風格 id 相容（既有分享連結 ?style=muji 仍可用）
  aliases: { muji: 'japandi' },
  packs: [
    {
      // ── 1. 奶油白：暖米牆 + 淺橡木地板 + 奶油白布沙發 + 黃銅腳 ──────────────
      id: 'cream', name: '奶油白', icon: '🍦',
      desc: '暖米色牆面＋淺橡木地板＋奶油白布沙發配黃銅細腳，柔光淺色系，放鬆療癒。',
      for: '喜歡溫暖、療癒氛圍的家庭',
      swatch: ['#f3ece1', '#cba067', '#ead0a0'],
      wall: { paint: '#f3ece1', roughness: 0.95 },
      accent: '#ecd6b2',
      accentMat: { kind: 'paint', color: '#ecd6b2', roughness: 0.92 },
      wetWall: { color: '#eee7d9', pattern: 'square', roughness: 0.30 },
      floor: { kind: 'wood', color: '#cba067', roughness: 0.52, metalness: 0 },
      wetFloor: { color: '#dcd8cf', roughness: 0.55 },
      ceiling: '#f8f6f1', door: '#c0a279', frame: '#7a6c5c', sill: '#ecd6b2', curtain: '#efe6d4',
      furniture: {
        sofa: '#ead0a0', cushion: '#efe0c4', fabric: 'weave',
        wood: '#b08c63', mattress: '#efe7d8', bedding: '#e7d6bb', pillow: '#ffffff',
        tv: '#5a4a38', counter: '#a9805a', countertop: '#efe7d8', metal: '#b5894e',
        legStyle: 'metal', shape: 'rounded',
        // v3 疊加：GLB 真家具替換表（缺 type → 退回程序化）
        // 全部由 furngen 自生成(Blender 參數化+倒角/細分,逼真軟墊)，奶油現代同調，零第三方授權
        models: { sofa: 'cream/sofa.glb', bed: 'cream/bed.glb', table: 'cream/table.glb', tv: 'cream/tv_console.glb', wc: 'cream/toilet.glb', fridge: 'cream/fridge.glb', washer: 'cream/washer.glb' }
      }
    },
    {
      // ── 2. 日式無印：灰米牆 + 電視牆直立原木格柵 + 深胡桃地板 + 黑細框低座 ──
      id: 'japandi', name: '日式無印', icon: '🪵',
      desc: '灰米牆＋客廳電視牆「直立原木格柵」＋深胡桃木地板，低座深木家具配黑細框，低彩度。',
      for: '極簡、收納控、講究材質的小家庭',
      swatch: ['#d4ad72', '#7e5a30', '#94815f'],
      wall: { paint: '#e8e2d5', roughness: 0.95 },
      accent: '#d4ad72',
      accentMat: { kind: 'slat', color: '#d4ad72', c2: '#7a5e3c', roughness: 0.62 },
      wetWall: { color: '#d4c4a8', pattern: 'subway', roughness: 0.40 },
      floor: { kind: 'wood', color: '#7e5a30', roughness: 0.55, metalness: 0 },
      wetFloor: { color: '#cdc7b8', roughness: 0.58 },
      ceiling: '#f4f1e9', door: '#6f5638', frame: '#2a2622', sill: '#c49a66', curtain: '#ddd5c4',
      furniture: {
        sofa: '#94815f', cushion: '#cfc4b2', fabric: 'weave',
        wood: '#5e4632', mattress: '#ece5d6', bedding: '#cfc4b2', pillow: '#efe9dc',
        tv: '#2c2620', counter: '#5e4632', countertop: '#d9d2c4', metal: '#1c1c1c',
        legStyle: 'metal', shape: 'square',
        models: { sofa: 'japandi/sofa.glb', bed: 'japandi/bed.glb', table: 'japandi/table.glb', tv: 'japandi/tv_console.glb', wc: 'cream/toilet.glb', fridge: 'japandi/fridge.glb', washer: 'japandi/washer.glb' }
      }
    },
    {
      // ── 3. 現代飯店：炭黑主牆 + 米白大理石地板 + 駝色焦糖皮沙發 + 黑/黃銅 ──
      id: 'hotel', name: '現代飯店', icon: '🏨',
      desc: '客廳炭黑主牆＋米白大理石地板＋駝色焦糖皮革沙發，黑與黃銅金屬件、深色木皮櫃，精品旅店感。',
      for: '追求質感、宴客需求',
      swatch: ['#3a3a3e', '#ece6da', '#b07a4a'],
      wall: { paint: '#c2b4a1', roughness: 0.90 },
      accent: '#3a3a3e',
      accentMat: { kind: 'paint', color: '#3a3a3e', roughness: 0.55 },
      wetWall: { color: '#c4bcae', pattern: 'subway', roughness: 0.14 },
      floor: { kind: 'marble', color: '#ece6da', roughness: 0.16, metalness: 0.16 },
      wetFloor: { color: '#cfc8bb', roughness: 0.38 },
      ceiling: '#efebe3', door: '#3b2f26', frame: '#262220', sill: '#b89968', curtain: '#cabf9f',
      furniture: {
        sofa: '#c47d33', cushion: '#8a6f52', fabric: 'leather',
        wood: '#3b2f26', mattress: '#efe9dd', bedding: '#7a6248', pillow: '#f3efe6',
        tv: '#1c1813', counter: '#3b2f26', countertop: '#2b2b2e', metal: '#c8a96a',
        legStyle: 'metal', shape: 'square',
        models: { sofa: 'hotel/sofa.glb', bed: 'hotel/bed.glb', table: 'hotel/table.glb', tv: 'hotel/tv_console.glb', wc: 'cream/toilet.glb', fridge: 'hotel/fridge.glb', washer: 'hotel/washer.glb' }
      }
    },
    {
      // ── 4. 北歐：純白牆 + 沙發背牆鼠尾草綠 + 極淺白蠟木地板 + 淺灰布+芥末黃 ──
      id: 'nordic', name: '北歐', icon: '🌿',
      desc: '純白牆＋沙發背牆「鼠尾草綠」跳色＋極淺白蠟木地板，淺灰布沙發配芥末黃抱枕色塊，清新通透。',
      for: '年輕族群、喜歡明亮清爽',
      swatch: ['#88a073', '#e8e4d8', '#c2c8c4'],
      wall: { paint: '#fafafa', roughness: 0.95 },
      accent: '#88a073',
      accentMat: { kind: 'paint', color: '#88a073', roughness: 0.93 },
      wetWall: { color: '#e6ebe6', pattern: 'square', roughness: 0.30 },
      floor: { kind: 'wood', color: '#e8e4d8', roughness: 0.55, metalness: 0 },
      wetFloor: { color: '#d4d6d2', roughness: 0.58 },
      ceiling: '#ffffff', door: '#e2dacb', frame: '#9aa39c', sill: '#88a073', curtain: '#e4e8e1',
      furniture: {
        sofa: '#c2c8c4', cushion: '#d9a441', fabric: 'weave',
        wood: '#d8c0a0', mattress: '#f3efe6', bedding: '#cfd6d0', pillow: '#ffffff',
        tv: '#6b726e', counter: '#e2ded2', countertop: '#bcb8ac', metal: '#cfcfcf',
        legStyle: 'wood', shape: 'rounded',
        models: { sofa: 'nordic/sofa.glb', bed: 'nordic/bed.glb', table: 'nordic/table.glb', tv: 'nordic/tv_console.glb', wc: 'cream/toilet.glb', fridge: 'nordic/fridge.glb', washer: 'nordic/washer.glb' }
      }
    },
    {
      // ── 5. 輕工業：水泥粉光牆 + 一面紅磚牆 + 深色仿水泥地坪 + 黑鐵框深木板材 ──
      id: 'industrial', name: '輕工業', icon: '🔩',
      desc: '水泥粉光牆（模板分割線＋斑駁）＋客廳一面紅磚牆＋深色仿水泥地坪，黑鐵框＋深木色板材家具，濕區地鐵磚。',
      for: '單身貴族、工作室、個性宅',
      swatch: ['#9a9a98', '#46443f', '#41342a'],
      wall: { paint: '#9a9a98', roughness: 0.90, tex: 'concrete' },
      accent: '#875040',
      accentMat: { kind: 'brick', color: '#875040', c2: '#b8b3aa', roughness: 0.88 },
      wetWall: { color: '#b2b2ad', pattern: 'subway', roughness: 0.34 },
      floor: { kind: 'wood', color: '#46443f', roughness: 0.66, metalness: 0.04 },
      wetFloor: { color: '#a6a29a', roughness: 0.60 },
      ceiling: '#dedcd7', door: '#4a4038', frame: '#2b2b2b', sill: '#6e6a63', curtain: '#bdb9b0',
      furniture: {
        sofa: '#41342a', cushion: '#6b5544', fabric: 'leather',
        wood: '#5a4738', mattress: '#e7e2d6', bedding: '#7d7468', pillow: '#e4ded2',
        tv: '#1c1814', counter: '#4a443c', countertop: '#b4b0a6', metal: '#2b2b2b',
        legStyle: 'metal', shape: 'square',
        models: { sofa: 'industrial/sofa.glb', bed: 'industrial/bed.glb', table: 'industrial/table.glb', tv: 'industrial/tv_console.glb', wc: 'cream/toilet.glb', fridge: 'industrial/fridge.glb', washer: 'industrial/washer.glb' }
      }
    }
  ],
  get: function (id) {
    id = (this.aliases && this.aliases[id]) || id;
    for (var i = 0; i < this.packs.length; i++) if (this.packs[i].id === id) return this.packs[i];
    return null;
  }
};
