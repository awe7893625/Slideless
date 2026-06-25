/* ═══════════════════════════════════════════════════════════════════
   A1FurnGLB — 家具 GLB 載入/快取/置入（PLAN-trackA-pbr.md M5）
   ──────────────────────────────────────────────────────────────────
   - buildFurniture 的 GLB 分支：PACK.furniture.models?.[f.type] 命中 →
     從預載快取 clone、縮放對齊 f.w/f.d/f.h、pivot 落地、掛 clip+陰影。
   - 缺檔/未載完 → 回 null → buildFurniture 退回程序化盒子（鐵則 4 不破圖）。
   - GLB 已在 10_normalize 階段轉成「真實公尺、pivot 底部置中、+Y up、
     X=寬 Z=深」，所以縮放只是把模型自然尺寸對齊到 layout 的 f.w/f.d/f.h。
   依賴：THREE r128 + GLTFLoader + BasisTextureLoader + KTX2Loader + MeshoptDecoder
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const cache = new Map();      // url → THREE.Group (原型，clone 給每個實例)
  const inflight = new Map();   // url → Promise
  let loader = null, ready = false;
  const ASSET_VER = 'gen3';     // 資產版本：furngen 自生成家具(逼真)，bump 避免服務舊 GLB。gen3: 賞屋佈置(床品/床頭櫃/電視/爐具)+立體洗手盆

  function initLoader(renderer) {
    if (loader) return loader;
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) return null;
    const l = new THREE.GLTFLoader();
    try {
      if (THREE.KTX2Loader) {
        const ktx2 = new THREE.KTX2Loader().setTranscoderPath('vendor/basis/').detectSupport(renderer);
        l.setKTX2Loader(ktx2);
      }
      if (global.MeshoptDecoder) l.setMeshoptDecoder(global.MeshoptDecoder);
    } catch (e) { console.warn('[FurnGLB] loader setup warn', e); }
    loader = l;
    return l;
  }

  function loadOne(url) {
    if (cache.has(url)) return Promise.resolve(cache.get(url));
    if (inflight.has(url)) return inflight.get(url);
    const p = new Promise((res) => {
      if (!loader) { res(null); return; }
      loader.load(url, (gltf) => {
        const root = gltf.scene;
        root.updateWorldMatrix(true, true);
        cache.set(url, root);
        res(root);
      }, undefined, (e) => { console.warn('[FurnGLB] load fail', url, e && e.message); res(null); });
    });
    inflight.set(url, p);
    return p;
  }

  const urlFor = (rel) => 'assets/furniture/' + rel + '?v=' + ASSET_VER;

  /* 預載一組 models（{sofa:'cream/sofa.glb',...}），全部 settle 後 resolve */
  function preload(renderer, models) {
    initLoader(renderer);
    if (!loader || !models) return Promise.resolve(false);
    const urls = [...new Set(Object.values(models).filter(Boolean).map(urlFor))];
    return Promise.all(urls.map(loadOne)).then((rs) => { ready = rs.some(Boolean); return ready; });
  }

  /* 同步取得：命中快取才回 Group，否則 null（呼叫端退回程序化）。
     pack 必須由呼叫端傳入（app.html 的 PACK 是 let，不掛 window，模組讀不到）。clip=剖切平面 */
  function build(f, clip, pack) {
    const PACK = pack || global.PACK || (global.STYLE_PACKS && global.STYLE_PACKS.current);
    const models = PACK && PACK.furniture && PACK.furniture.models;
    const rel = models && models[f.type];
    if (!rel) return null;
    const proto = cache.get(urlFor(rel));
    if (!proto) return null;

    const inst = proto.clone(true);
    // 量原型 bbox（自然尺寸，已是公尺）→ 縮放到 layout 目標
    const box = new THREE.Box3().setFromObject(inst);
    const size = box.getSize(new THREE.Vector3());
    // footprint 對齊 layout（X=寬 Z=深）；高度按 footprint 平均比例，保留模型自然身高
    // （f.h 是坐墊/床墊高不是總高，拿來縮 Y 會壓扁有椅背/床頭的家具）
    const sx0 = size.x > 1e-4 ? f.w / size.x : 1;
    const sz0 = size.z > 1e-4 ? f.d / size.z : 1;
    // rank5 等比保護：只對「圓形/對稱」件(洗衣機滾筒門、馬桶蓋)做等比 clamp，否則非等比 X/Z 會把圓拉成橢圓。
    // ⚠️ 不可套到 sofa/bed/table 等本該長方貼合 footprint 的件(會被縮成正方、長邊 underfill 離牆)——只白名單圓件。
    const ROUND = { washer: 1, wc: 1 };
    const ratio = Math.max(sx0, sz0) / Math.max(1e-4, Math.min(sx0, sz0));
    let sx, sz;
    if (ROUND[f.type] && ratio > 1.15) { sx = sz = Math.min(sx0, sz0); } else { sx = sx0; sz = sz0; }
    const sy = (sx + sz) / 2;
    inst.scale.set(sx, sy, sz);

    // 重新落地：縮放後重量底部，pivot 對齊 y=0（地面）
    inst.updateWorldMatrix(true, true);
    const box2 = new THREE.Box3().setFromObject(inst);
    inst.position.y -= box2.min.y;
    // 置中 X/Z（layout 以家具中心定位）
    const c = box2.getCenter(new THREE.Vector3());
    inst.position.x -= c.x; inst.position.z -= c.z;

    const reg = [];
    inst.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m) { m.clippingPlanes = clip ? [clip] : null; m.needsUpdate = true; reg.push(m); } });
      }
    });
    inst.__furnMats = reg;     // 給 furnMats 收集（顯示/隱藏邏輯沿用）
    inst.__isGLB = true;
    return inst;
  }

  global.A1FurnGLB = { preload, build, isReady: () => ready, has: (t) => {
    const PACK = global.PACK || (global.STYLE_PACKS && global.STYLE_PACKS.current);
    const rel = PACK && PACK.furniture && PACK.furniture.models && PACK.furniture.models[t];
    return !!(rel && cache.get(urlFor(rel)));
  } };
})(window);
