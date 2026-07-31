(function(){
  "use strict";
  var root=document.documentElement;
  var themeButton=document.getElementById("theme-toggle");
  var preview=document.getElementById("prompt-preview");
  SillagePomodoro.mount("#focus-pomodoro");
  function refresh(){preview.textContent=SillagePomodoro.prompt()}
  themeButton.addEventListener("click",function(){
    var next=root.dataset.theme==="angel"?"powder":"angel";
    root.dataset.theme=next;
    themeButton.textContent=next==="angel"?"切到樱花粉":"切到 Angel";
  });
  document.getElementById("copy-prompt").addEventListener("click",function(){
    navigator.clipboard&&navigator.clipboard.writeText(SillagePomodoro.prompt());
    this.textContent="复制好啦";
    setTimeout(()=>{this.textContent="复制状态"},1200);
  });
  window.addEventListener("sillage-pomodoro-changed",refresh);
  setInterval(refresh,1000);
  refresh();
})();
