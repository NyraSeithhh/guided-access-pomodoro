/*
 * Sillage Focus Pomodoro
 * MIT License — https://github.com/NyraSeithhh/sillage-focus-pomodoro
 */
(function(global){
  "use strict";

  var config={
    key:"sillage.focus.pomodoro.v1",
    title:"小猫番茄钟",
    appleGuide:"https://support.apple.com/111795"
  };
  var mounts=[];
  var overlay=null;
  var modalTimer=0;

  function defaults(){
    return{
      version:1,
      task:"",
      mode:"focus",
      status:"idle",
      focusMinutes:25,
      breakMinutes:5,
      remainingMs:25*60000,
      endAt:0,
      startedAt:0,
      completedByDay:{},
      singleAppMode:false,
      guidedAccessReady:false,
      updatedAt:Date.now()
    };
  }

  function clamp(value,min,max){
    value=Number(value);
    return Number.isFinite(value)?Math.max(min,Math.min(max,value)):min;
  }

  function day(ts){
    var date=new Date(ts||Date.now());
    return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
  }

  function duration(state,mode){
    return(mode==="break"?state.breakMinutes:state.focusMinutes)*60000;
  }

  function normalize(raw){
    var base=defaults();
    var state=raw&&typeof raw==="object"?Object.assign(base,raw):base;
    state.version=1;
    state.task=String(state.task||"").slice(0,120);
    state.mode=state.mode==="break"?"break":"focus";
    state.status=["idle","running","paused"].indexOf(state.status)>=0?state.status:"idle";
    state.focusMinutes=Math.round(clamp(state.focusMinutes,1,180));
    state.breakMinutes=Math.round(clamp(state.breakMinutes,1,90));
    state.remainingMs=Math.max(0,Number(state.remainingMs)||duration(state,state.mode));
    state.endAt=Math.max(0,Number(state.endAt)||0);
    state.startedAt=Math.max(0,Number(state.startedAt)||0);
    state.completedByDay=state.completedByDay&&typeof state.completedByDay==="object"?state.completedByDay:{};
    state.singleAppMode=state.singleAppMode===true;
    state.guidedAccessReady=state.guidedAccessReady===true;
    return state;
  }

  function read(){
    try{
      var value=localStorage.getItem(config.key);
      return normalize(value?JSON.parse(value):null);
    }catch(error){
      return defaults();
    }
  }

  function write(state,silent){
    state=normalize(Object.assign({},state,{updatedAt:Date.now()}));
    try{localStorage.setItem(config.key,JSON.stringify(state))}catch(error){}
    renderAll(state);
    if(!silent){
      try{global.dispatchEvent(new CustomEvent("sillage-pomodoro-changed",{detail:state}))}catch(error){}
    }
    return state;
  }

  function remaining(state){
    state=normalize(state);
    if(state.status==="running"&&state.endAt){
      return Math.max(0,state.endAt-Date.now());
    }
    return Math.max(0,state.remainingMs);
  }

  function settle(state){
    state=normalize(state);
    if(state.status!=="running"||!state.endAt||state.endAt>Date.now())return state;
    var finished=state.mode;
    if(finished==="focus"){
      var counts=Object.assign({},state.completedByDay);
      counts[day(state.endAt)]=(Number(counts[day(state.endAt)])||0)+1;
      state=Object.assign({},state,{
        completedByDay:counts,
        mode:"break",
        status:"idle",
        endAt:0,
        startedAt:0,
        remainingMs:duration(state,"break")
      });
      write(state);
      toast("这一颗熟啦","连按三下侧边键并验证，就可以结束单页锁定去休息。",state.singleAppMode);
    }else{
      state=Object.assign({},state,{
        mode:"focus",
        status:"idle",
        endAt:0,
        startedAt:0,
        remainingMs:duration(state,"focus")
      });
      write(state);
      toast("休息好啦","下一颗可以慢慢抱住。",false);
    }
    return state;
  }

  function load(){return settle(read())}

  function format(ms){
    var seconds=Math.max(0,Math.ceil(ms/1000));
    return String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
  }

  function phase(state){return state.mode==="focus"?"专注":"休息"}
  function status(state){return state.status==="running"?"进行中":state.status==="paused"?"暂停中":"待开始"}
  function completed(state){return Math.max(0,Number(state.completedByDay[day()])||0)}

  function start(){
    var state=load();
    var ms=remaining(state)||duration(state,state.mode);
    state=write(Object.assign({},state,{
      status:"running",
      endAt:Date.now()+ms,
      startedAt:state.startedAt||Date.now(),
      remainingMs:ms
    }));
    if(state.singleAppMode&&state.mode==="focus")showSingleAppCue();
    return state;
  }

  function pause(){
    var state=load();
    if(state.status!=="running")return state;
    state=write(Object.assign({},state,{status:"paused",remainingMs:remaining(state),endAt:0}));
    if(state.singleAppMode)toast("这一颗暂停啦","要离开本页时，连按三下侧边键并验证后点“结束”。",true);
    return state;
  }

  function toggle(){return load().status==="running"?pause():start()}

  function reset(){
    var state=load();
    return write(Object.assign({},state,{
      status:"idle",
      endAt:0,
      startedAt:0,
      remainingMs:duration(state,state.mode)
    }));
  }

  function skip(){
    var state=load();
    var next=state.mode==="focus"?"break":"focus";
    return write(Object.assign({},state,{
      mode:next,
      status:"idle",
      endAt:0,
      startedAt:0,
      remainingMs:duration(state,next)
    }));
  }

  function setTask(value){
    var state=load();
    return write(Object.assign({},state,{task:String(value||"").slice(0,120)}));
  }

  function prompt(){
    var state=load();
    return[
      "[番茄钟 · 实时状态]",
      "任务："+(state.task.trim()||"未填写"),
      "阶段："+phase(state),
      "状态："+status(state),
      "剩余："+format(remaining(state)),
      "今日完成："+completed(state)+" 颗",
      "单页锁定："+(state.singleAppMode?"已开启；用户会用 iOS 引导式访问把设备限制在当前 PWA":"未开启"),
      "说明：这是发送本轮消息时读取的实时状态，不代表 AI 在后台持续计时。",
      "[/番茄钟 · 实时状态]"
    ].join("\n");
  }

  function toast(title,body,important){
    var old=document.querySelector(".sfp-toast");
    if(old)old.remove();
    var node=document.createElement("div");
    node.className="sfp-toast"+(important?" important":"");
    node.textContent=title+" · "+body;
    document.body.appendChild(node);
    setTimeout(function(){node.remove()},3800);
  }

  function showGuide(){
    var old=document.querySelector(".sfp-guide");
    if(old)old.remove();
    var guide=document.createElement("div");
    guide.className="sfp-guide";
    guide.innerHTML='<section class="sfp-guide-card" role="dialog" aria-modal="true" aria-label="引导式访问设置"><button class="sfp-x" aria-label="关闭">×</button><div class="sfp-guide-cat">📌</div><h2>把 iPhone 钉在这一页</h2><p>这次不是熄屏。开启后，回桌面、切 App 和打开游戏都会被系统拦住，当前番茄钟仍能正常操作。</p><ol><li><b>打开 iPhone“设置”</b><span>进入“辅助功能 → 引导式访问”，把它打开。</span></li><li><b>设置退出密码</b><span>自控困难时可以关闭 Face ID，请信任的人代设密码。</span></li><li><b>从主屏幕打开 PWA</b><span>普通 Safari 会锁住整个 Safari，不是单独这个网站。</span></li><li><b>开始番茄后连按三下侧边键</b><span>选择“引导式访问”并点“开始”；结束时再连按三下并验证退出。</span></li></ol><div class="sfp-guide-actions"><a href="'+config.appleGuide+'" target="_blank" rel="noreferrer">查看苹果官方说明</a><button data-ready>已经配好，开启单页锁定</button></div></section>';
    document.body.appendChild(guide);
    guide.querySelector(".sfp-x").addEventListener("click",function(){guide.remove()});
    guide.addEventListener("click",function(event){if(event.target===guide)guide.remove()});
    guide.querySelector("[data-ready]").addEventListener("click",function(){
      var state=load();
      state.guidedAccessReady=true;
      state.singleAppMode=true;
      write(state);
      guide.remove();
      toast("单页锁定准备好啦","开始专注后，小猫会提醒你连按三下侧边键。",false);
    });
  }

  function showSingleAppCue(){
    var old=document.querySelector(".sfp-cue");
    if(old)old.remove();
    var cue=document.createElement("div");
    cue.className="sfp-cue";
    cue.innerHTML='<section class="sfp-cue-card" role="dialog" aria-modal="true" aria-label="开始单页锁定"><div class="sfp-cue-cat">🐈‍⬛</div><h2>现在把小猫钉在这一页</h2><p>连续按三下 iPhone 右侧电源键，选择“引导式访问”，再点“开始”。之后上滑回桌面和切换游戏都会被拦住。</p><small>请从主屏幕 PWA 图标打开，而不是普通 Safari 标签页。</small><button data-ok>好，去按三下侧边键</button><button class="soft" data-help>第一次用，看看设置</button></section>';
    document.body.appendChild(cue);
    cue.querySelector("[data-ok]").addEventListener("click",function(){cue.remove()});
    cue.querySelector("[data-help]").addEventListener("click",function(){cue.remove();showGuide()});
    cue.addEventListener("click",function(event){if(event.target===cue)cue.remove()});
  }

  function renderMount(root,state){
    if(!root||!root.isConnected)return;
    var task=root.querySelector("[data-task]");
    var clock=root.querySelector("[data-clock]");
    var meta=root.querySelector("[data-meta]");
    var action=root.querySelector("[data-action]");
    var badge=root.querySelector("[data-lock]");
    task.textContent=state.task.trim()||"这一颗想抱住什么？";
    clock.textContent=format(remaining(state));
    meta.textContent=phase(state)+" · "+status(state)+" · 今日 "+completed(state)+" 颗";
    action.textContent=state.status==="running"?"暂停":state.status==="paused"?"继续":state.singleAppMode&&state.mode==="focus"?"钉住":"开始";
    badge.hidden=!state.singleAppMode;
    root.dataset.state=state.status;
    root.dataset.mode=state.mode;
  }

  function renderAll(state){
    state=state?normalize(state):settle(read());
    mounts=mounts.filter(function(root){return root&&root.isConnected});
    mounts.forEach(function(root){renderMount(root,state)});
    if(overlay)renderModal(state);
  }

  function mount(target){
    installStyles();
    var host=typeof target==="string"?document.querySelector(target):target;
    if(!host)throw new Error("SillagePomodoro.mount target not found");
    host.classList.add("sfp-card");
    host.innerHTML='<div class="sfp-tomato">🍅</div><div class="sfp-main"><div class="sfp-title">'+config.title+' <span data-lock hidden>📌 锁在本页</span></div><div class="sfp-task" data-task></div><div class="sfp-meta" data-meta></div></div><div class="sfp-side"><strong data-clock>25:00</strong><button data-action type="button">开始</button></div>';
    host.addEventListener("click",function(event){
      if(event.target.closest("[data-action]"))return;
      open();
    });
    host.querySelector("[data-action]").addEventListener("click",function(event){event.stopPropagation();toggle()});
    mounts.push(host);
    renderMount(host,load());
    return host;
  }

  function renderModal(state){
    if(!overlay)return;
    overlay.querySelector("[data-time]").textContent=format(remaining(state));
    overlay.querySelector("[data-phase]").textContent=phase(state)+" · "+status(state);
    var task=overlay.querySelector("[data-input-task]");
    if(document.activeElement!==task)task.value=state.task;
    overlay.querySelector("[data-main]").textContent=state.status==="running"?"暂停一下":state.status==="paused"?"继续"+phase(state):"开始"+phase(state);
    overlay.querySelector("[data-count]").textContent=completed(state);
    overlay.querySelector("[data-focus]").value=state.focusMinutes;
    overlay.querySelector("[data-break]").value=state.breakMinutes;
    var toggleButton=overlay.querySelector("[data-single]");
    toggleButton.classList.toggle("on",state.singleAppMode);
    toggleButton.textContent=state.guidedAccessReady?(state.singleAppMode?"单页锁定开":"已关闭"):"第一次设置";
    overlay.querySelector("[data-single-status]").textContent=state.singleAppMode?"准备好了。开始专注后连按三下侧边键，就不能切去游戏。":state.guidedAccessReady?"现在没锁。打开后每颗番茄都会提醒你钉在本页。":"还没设置。跟着四步打开 iPhone 引导式访问。";
  }

  function open(){
    installStyles();
    close();
    overlay=document.createElement("div");
    overlay.className="sfp-overlay";
    overlay.innerHTML='<section class="sfp-sheet" role="dialog" aria-modal="true" aria-label="小猫番茄钟"><div class="sfp-handle"></div><header><button data-close>关闭</button><div><h2>'+config.title+'</h2><small>把今天切成软乎乎的小块</small></div><button data-skip>换阶段</button></header><div class="sfp-clock"><strong data-time>25:00</strong><span data-phase>专注 · 待开始</span></div><input class="sfp-input" data-input-task maxlength="120" placeholder="这一颗番茄想抱住什么？"><div class="sfp-actions"><button data-reset>重来</button><button class="primary" data-main>开始专注</button><button data-skip>跳过</button></div><div class="sfp-stats"><span>今天熟了 <b data-count>0</b> 颗</span><label>专注 <input data-focus type="number" min="1" max="180"> 分钟</label><label>休息 <input data-break type="number" min="1" max="90"> 分钟</label></div><div class="sfp-single-card"><div class="sfp-single-head"><span>📌</span><div><b>锁在这一页</b><small data-single-status></small></div><button data-single>第一次设置</button></div><div class="sfp-single-links"><button data-guide>第一次怎么设置</button><button data-rehearse>演练锁在本页</button></div></div><p class="sfp-foot">单页锁定使用 iPhone 自带的“引导式访问”。它不会上传任务或计时数据。</p></section>';
    document.body.appendChild(overlay);
    overlay.querySelector("[data-close]").addEventListener("click",close);
    overlay.addEventListener("click",function(event){if(event.target===overlay)close()});
    overlay.querySelector("[data-input-task]").addEventListener("change",function(){setTask(this.value)});
    overlay.querySelector("[data-main]").addEventListener("click",toggle);
    overlay.querySelector("[data-reset]").addEventListener("click",reset);
    overlay.querySelectorAll("[data-skip]").forEach(function(button){button.addEventListener("click",skip)});
    overlay.querySelector("[data-focus]").addEventListener("change",function(){
      var state=load();state.focusMinutes=Math.round(clamp(this.value,1,180));if(state.status!=="running"&&state.mode==="focus")state.remainingMs=duration(state,"focus");write(state);
    });
    overlay.querySelector("[data-break]").addEventListener("change",function(){
      var state=load();state.breakMinutes=Math.round(clamp(this.value,1,90));if(state.status!=="running"&&state.mode==="break")state.remainingMs=duration(state,"break");write(state);
    });
    overlay.querySelector("[data-single]").addEventListener("click",function(){
      var state=load();
      if(!state.guidedAccessReady){showGuide();return}
      state.singleAppMode=!state.singleAppMode;
      write(state);
    });
    overlay.querySelector("[data-guide]").addEventListener("click",showGuide);
    overlay.querySelector("[data-rehearse]").addEventListener("click",showSingleAppCue);
    modalTimer=setInterval(function(){renderAll()},500);
    renderModal(load());
  }

  function close(){
    if(modalTimer)clearInterval(modalTimer);
    modalTimer=0;
    if(overlay)overlay.remove();
    overlay=null;
  }

  function configure(options){
    options=options||{};
    if(options.key)config.key=String(options.key);
    if(options.title)config.title=String(options.title);
    if(options.appleGuide)config.appleGuide=String(options.appleGuide);
    renderAll();
  }

  function installStyles(){
    if(document.getElementById("sillage-focus-pomodoro-style"))return;
    var style=document.createElement("style");
    style.id="sillage-focus-pomodoro-style";
    style.textContent='.sfp-card{position:relative;display:flex;align-items:center;gap:12px;padding:15px;border:.5px solid rgba(216,165,183,.35);border-radius:24px;background:linear-gradient(115deg,rgba(255,253,254,.95),rgba(247,224,232,.78));box-shadow:0 9px 26px rgba(128,73,93,.09);cursor:pointer;overflow:hidden}.sfp-tomato{width:52px;height:52px;display:grid;place-items:center;flex:0 0 auto;border-radius:19px;background:radial-gradient(circle at 35% 25%,#fff9fb,#f0c8d4 72%);font-size:23px}.sfp-main{flex:1;min-width:0}.sfp-title{font-size:14px;font-weight:700}.sfp-title [data-lock]{margin-left:4px;padding:2px 6px;border-radius:99px;background:rgba(115,68,84,.09);color:#956174;font-size:8px}.sfp-title [data-lock][hidden]{display:none}.sfp-task{margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8b6876;font-size:11px}.sfp-meta{margin-top:5px;color:#b08796;font-size:9px}.sfp-side{text-align:right}.sfp-side strong{display:block;font:600 22px/1 ui-rounded,-apple-system,sans-serif}.sfp-side button,.sfp-sheet button{border:.5px solid rgba(199,155,171,.3);border-radius:12px;background:rgba(255,255,255,.75);color:#765562;padding:8px 11px;font:11px -apple-system,BlinkMacSystemFont,sans-serif}.sfp-side button{margin-top:8px;border:0;border-radius:999px;background:#654752;color:#fff}.sfp-overlay,.sfp-guide,.sfp-cue{position:fixed;z-index:2147483000;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(54,33,43,.36);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.sfp-sheet{width:min(640px,100%);max-height:92dvh;padding:8px 16px calc(17px + env(safe-area-inset-bottom));overflow:auto;border-radius:28px 28px 0 0;background:rgba(255,249,251,.99);box-shadow:0 -20px 70px rgba(80,44,60,.2)}.sfp-handle{width:38px;height:4px;margin:2px auto 10px;border-radius:99px;background:rgba(180,140,155,.32)}.sfp-sheet header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;text-align:center}.sfp-sheet h2{margin:0;font-size:16px}.sfp-sheet header small{color:#ab8795;font-size:9px}.sfp-clock{width:162px;height:162px;margin:18px auto 13px;display:grid;place-content:center;text-align:center;border-radius:50%;background:radial-gradient(circle,#fff 48%,#f3d7e0 49%,#f8e9ee 65%,transparent 66%)}.sfp-clock strong{font:650 38px/1 ui-rounded,-apple-system,sans-serif}.sfp-clock span{margin-top:7px;color:#a47c8b;font-size:10px}.sfp-input{width:100%;padding:12px 14px;border:.5px solid rgba(199,155,171,.35);border-radius:15px;background:rgba(255,255,255,.72);color:#654752;font:12px inherit;outline:none}.sfp-actions{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:7px;margin-top:9px}.sfp-actions .primary{border-color:#654752;background:#654752;color:#fff}.sfp-stats{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:15px 0 0;padding:11px;border-radius:15px;background:rgba(235,210,219,.27);color:#8d6977;font-size:10px}.sfp-stats span{margin-right:auto}.sfp-stats input{width:44px;border:.5px solid rgba(199,155,171,.3);border-radius:8px;background:#fff;text-align:center}.sfp-single-card{margin-top:10px;padding:13px;border:.5px solid rgba(190,135,153,.25);border-radius:18px;background:linear-gradient(135deg,rgba(108,65,80,.08),rgba(235,181,197,.15))}.sfp-single-head{display:flex;align-items:center;gap:10px}.sfp-single-head>span{width:38px;height:38px;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.76)}.sfp-single-head>div{flex:1}.sfp-single-head b{display:block;font-size:12px}.sfp-single-head small{display:block;margin-top:3px;color:#9e7786;font-size:9px;line-height:1.5}.sfp-single-head button.on{background:#654752;color:#fff}.sfp-single-links{display:flex;gap:7px;margin-top:10px}.sfp-single-links button{flex:1}.sfp-foot{margin:11px 3px 0;color:#ac8996;font-size:9px;line-height:1.7}.sfp-guide,.sfp-cue{align-items:center;padding:18px}.sfp-guide-card,.sfp-cue-card{position:relative;width:min(372px,100%);max-height:92dvh;overflow:auto;padding:22px 18px;border-radius:27px;background:rgba(255,250,252,.99);box-shadow:0 22px 70px rgba(70,38,53,.24);text-align:center}.sfp-guide-card h2,.sfp-cue-card h2{margin:5px 0 7px;font-size:18px}.sfp-guide-card>p,.sfp-cue-card>p{margin:0;color:#8b6876;font-size:11px;line-height:1.75}.sfp-guide-cat,.sfp-cue-cat{font-size:30px}.sfp-x{position:absolute;right:12px;top:12px;border:0!important;border-radius:50%!important;background:rgba(228,210,217,.55)!important}.sfp-guide ol{margin:14px 0 0;padding:0;list-style:none;text-align:left}.sfp-guide li{position:relative;padding:10px 4px 10px 36px;border-top:.5px solid rgba(205,170,183,.25)}.sfp-guide li:before{position:absolute;left:4px;top:10px;width:24px;height:24px;display:grid;place-items:center;border-radius:9px;background:#efd8df;color:#895b6c;font-size:10px;content:counter(list-item)}.sfp-guide li b,.sfp-guide li span{display:block}.sfp-guide li b{font-size:11px}.sfp-guide li span{margin-top:2px;color:#9e7c89;font-size:9px;line-height:1.55}.sfp-guide-actions{display:grid;gap:7px;margin-top:12px}.sfp-guide-actions a,.sfp-guide-actions button,.sfp-cue-card button{display:block;width:100%;padding:11px;border:0;border-radius:13px;background:#654752;color:#fff;text-decoration:none;font:11px inherit}.sfp-cue-card small{display:block;margin:12px 0;padding:9px;border-radius:12px;background:rgba(235,210,219,.3);color:#9d7786;font-size:9px;line-height:1.55}.sfp-cue-card button{margin-top:7px}.sfp-cue-card button.soft{background:rgba(233,207,216,.58);color:#785765}.sfp-toast{position:fixed;z-index:2147483647;top:calc(env(safe-area-inset-top) + 15px);left:50%;max-width:84vw;padding:10px 14px;transform:translateX(-50%);border-radius:14px;background:rgba(75,58,66,.94);box-shadow:0 10px 30px rgba(0,0,0,.16);color:#fff;text-align:center;font:11px/1.55 -apple-system,sans-serif}.sfp-toast.important{background:rgba(91,60,73,.97)}html[data-theme=angel] .sfp-card{border-color:rgba(195,195,205,.58);background:linear-gradient(115deg,rgba(255,255,255,.94),rgba(232,232,238,.78))}html[data-theme=angel] .sfp-tomato{background:radial-gradient(circle at 35% 25%,#fff,#e3e3e9 72%)}html[data-theme=angel] .sfp-title,html[data-theme=angel] .sfp-side strong,html[data-theme=angel] .sfp-sheet,html[data-theme=angel] .sfp-guide-card,html[data-theme=angel] .sfp-cue-card{color:#6d6d78}html[data-theme=angel] .sfp-task,html[data-theme=angel] .sfp-meta{color:#92929d}html[data-theme=angel] .sfp-side button,html[data-theme=angel] .sfp-actions .primary,html[data-theme=angel] .sfp-single-head button.on,html[data-theme=angel] .sfp-guide-actions a,html[data-theme=angel] .sfp-guide-actions button,html[data-theme=angel] .sfp-cue-card button{background:#73737f}html[data-theme=angel] .sfp-sheet,html[data-theme=angel] .sfp-guide-card,html[data-theme=angel] .sfp-cue-card{background:rgba(249,249,251,.99)}html[data-theme=angel] .sfp-single-card{border-color:rgba(195,195,205,.55);background:linear-gradient(135deg,rgba(120,120,133,.08),rgba(224,224,231,.4))}';
    document.head.appendChild(style);
  }

  global.SillagePomodoro={
    configure:configure,
    mount:mount,
    open:open,
    close:close,
    load:load,
    start:start,
    pause:pause,
    toggle:toggle,
    reset:reset,
    skip:skip,
    setTask:setTask,
    remaining:function(){return remaining(load())},
    format:format,
    prompt:prompt,
    showGuide:showGuide,
    showSingleAppCue:showSingleAppCue
  };

  installStyles();
  setInterval(function(){renderAll()},1000);
  global.addEventListener("storage",function(event){if(event.key===config.key)renderAll()});
})(window);
