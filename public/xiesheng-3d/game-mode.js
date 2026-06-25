/* game-mode.js — A1 互動樣品屋遊戲化沙盒（spec-game-sandbox）
 * 掛在 window.__A1 hook 上，不動 app.html 內部邏輯。
 * 本檔模組：①手機 FPS 雙搖桿走動（橫式提示+全螢幕+觸控視角+牆碰撞沿用 A1 _tryMovePlayer）
 *           ②家具搬移/轉向/刪除 + localStorage 持久化（後段）
 *           ③專業設計師警戒線（後段）
 */
(function(){
  'use strict';
  var A1=null;
  function whenReady(cb){
    if(window.__A1&&window.__A1.ready){cb();return;}
    window.addEventListener('a1-ready',function(){cb();},{once:true});
    var n=0,t=setInterval(function(){if(window.__A1&&window.__A1.ready){clearInterval(t);cb();}else if(++n>200)clearInterval(t);},50);
  }
  var IS_TOUCH=('ontouchstart' in window)||((navigator.maxTouchPoints||0)>0);
  function el(tag,css,html){var e=document.createElement(tag);if(css)e.style.cssText=css;if(html!=null)e.innerHTML=html;return e;}

  // ============================================================
  // ① 手機 FPS 雙搖桿走動
  // ============================================================
  var MW={on:false,fwd:0,str:0,yaw:0,pitch:0,run:false};
  window.__MW=MW;
  var ui={};
  var lookId=null,lx=0,ly=0;
  var joyId=null,jbx=0,jby=0;
  var JR=52, LOOK_SENS=0.0040;

  function injectStyle(){
    if(document.getElementById('gm-style'))return;
    var s=document.createElement('style');s.id='gm-style';
    // 沿用 A1 shotmode 的完整 chrome 清單，走動時全藏(沉浸感)
    var sel='header,#mtabs,#left,#right,#bar,.btns,#views,.modepill,.minimap-hud,#minimap,.bottom-nav,#furnpanel,#pbtns';
    s.textContent=sel.split(',').map(function(x){return 'body.mw-active '+x;}).join(',')+'{display:none!important}';
    document.head.appendChild(s);
  }
  function buildUI(){
    injectStyle();
    if(ui.root)return;
    var root=el('div','position:fixed;inset:0;z-index:9000;display:none;touch-action:none;-webkit-user-select:none;user-select:none');
    var exit=el('button','position:absolute;right:12px;top:12px;z-index:9100;background:rgba(20,22,28,.82);color:#ffd27a;border:1px solid #ffd27a;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px','✕ 離開');
    exit.addEventListener('click',function(ev){ev.stopPropagation();stopMobileWalk();});
    var run=el('button','position:absolute;right:18px;bottom:30px;z-index:9100;width:62px;height:62px;border-radius:50%;background:rgba(255,210,122,.18);border:2px solid rgba(255,210,122,.55);color:#ffd27a;font-weight:700;font-size:13px','跑');
    run.addEventListener('pointerdown',function(e){e.preventDefault();MW.run=true;run.style.background='rgba(255,210,122,.5)';});
    function rOff(){MW.run=false;run.style.background='rgba(255,210,122,.18)';}
    run.addEventListener('pointerup',rOff);run.addEventListener('pointercancel',rOff);
    var jbase=el('div','position:absolute;width:'+(JR*2)+'px;height:'+(JR*2)+'px;border-radius:50%;background:rgba(255,255,255,.10);border:2px solid rgba(255,255,255,.30);display:none;z-index:9050');
    var jknob=el('div','position:absolute;width:46px;height:46px;border-radius:50%;background:rgba(255,210,122,.85);box-shadow:0 2px 10px rgba(0,0,0,.35);left:'+(JR-23)+'px;top:'+(JR-23)+'px');
    jbase.appendChild(jknob);
    var hint=el('div','position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:9100;color:#fff;background:rgba(20,22,28,.72);padding:7px 14px;border-radius:18px;font-size:12px;white-space:nowrap','左搖桿走 · 右側滑動看 · 跑步加速');
    var cross=el('div','position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.6);box-shadow:0 0 0 2px rgba(0,0,0,.25);transform:translate(-50%,-50%);z-index:9090;pointer-events:none');
    var rot=el('div','position:absolute;inset:0;z-index:9200;display:none;background:rgba(12,13,16,.94);color:#fff;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;font-size:16px',
      '<div style="font-size:46px">📱↻</div><div>請把手機轉成<b style="color:#ffd27a">橫式</b>，體驗更像遊戲</div><div style="font-size:13px;color:#aaa">轉橫後自動開始走動</div>');
    root.appendChild(exit);root.appendChild(run);root.appendChild(jbase);root.appendChild(hint);root.appendChild(cross);root.appendChild(rot);
    document.body.appendChild(root);
    ui={root:root,exit:exit,run:run,jbase:jbase,jknob:jknob,hint:hint,cross:cross,rot:rot};

    function setKnob(dx,dy){jknob.style.left=(JR-23+dx)+'px';jknob.style.top=(JR-23+dy)+'px';}
    root.addEventListener('pointerdown',function(ev){
      if(ev.target===exit||ev.target===run)return;
      if(ev.clientX<window.innerWidth*0.5){
        joyId=ev.pointerId;jbx=ev.clientX;jby=ev.clientY;
        jbase.style.left=(jbx-JR)+'px';jbase.style.top=(jby-JR)+'px';jbase.style.display='block';setKnob(0,0);
      }else{lookId=ev.pointerId;lx=ev.clientX;ly=ev.clientY;}
      ev.preventDefault();
    },{passive:false});
    root.addEventListener('pointermove',function(ev){
      if(ev.pointerId===joyId){
        var dx=ev.clientX-jbx,dy=ev.clientY-jby,d=Math.hypot(dx,dy);
        if(d>JR){dx=dx/d*JR;dy=dy/d*JR;}
        setKnob(dx,dy);MW.str=dx/JR;MW.fwd=-dy/JR;
      }else if(ev.pointerId===lookId){
        var mx=ev.clientX-lx,my=ev.clientY-ly;lx=ev.clientX;ly=ev.clientY;
        MW.yaw-=mx*LOOK_SENS;MW.pitch-=my*LOOK_SENS;
        if(MW.pitch>1.2)MW.pitch=1.2;if(MW.pitch<-1.2)MW.pitch=-1.2;
      }
    },{passive:false});
    function up(ev){
      if(ev.pointerId===joyId){joyId=null;MW.fwd=0;MW.str=0;jbase.style.display='none';}
      if(ev.pointerId===lookId)lookId=null;
    }
    root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
    window.__setKnob=setKnob;
  }

  function isPortrait(){return window.innerHeight>window.innerWidth;}
  function updateOrientationGate(){
    if(!MW.on||!ui.rot)return;
    ui.rot.style.display=(IS_TOUCH&&isPortrait())?'flex':'none';
  }

  window.__startMobileWalk=function(env){
    A1=window.__A1;buildUI();
    var dir=new A1.THREE.Vector3();A1.cam.getWorldDirection(dir);
    MW.yaw=Math.atan2(-dir.x,-dir.z);MW.pitch=0;MW.fwd=0;MW.str=0;MW.run=false;
    A1.cam.rotation.order='YXZ';
    MW.on=true;ui.root.style.display='block';document.body.classList.add('mw-active');A1.setPill('');
    // #mid 全螢幕(A1 #app 是固定欄 grid,隱藏面板不塌縮)→ JS inline 強制 + 觸發 resize3D
    var mid=document.getElementById('mid');
    if(mid){
      mid.style.setProperty('position','fixed','important');mid.style.setProperty('left','0','important');
      mid.style.setProperty('top','0','important');mid.style.setProperty('width','100vw','important');
      mid.style.setProperty('height','100vh','important');mid.style.setProperty('z-index','1','important');}
    setTimeout(function(){try{window.dispatchEvent(new Event('resize'));}catch(e){}},60);  // 畫布撐滿全螢幕
    try{var de=document.documentElement;if(de.requestFullscreen)de.requestFullscreen().catch(function(){});}catch(e){}
    try{if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(function(){});}catch(e){}
    updateOrientationGate();
  };
  function stopMobileWalk(){
    MW.on=false;MW.fwd=0;MW.str=0;
    if(ui.root)ui.root.style.display='none';
    document.body.classList.remove('mw-active');
    var mid=document.getElementById('mid');
    if(mid){['position','left','top','width','height','z-index'].forEach(function(k){mid.style.removeProperty(k);});}
    setTimeout(function(){try{window.dispatchEvent(new Event('resize'));}catch(e){}},60);  // 還原畫布尺寸
    try{if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();}catch(e){}
    try{if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(function(){});}catch(e){}
    if(A1&&A1.exitWalk)A1.exitWalk();
  }
  window.__stopMobileWalk=stopMobileWalk;
  window.addEventListener('resize',updateOrientationGate);
  window.addEventListener('orientationchange',function(){setTimeout(updateOrientationGate,200);});

  // ============================================================
  // ② 家具編輯：選取 / 拖曳搬移 / 轉向 / 刪除 + localStorage 持久化
  // ============================================================
  var EDIT={on:false,sel:-1,drag:false};
  var rayc=null,fplane=null,boxHelper=null;
  // 狀態全部寫進 A1 原生 furnOverride[i]={x,y[,rot,del]}，用 A1.saveFurnPos() 存到 localStorage 'a1_furniture'
  // → 位置由 A1 loadFurnPos() 在 init 原生還原(無晚套用打架);旋轉/刪除是額外欄位,載入後由 applyExtras 補套
  function ov(i){var O=A1.furnOverride;if(!O)return null;if(!O[i])O[i]={x:0,y:0};return O[i];}
  function persist(){if(A1.saveFurnPos)A1.saveFurnPos();}

  function applyExtras(){    // 套用旋轉/刪除(位置已由 A1 原生還原);每幀呼叫,蓋過 GLB 晚到 rebuild
    var F=A1.furn3D||[],O=A1.furnOverride||[];
    for(var i=0;i<F.length;i++){var g=F[i],o=O[i];if(!g||!o)continue;
      if(o.del){if(g.visible)g.visible=false;continue;}
      if(typeof o.rot==='number'&&g.rotation.y!==o.rot)g.rotation.y=o.rot;
    }
  }
  function extrasLoop(){applyExtras();requestAnimationFrame(extrasLoop);}

  function ndc(cx,cy){var r=A1.renderer.domElement.getBoundingClientRect();return {x:((cx-r.left)/r.width)*2-1,y:-((cy-r.top)/r.height)*2+1};}
  function pickFurn(cx,cy){
    var THREE=A1.THREE;rayc=rayc||new THREE.Raycaster();rayc.setFromCamera(ndc(cx,cy),A1.cam);
    var F=(A1.furn3D||[]).filter(Boolean);
    var hits=rayc.intersectObjects(F,true);
    for(var h=0;h<hits.length;h++){var o=hits[h].object;while(o){var idx=A1.furn3D.indexOf(o);if(idx>=0)return idx;o=o.parent;}}
    return -1;
  }
  function floorPt(cx,cy){
    var THREE=A1.THREE;rayc=rayc||new THREE.Raycaster();rayc.setFromCamera(ndc(cx,cy),A1.cam);
    fplane=fplane||new THREE.Plane(new THREE.Vector3(0,1,0),0);
    var p=new THREE.Vector3();return rayc.ray.intersectPlane(fplane,p)?p:null;
  }
  function highlight(i){
    var THREE=A1.THREE;
    if(boxHelper){A1.scene.remove(boxHelper);boxHelper=null;}
    if(i>=0&&A1.furn3D[i]){boxHelper=new THREE.BoxHelper(A1.furn3D[i],0xffd27a);if(boxHelper.material)boxHelper.material.depthTest=false;A1.scene.add(boxHelper);}
  }
  function selectFurn(i){EDIT.sel=i;highlight(i);if(eui.bar)eui.bar.style.display=(i>=0)?'flex':'none';updateWarn(i);}

  var eui={};
  function buildEditUI(){
    if(eui.toggle)return;
    var tg=el('button','position:fixed;left:12px;bottom:16px;z-index:8000;background:rgba(20,22,28,.82);color:#ffd27a;border:1px solid #ffd27a;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px','🛋️ 編輯家具');
    tg.id='gm-edit-toggle';
    tg.addEventListener('click',function(){setEdit(!EDIT.on);});
    var bar=el('div','position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:8001;display:none;align-items:center;gap:8px;background:rgba(20,22,28,.85);padding:8px 10px;border-radius:14px');
    bar.id='gm-editbar';
    function mk(t){return el('button','background:#2a2d35;color:#fff;border:0;border-radius:9px;padding:9px 13px;font-size:15px;font-weight:700',t);}
    var rl=mk('↺ 左轉'),rr=mk('↻ 右轉'),del=mk('🗑️ 毀掉'),done=mk('✓ 完成');
    rl.onclick=function(){rotateSel(-Math.PI/12);};rr.onclick=function(){rotateSel(Math.PI/12);};
    del.onclick=function(){deleteSel();};done.onclick=function(){selectFurn(-1);};
    bar.appendChild(rl);bar.appendChild(rr);bar.appendChild(del);bar.appendChild(done);
    var scan=el('button','position:fixed;left:12px;bottom:108px;z-index:8000;display:none;background:rgba(20,22,28,.82);color:#ff8f7a;border:1px solid #ff8f7a;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px','🔍 擺設體檢');
    scan.id='gm-scan';scan.onclick=function(){scanAll();};
    // 永遠可見:🔨拆牆 + 🗺️平面圖(手機上 A1 原本的 #mtabs 被藏起,使用者找不到)
    var demo=el('button','position:fixed;left:12px;bottom:62px;z-index:8000;background:rgba(20,22,28,.82);color:#ff8f7a;border:1px solid #ff8f7a;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px','🔨 拆牆');
    demo.id='gm-demo';demo.onclick=function(){toggleDemo();};
    var plan=el('button','position:fixed;right:12px;bottom:16px;z-index:8000;background:rgba(20,22,28,.82);color:#9fd3ff;border:1px solid #9fd3ff;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px','🗺️ 平面圖');
    plan.id='gm-plan';plan.onclick=function(){toggleFloorplan();};
    document.body.appendChild(tg);document.body.appendChild(bar);document.body.appendChild(scan);document.body.appendChild(demo);document.body.appendChild(plan);
    eui={toggle:tg,bar:bar,scan:scan,demo:demo,plan:plan};
  }
  function toggleDemo(){
    if(!A1.toggleDemolish)return;A1.toggleDemolish();
    var on=A1.demolishOn&&A1.demolishOn();
    eui.demo.style.background=on?'#e74c3c':'rgba(20,22,28,.82)';eui.demo.style.color=on?'#fff':'#ff8f7a';
    A1.setPill(on?'拆牆模式：點 3D 裡的牆面即可拆除／還原':'');
  }
  function toggleFloorplan(){
    var mm=document.getElementById('minimap');if(!mm)return;
    if(mm.getAttribute('data-big')==='1'){
      ['position','left','top','transform','width','height','z-index','border'].forEach(function(k){mm.style.removeProperty(k);});
      mm.removeAttribute('data-big');eui.plan.style.background='rgba(20,22,28,.82)';eui.plan.style.color='#9fd3ff';
    }else{
      mm.style.setProperty('position','fixed','important');mm.style.setProperty('left','50%','important');mm.style.setProperty('top','50%','important');
      mm.style.setProperty('transform','translate(-50%,-50%)','important');
      mm.style.setProperty('width','min(86vw,460px)','important');mm.style.setProperty('height','min(86vw,460px)','important');
      mm.style.setProperty('z-index','8500','important');mm.style.setProperty('border','2px solid #9fd3ff','important');
      mm.setAttribute('data-big','1');eui.plan.style.background='#9fd3ff';eui.plan.style.color='#222';
      if(A1.drawMinimap)A1.drawMinimap();A1.setPill('平面圖放大中：再點「平面圖」收起');
    }
  }
  function setEdit(on){
    EDIT.on=on;buildEditUI();
    eui.toggle.style.background=on?'rgba(255,210,122,.92)':'rgba(20,22,28,.82)';
    eui.toggle.style.color=on?'#222':'#ffd27a';
    eui.scan.style.display=on?'block':'none';
    if(!on){selectFurn(-1);clearScan();A1.setPill('');}
    else A1.setPill('編輯家具：點選家具 · 拖曳搬移 · 下方鈕轉向/毀掉 · 🔍體檢看擺設建議');
  }
  function rotateSel(d){if(EDIT.sel<0)return;var g=A1.furn3D[EDIT.sel];if(!g)return;g.rotation.y+=d;var o=ov(EDIT.sel);if(o)o.rot=g.rotation.y;if(boxHelper)boxHelper.update();updateWarn(EDIT.sel);persist();if(A1.syncContactAO)A1.syncContactAO();}
  function deleteSel(){if(EDIT.sel<0)return;var g=A1.furn3D[EDIT.sel];if(!g)return;g.visible=false;var o=ov(EDIT.sel);if(o)o.del=true;persist();selectFurn(-1);if(A1.drawMinimap)A1.drawMinimap();}

  // ============================================================
  // ③ 專業設計師警戒：擺放不當 → 紅框 + 白話原因（淨空/擋門/重疊）
  // ============================================================
  function doorCenters(){
    var out=[],lay=A1.L&&A1.L.layout;if(!lay)return out;
    var walls=(lay.exterior||[]).concat(lay.partitions||[]);
    walls.forEach(function(w){(w.op||[]).forEach(function(op){
      if(op.type!=='door')return;
      var ax=w.a[0],ay=w.a[1],bx=w.b[0],by=w.b[1],len=Math.hypot(bx-ax,by-ay)||1;
      var ux=(bx-ax)/len,uy=(by-ay)/len,mid=(op.s+op.e)/2;
      out.push({x:ax+ux*mid,y:ay+uy*mid});
    });});return out;
  }
  function rectOf(i){var O=A1.furnOverride[i],f=A1.L.furniture[i];if(!O||!f)return null;var fp=A1.furnFootprint(f);return {x1:O.x-fp.hw,y1:O.y-fp.hd,x2:O.x+fp.hw,y2:O.y+fp.hd,cx:O.x,cy:O.y,hw:fp.hw,hd:fp.hd};}
  // 內建/貼牆設備:本來就靠牆靠門擺,不該被當「擺錯」。只對可移動家具查擋門。
  var FIXED={shower:1,wc:1,basin:1,counter:1,fridge:1,washer:1,pantry:1,cabinet:1,wardrobe:1,sink:1,toilet:1,vanity:1,hood:1,oven:1,stove:1};
  function designerCheck(i){
    var r=[],a=rectOf(i),f=A1.L.furniture[i];if(!a||!f)return r;
    // 1) 與其他家具實質重疊(兩軸都 >0.15m,避免內建設備 footprint 近似誤報;貼牆正常不算)
    var OV=0.15;
    for(var j=0;j<A1.L.furniture.length;j++){
      if(j===i||!A1.isFurnVisible(j))continue;if(FIXED[f.type]&&FIXED[A1.L.furniture[j].type])continue; // 兩件都內建相鄰=正常
      var bj=rectOf(j);if(!bj)continue;
      var ox=Math.min(a.x2,bj.x2)-Math.max(a.x1,bj.x1),oy=Math.min(a.y2,bj.y2)-Math.max(a.y1,bj.y1);
      if(ox>OV&&oy>OV){r.push('和其他家具重疊／太擠，走不過去');break;}
    }
    // 2) 擋住門:只查可移動家具(內建設備跳過),且門中心要真的落在佔地內(+0.1 容差)
    if(!FIXED[f.type]){var dc=doorCenters();
      for(var d=0;d<dc.length;d++){var p=dc[d];if(p.x>a.x1-0.1&&p.x<a.x2+0.1&&p.y>a.y1-0.1&&p.y<a.y2+0.1){r.push('擋住門，開關不順');break;}}}
    return r;
  }
  function warnPill(){
    if(eui.warn)return eui.warn;
    var w=el('div','position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:8002;display:none;background:rgba(231,76,60,.94);color:#fff;padding:8px 16px;border-radius:18px;font-size:13px;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.3)');
    w.id='gm-warn';document.body.appendChild(w);eui.warn=w;return w;
  }
  function updateWarn(i){
    var w=warnPill();
    if(i<0){w.style.display='none';if(boxHelper&&boxHelper.material)boxHelper.material.color.setHex(0xffd27a);return;}
    var rs=designerCheck(i);
    if(rs.length){w.textContent='⚠ 設計師提醒：'+rs.join('、');w.style.display='block';if(boxHelper&&boxHelper.material)boxHelper.material.color.setHex(0xe74c3c);}
    else{w.style.display='none';if(boxHelper&&boxHelper.material)boxHelper.material.color.setHex(0x6ad07a);}
  }
  var warnBoxes=[];
  function clearScan(){warnBoxes.forEach(function(b){A1.scene.remove(b);});warnBoxes=[];if(eui.scanPanel)eui.scanPanel.style.display='none';}
  function scanAll(){
    clearScan();var F=A1.furn3D,bad=0,lines=[],THREE=A1.THREE;
    for(var i=0;i<F.length;i++){if(!F[i]||!A1.isFurnVisible(i))continue;var rs=designerCheck(i);if(rs.length){
      var bh=new THREE.BoxHelper(F[i],0xe74c3c);if(bh.material)bh.material.depthTest=false;A1.scene.add(bh);warnBoxes.push(bh);bad++;
      lines.push('• '+((A1.L.furniture[i].note||A1.L.furniture[i].type).slice(0,14))+'：'+rs[0]);}}
    showScan(bad,lines);
  }
  function showScan(bad,lines){
    if(!eui.scanPanel){
      var pnl=el('div','position:fixed;right:12px;top:56px;z-index:8003;max-width:74vw;background:rgba(20,22,28,.92);color:#fff;padding:12px 14px;border-radius:14px;font-size:12px;line-height:1.7');
      pnl.id='gm-scanpanel';document.body.appendChild(pnl);eui.scanPanel=pnl;
    }
    var p=eui.scanPanel;
    p.innerHTML=(bad?('<b style="color:#ff8f7a">⚠ 體檢發現 '+bad+' 處擺設可改善</b><br>'+lines.join('<br>')):'<b style="color:#6ad07a">✓ 體檢通過，擺設動線良好</b>')
      +'<br><button id="gm-scanclose" style="margin-top:8px;background:#2a2d35;color:#fff;border:0;border-radius:8px;padding:6px 12px;font-weight:700">關閉</button>';
    p.style.display='block';
    var cb=document.getElementById('gm-scanclose');if(cb)cb.onclick=clearScan;
  }

  function onEditDown(ev){
    if(!EDIT.on||(window.__MW&&window.__MW.on))return;
    var i=pickFurn(ev.clientX,ev.clientY);
    if(i>=0){selectFurn(i);EDIT.drag=true;A1.orbit.enabled=false;ev.preventDefault();ev.stopPropagation();}
    else selectFurn(-1);
  }
  function onEditMove(ev){
    if(!EDIT.on||!EDIT.drag||EDIT.sel<0)return;
    var p=floorPt(ev.clientX,ev.clientY);if(!p)return;
    var g=A1.furn3D[EDIT.sel];g.position.x=p.x;g.position.z=p.z;
    var o=ov(EDIT.sel);if(o){o.x=p.x;o.y=-p.z;}
    if(boxHelper)boxHelper.update();updateWarn(EDIT.sel);
    if(A1.drawMinimap)A1.drawMinimap();
  }
  function onEditUp(){
    if(EDIT.drag){EDIT.drag=false;if(EDIT.on)A1.orbit.enabled=true;persist();if(A1.syncContactAO)A1.syncContactAO();}
  }
  function wireEdit(){
    var c=A1.renderer.domElement;
    c.addEventListener('pointerdown',onEditDown,true);
    window.addEventListener('pointermove',onEditMove,true);
    window.addEventListener('pointerup',onEditUp,true);
  }
  window.__gameEdit={setEdit:setEdit,select:selectFurn,
    move:function(i,x,z){selectFurn(i);var g=A1.furn3D[i];if(!g)return;g.position.x=x;g.position.z=z;var o=ov(i);if(o){o.x=x;o.y=-z;}updateWarn(i);persist();},
    rotate:rotateSel,del:deleteSel,resetAll:function(){if(A1.resetFurnPos)A1.resetFurnPos();location.reload();},getState:function(){return A1.furnOverride;},
    pick:pickFurn,isEdit:function(){return EDIT.on;},scan:scanAll,check:designerCheck};

  function hideEditBtnDuringWalk(){var s=document.getElementById('gm-style');if(s&&s.textContent.indexOf('#gm-edit-toggle')<0)s.textContent+=' body.mw-active #gm-edit-toggle,body.mw-active #gm-editbar,body.mw-active #gm-scan,body.mw-active #gm-scanpanel,body.mw-active #gm-warn,body.mw-active #gm-demo,body.mw-active #gm-plan{display:none!important}';}

  whenReady(function(){
    A1=window.__A1;
    // init() 非同步(fetch)→ renderer/furn3D 可能還沒好,等就緒才 setup,否則 wireEdit 會拋 domElement
    (function waitScene(n){
      if(!A1.renderer||!A1.renderer.domElement||!A1.furn3D||!A1.furn3D.length){
        if(n<200)return setTimeout(function(){waitScene(n+1);},100);
      }
      if(IS_TOUCH)buildUI();
      injectStyle();hideEditBtnDuringWalk();
      buildEditUI();
      wireEdit();
      requestAnimationFrame(extrasLoop);   // 旋轉/刪除每幀套(蓋過晚到 GLB rebuild)
      setTimeout(function(){if(A1.drawMinimap)A1.drawMinimap();},1500);
      console.log('[game-mode] scene ready, touch=',IS_TOUCH);
    })(0);
  });
})();
