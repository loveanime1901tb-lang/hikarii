/* Hikarii: show maintenance message even in an already-open tab.
   Check every 30s while visible; Node /api/health returns status without file IO. */
(function(){
  'use strict';
  var inFlight=false;
  function check(){
    if(inFlight || (typeof document.hidden==='boolean' && document.hidden))return;
    inFlight=true;
    var x=new XMLHttpRequest();
    x.open('GET','/api/health',true);
    x.timeout=7000;
    x.onload=function(){
      inFlight=false;
      if(x.status!==200 && x.status!==503)return;
      try{if(JSON.parse(x.responseText).maintenance===true)window.location.replace('/maintenance');}catch(e){}
    };
    x.onerror=x.ontimeout=x.onabort=function(){inFlight=false;};
    try{x.send();}catch(e){inFlight=false;}
  }
  setInterval(check,30000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)check();});
  window.addEventListener('focus',check);
})();
