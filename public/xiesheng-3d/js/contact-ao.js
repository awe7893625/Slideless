(function(){
  'use strict';

  const api={};
  let group=null;
  let opts=null;
  let mats=null;
  let shadowByIndex=[];
  let activePartitionIndices=[];

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function wallLen(w){return Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);}

  function makeAlphaTex(kind){
    const c=document.createElement('canvas');
    c.width=c.height=128;
    const x=c.getContext('2d');
    x.fillStyle='#000';
    x.fillRect(0,0,128,128);
    let g;
    if(kind==='base'){
      g=x.createLinearGradient(0,128,0,0);
      g.addColorStop(0,'#fff');
      g.addColorStop(0.34,'#777');
      g.addColorStop(1,'#000');
    }else if(kind==='ceil'){
      g=x.createLinearGradient(0,0,0,128);
      g.addColorStop(0,'#fff');
      g.addColorStop(0.34,'#777');
      g.addColorStop(1,'#000');
    }else if(kind==='cornerStart'){
      g=x.createLinearGradient(0,0,128,0);
      g.addColorStop(0,'#fff');
      g.addColorStop(0.55,'#333');
      g.addColorStop(1,'#000');
    }else if(kind==='cornerEnd'){
      g=x.createLinearGradient(0,0,128,0);
      g.addColorStop(0,'#000');
      g.addColorStop(0.45,'#333');
      g.addColorStop(1,'#fff');
    }else if(kind==='floorEdge'){
      g=x.createLinearGradient(0,0,0,128);
      g.addColorStop(0,'#000');
      g.addColorStop(0.5,'#fff');
      g.addColorStop(1,'#000');
    }else if(kind==='wallBand'){
      x.globalCompositeOperation='lighter';
      g=x.createLinearGradient(0,128,0,0);
      g.addColorStop(0,'#fff');
      g.addColorStop(0.16,'#555');
      g.addColorStop(0.36,'#000');
      x.fillStyle=g;x.fillRect(0,0,128,128);
      g=x.createLinearGradient(0,0,0,128);
      g.addColorStop(0,'#d8d8d8');
      g.addColorStop(0.16,'#444');
      g.addColorStop(0.34,'#000');
      x.fillStyle=g;x.fillRect(0,0,128,128);
      g=x.createLinearGradient(0,0,128,0);
      g.addColorStop(0,'#9a9a9a');
      g.addColorStop(0.18,'#333');
      g.addColorStop(0.34,'#000');
      x.fillStyle=g;x.fillRect(0,0,128,128);
      g=x.createLinearGradient(128,0,0,0);
      g.addColorStop(0,'#9a9a9a');
      g.addColorStop(0.18,'#333');
      g.addColorStop(0.34,'#000');
      x.fillStyle=g;x.fillRect(0,0,128,128);
    }else{
      g=x.createRadialGradient(64,64,4,64,64,64);
      g.addColorStop(0,'#fff');
      g.addColorStop(0.42,'#8c8c8c');
      g.addColorStop(1,'#000');
    }
    x.fillStyle=g;
    x.fillRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c);
    t.needsUpdate=true;
    return t;
  }

  function makeLightTex(){
    const c=document.createElement('canvas');
    c.width=256;c.height=256;
    const x=c.getContext('2d');
    x.clearRect(0,0,256,256);
    const g=x.createRadialGradient(128,128,4,128,128,126);
    g.addColorStop(0,'rgba(255,236,182,0.62)');
    g.addColorStop(0.34,'rgba(255,220,142,0.28)');
    g.addColorStop(0.72,'rgba(255,216,128,0.08)');
    g.addColorStop(1,'rgba(255,216,128,0)');
    x.fillStyle=g;
    x.fillRect(0,0,256,256);
    x.globalCompositeOperation='lighter';
    x.fillStyle='rgba(255,248,216,0.16)';
    x.beginPath();
    x.ellipse(128,128,82,30,-0.38,0,Math.PI*2);
    x.fill();
    const t=new THREE.CanvasTexture(c);
    t.needsUpdate=true;
    return t;
  }

  function materialSet(clip){
    if(!mats){
      const mk=(alpha,opacity)=>new THREE.MeshBasicMaterial({
        color:0x000000,
        transparent:true,
        opacity:opacity,
        alphaMap:alpha,
        depthWrite:false,
        side:THREE.DoubleSide,
        polygonOffset:true,
        polygonOffsetFactor:-1,
        polygonOffsetUnits:-1
      });
      mats={
        base:mk(makeAlphaTex('base'),0.18),
        ceil:mk(makeAlphaTex('ceil'),0.13),
        cornerStart:mk(makeAlphaTex('cornerStart'),0.11),
        cornerEnd:mk(makeAlphaTex('cornerEnd'),0.11),
        wallBand:mk(makeAlphaTex('wallBand'),0.16),
        floorEdge:mk(makeAlphaTex('floorEdge'),0.10),
        furniture:mk(makeAlphaTex('furniture'),0.30),
        light:new THREE.MeshBasicMaterial({
          color:0xffedbf,
          map:makeLightTex(),
          transparent:true,
          opacity:0.28,
          blending:THREE.AdditiveBlending,
          depthWrite:false,
          side:THREE.DoubleSide,
          polygonOffset:true,
          polygonOffsetFactor:-1,
          polygonOffsetUnits:-2
        })
      };
      Object.keys(mats).forEach(k=>{if('toneMapped' in mats[k])mats[k].toneMapped=false;});
    }
    Object.keys(mats).forEach(k=>{mats[k].clippingPlanes=clip?[clip]:null;});
    return mats;
  }

  function clearGroup(g){
    if(!g)return;
    for(let i=g.children.length-1;i>=0;i--){
      const child=g.children[i];
      child.traverse&&child.traverse(n=>{if(n.geometry&&n.geometry.dispose)n.geometry.dispose();});
      g.remove(child);
    }
  }

  function solidSegments(w){
    const len=wallLen(w);
    const openings=(w.op||[])
      .filter(o=>o&&o.type==='door')
      .map(o=>({s:clamp(o.s||0,0,len),e:clamp(o.e||0,0,len)}))
      .filter(o=>o.e-o.s>0.03)
      .sort((a,b)=>a.s-b.s);
    const segs=[];
    let cur=0;
    openings.forEach(o=>{
      if(o.s-cur>0.04)segs.push({s:cur,e:o.s});
      cur=Math.max(cur,o.e);
    });
    if(len-cur>0.04)segs.push({s:cur,e:len});
    return segs;
  }

  function addWallAO(w, kind, index, mat){
    const len=wallLen(w);
    if(len<0.05)return;
    const ax=w.a[0],ay=w.a[1],bx=w.b[0],by=w.b[1];
    const ux=(bx-ax)/len,uy=(by-ay)/len;
    const ang=Math.atan2(-(by-ay),bx-ax);
    const thick=w.t||0.12;
    const wallZ=thick/2+0.004;
    const height=opts.wallHeight||2.9;
    const faceList=kind==='exterior'?[interiorFace(w)]:[-1,1];
    solidSegments(w).forEach(seg=>{
      const sl=seg.e-seg.s;
      if(sl<0.04)return;
      const mt=(seg.s+seg.e)/2;
      const px=ax+ux*mt,py=ay+uy*mt;
      faceList.forEach(face=>{
        const band=new THREE.Mesh(new THREE.PlaneGeometry(sl,height),mat.wallBand);
        band.position.set(px,height/2,-py);
        band.rotation.y=ang;
        band.translateZ(face*wallZ);
        band.renderOrder=3;
        band.userData={contactAO:true,wallKind:kind,wallIndex:index,aoPart:'wallBand'};
        group.add(band);

      });
    });
  }

  function interiorFace(w){
    const len=wallLen(w);
    if(len<0.05)return 1;
    const px=(w.a[0]+w.b[0])/2,py=(w.a[1]+w.b[1])/2;
    const ux=(w.b[0]-w.a[0])/len,uy=(w.b[1]-w.a[1])/len;
    const env=opts.envelope||{w:0,d:0};
    const toCx=(env.w||0)/2-px,toCy=(env.d||0)/2-py;
    const nx=-uy,ny=-ux;
    return (nx*toCx+ny*toCy)>=0?1:-1;
  }

  function addFurnitureShadows(mat){
    shadowByIndex=[];
    (opts.furniture||[]).forEach((f,i)=>{
      const pos=opts.getFurniturePosition?opts.getFurniturePosition(i,f):(f||{});
      if(!f||!pos)return;
      const w=Math.max(0.28,(f.w||0.6)*1.13);
      const d=Math.max(0.28,(f.d||0.6)*1.13);
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat.furniture);
      m.rotation.x=-Math.PI/2;
      m.position.set(pos.x!=null?pos.x:f.x,0.018,-(pos.y!=null?pos.y:f.y));
      m.renderOrder=5;
      m.visible=opts.isFurnitureVisible?!!opts.isFurnitureVisible(i):true;
      m.userData={contactAO:true,furnitureIndex:i,aoPart:'furnitureShadow'};
      group.add(m);
      shadowByIndex[i]=m;
    });
  }

  function interiorNormal(w,px,py){
    const len=wallLen(w),ux=(w.b[0]-w.a[0])/len,uy=(w.b[1]-w.a[1])/len;
    let nx=-uy,ny=ux;
    const env=opts.envelope||{w:0,d:0};
    const toCx=(env.w||0)/2-px,toCy=(env.d||0)/2-py;
    if(nx*toCx+ny*toCy<0){nx=-nx;ny=-ny;}
    return {nx,ny};
  }

  function addWindowDecals(mat){
    const env=opts.envelope||{w:0,d:0};
    (opts.layout.exterior||[]).forEach((w,wi)=>{
      const len=wallLen(w);
      if(len<0.05)return;
      const ax=w.a[0],ay=w.a[1],bx=w.b[0],by=w.b[1];
      const ux=(bx-ax)/len,uy=(by-ay)/len;
      const ang=Math.atan2(-(by-ay),bx-ax);
      (w.op||[]).forEach((o,oi)=>{
        if(!o||o.type!=='window'||(o.e-o.s)<0.75)return;
        const mid=(o.s+o.e)/2;
        const px=ax+ux*mid,py=ay+uy*mid;
        const n=interiorNormal(w,px,py);
        const insideX=clamp(px+n.nx*0.72,0.15,(env.w||px)-0.15);
        const insideY=clamp(py+n.ny*0.72,0.15,(env.d||py)-0.15);
        const width=Math.max(0.7,(o.e-o.s)*0.92);
        const depth=Math.max(0.72,Math.min(1.45,(o.e-o.s)*0.55));
        const decal=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),mat.light);
        decal.rotation.x=-Math.PI/2;
        decal.position.set(insideX,0.024,-insideY);
        decal.rotation.y=ang;
        decal.renderOrder=6;
        decal.userData={contactAO:true,wallKind:'exterior',wallIndex:wi,openingIndex:oi,aoPart:'windowLight'};
        group.add(decal);
      });
    });
  }

  function rebuild(nextOpts){
    opts=nextOpts||opts;
    if(!opts||!opts.root||!opts.layout||typeof THREE==='undefined')return;
    if(!group){
      group=new THREE.Group();
      group.name='A1ContactAO';
      opts.root.add(group);
    }else if(group.parent!==opts.root){
      if(group.parent)group.parent.remove(group);
      opts.root.add(group);
    }
    const t0=(performance&&performance.now)?performance.now():Date.now();
    clearGroup(group);
    activePartitionIndices=[];
    const mat=materialSet(opts.clip);
    const _dw=opts.demolishedWalls;
    const _isDemo=(k)=>!!(_dw&&_dw.has&&_dw.has(k));
    // 拆牆已改字串 key('e'+i/'p'+i);舊版用整數 i 比對 → 拆掉的牆接觸陰影不消失。改用字串 key。
    (opts.layout.exterior||[]).forEach((w,i)=>{ if(_isDemo('e'+i))return; addWallAO(w,'exterior',i,mat); });
    (opts.layout.partitions||[]).forEach((w,i)=>{
      if(_isDemo('p'+i))return;
      activePartitionIndices.push(i);
      addWallAO(w,'partition',i,mat);
    });
    addFurnitureShadows(mat);
    addWindowDecals(mat);
    group.userData.lastBuildMs=((performance&&performance.now)?performance.now():Date.now())-t0;
  }

  function updateFurnitureShadow(i,x,y,visible){
    const m=shadowByIndex[i];
    if(!m)return;
    if(x!=null&&y!=null)m.position.set(x,0.018,-y);
    if(visible!=null)m.visible=!!visible;
  }

  function syncFurnitureVisibility(){
    if(!opts||!opts.isFurnitureVisible)return;
    shadowByIndex.forEach((m,i)=>{if(m)m.visible=!!opts.isFurnitureVisible(i);});
  }

  function debug(){
    return {
      meshCount:group?group.children.length:0,
      activePartitionIndices:activePartitionIndices.slice(),
      furnitureShadowCount:shadowByIndex.filter(Boolean).length,
      lastBuildMs:group&&group.userData?group.userData.lastBuildMs:null
    };
  }

  api.rebuild=rebuild;
  api.updateFurnitureShadow=updateFurnitureShadow;
  api.syncFurnitureVisibility=syncFurnitureVisibility;
  api.debug=debug;
  window.A1ContactAO=api;
})();
