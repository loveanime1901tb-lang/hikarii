(function(){
  'use strict';
  var button=document.getElementById('fullscreen-toggle');
  if(!button)return;
  var root=document.documentElement;
  function full(){return document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.msFullscreenElement;}
  function update(){var active=!!full();button.textContent=active?'⤢':'⛶';button.title=active?'Thoát toàn màn hình':'Toàn màn hình';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(active));}
  button.addEventListener('click',function(){
    var promise,fn;
    try{
      if(full()){
        fn=document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen;
        if(!fn)throw Error('Trình duyệt không hỗ trợ thoát toàn màn hình.');
        promise=fn.call(document);
      }else{
        fn=root.requestFullscreen||root.webkitRequestFullscreen||root.mozRequestFullScreen||root.msRequestFullscreen;
        if(!fn)throw Error('Trình duyệt này chưa hỗ trợ chế độ toàn màn hình.');
        promise=fn.call(root);
      }
      if(promise&&typeof promise.catch==='function')promise.catch(function(){notify('Không mở được toàn màn hình trên trình duyệt này.');});
    }catch(err){notify(err.message);}
  });
  function notify(message){var toast=document.getElementById('toast');if(toast){toast.textContent=message;toast.hidden=false;setTimeout(function(){toast.hidden=true;},3000);}else alert(message);}
  ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(function(event){document.addEventListener(event,update);});
  update();
})();
