/* EVA Neural Network Avatar — Canvas style Jarvis/Iron Man */
(function(){
'use strict';
/* ── Positions des neurones (fractions 0-1 du canvas) ──────────── */
var RN = [
  /* 0 hub central */ [0.500,0.500,6.5],
  /* 1-6 anneau interne */ [0.500,0.248,4.8],[0.716,0.374,4.8],[0.716,0.626,4.8],[0.500,0.752,4.8],[0.284,0.626,4.8],[0.284,0.374,4.8],
  /* 7-16 anneau externe */ [0.500,0.062,3.2],[0.740,0.128,3.2],[0.938,0.350,3.2],[0.938,0.600,3.2],[0.740,0.870,3.2],[0.500,0.935,3.2],[0.260,0.870,3.2],[0.062,0.600,3.2],[0.062,0.350,3.2],[0.260,0.128,3.2]
];
/* ── Arêtes (paires d'indices) ───────────────────────────────────── */
var RE = [
  [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],
  [1,2],[2,3],[3,4],[4,5],[5,6],[6,1],
  [1,7],[1,8],[1,16],[2,8],[2,9],[3,9],[3,10],[4,10],[4,11],[4,12],[5,12],[5,13],[6,13],[6,14],[6,15],[6,16],
  [7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,7]
];
/* ── Thèmes par état ─────────────────────────────────────────────── */
var TH = {
  idle:     {n:'#5b77f7',e:'rgba(91,119,247,{a})',s:'#7be4ff',g:'#5b77f7'},
  thinking: {n:'#a855f7',e:'rgba(168,85,247,{a})',s:'#e879f9',g:'#c084fc'},
  speaking: {n:'#06b6d4',e:'rgba(6,182,212,{a})',s:'#67e8f9',g:'#22d3ee'},
  listening:{n:'#10b981',e:'rgba(16,185,129,{a})',s:'#6ee7b7',g:'#34d399'},
  happy:    {n:'#f59e0b',e:'rgba(245,158,11,{a})',s:'#fde68a',g:'#fbbf24'}
};
function hr(c,a){var r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';}
function ea(t,a){return t.e.replace('{a}',a);}

var SZ=256, _c=null, _cv=null, _cx=null, _st='idle';
var nodes=[], edges=[], glows=[], sigs=[], _raf=null, _lt=0, _t=0;
var _happyTimer=null, _safetyTimer=null;

function init(){
  nodes=RN.map(function(n){return{x:n[0]*SZ,y:n[1]*SZ,r:n[2]};});
  edges=RE.map(function(e){var a=nodes[e[0]],b=nodes[e[1]];return{a:e[0],b:e[1],ax:a.x,ay:a.y,bx:b.x,by:b.y};});
  glows=nodes.map(function(){return 0;});
}

function spawn(){
  if(!edges.length)return;
  var r={idle:0.018,thinking:0.10,speaking:0.075,listening:0.045,happy:0.22};
  if(Math.random()>=(r[_st]||0.018))return;
  sigs.push({ei:Math.floor(Math.random()*edges.length),t:0,sp:0.007+Math.random()*0.013,rv:_st==='listening'&&Math.random()>0.35});
}

function draw(ts){
  if(!_cv||!_cx)return;
  var dt=Math.min((ts-_lt)/16.67,3);_lt=ts;_t=ts*.001;
  var th=TH[_st]||TH.idle;
  _cx.clearRect(0,0,SZ,SZ);

  /* decay glows */
  for(var k=0;k<glows.length;k++) glows[k]=Math.max(0,glows[k]-0.03*dt);

  /* update + filter signals */
  var alive=[];
  for(var i=0;i<sigs.length;i++){
    var s=sigs[i]; s.t+=s.sp*dt;
    if(s.t<1){alive.push(s);}
    else{var e=edges[s.ei];if(e){var dn=s.rv?e.a:e.b;glows[dn]=Math.min(1,(glows[dn]||0)+0.9);}}
  }
  sigs=alive; spawn();

  /* signal-driven glow */
  for(var i=0;i<sigs.length;i++){
    var s=sigs[i];var e=edges[s.ei];if(!e)continue;
    var p=s.rv?(1-s.t):s.t;
    if(p<0.15)glows[s.rv?e.b:e.a]=Math.max(glows[s.rv?e.b:e.a]||0,(0.15-p)/0.15*0.55);
    if(p>0.85)glows[s.rv?e.a:e.b]=Math.max(glows[s.rv?e.a:e.b]||0,(p-0.85)/0.15*0.55);
  }
  /* happy flash */
  if(_st==='happy'){var fl=(Math.sin(_t*9)+1)*.5;for(var k=0;k<glows.length;k++)glows[k]=Math.max(glows[k],fl*.95);}

  /* draw edges */
  for(var i=0;i<edges.length;i++){
    var e=edges[i];
    var pa=0.08+0.08*Math.sin(_t*.9+i*.28);
    _cx.beginPath();_cx.moveTo(e.ax,e.ay);_cx.lineTo(e.bx,e.by);
    _cx.strokeStyle=ea(th,pa);_cx.lineWidth=0.9;_cx.stroke();
  }

  /* draw signals */
  for(var i=0;i<sigs.length;i++){
    var s=sigs[i];var e=edges[s.ei];if(!e)continue;
    var p=s.rv?(1-s.t):s.t;
    var sx=e.ax+(e.bx-e.ax)*p, sy=e.ay+(e.by-e.ay)*p;
    var gr=_cx.createRadialGradient(sx,sy,0,sx,sy,10);
    gr.addColorStop(0,hr(th.s,.9));gr.addColorStop(.5,hr(th.g,.3));gr.addColorStop(1,'transparent');
    _cx.beginPath();_cx.arc(sx,sy,10,0,6.283);_cx.fillStyle=gr;_cx.fill();
    _cx.beginPath();_cx.arc(sx,sy,2.8,0,6.283);_cx.fillStyle='rgba(255,255,255,.92)';_cx.fill();
  }

  /* draw nodes */
  var br=.18*Math.sin(_t*1.9);
  for(var i=0;i<nodes.length;i++){
    var n=nodes[i];
    var g=Math.max(0,Math.min((glows[i]||0)+.22+br*(1-i*.03),1));
    var hr2=n.r*(2.4+g*3.8);
    var gr=_cx.createRadialGradient(n.x,n.y,0,n.x,n.y,hr2);
    gr.addColorStop(0,hr(th.g,g*.65));gr.addColorStop(.45,hr(th.g,g*.2));gr.addColorStop(1,'transparent');
    _cx.beginPath();_cx.arc(n.x,n.y,hr2,0,6.283);_cx.fillStyle=gr;_cx.fill();
    _cx.beginPath();_cx.arc(n.x,n.y,n.r,0,6.283);_cx.fillStyle=hr(th.n,.45+g*.55);_cx.fill();
    if(g>.25){
      var gi=_cx.createRadialGradient(n.x-n.r*.28,n.y-n.r*.28,0,n.x,n.y,n.r);
      gi.addColorStop(0,'rgba(255,255,255,'+(g*.65)+')');gi.addColorStop(1,'transparent');
      _cx.beginPath();_cx.arc(n.x,n.y,n.r,0,6.283);_cx.fillStyle=gi;_cx.fill();
    }
  }
  _raf=requestAnimationFrame(draw);
}

function setState(s){
  /* Annuler le timer d'auto-reset happy si on change d'état */
  if(_happyTimer){clearTimeout(_happyTimer);_happyTimer=null;}
  /* Annuler le timer de sécurité speaking si on change d'état */
  if(_safetyTimer){clearTimeout(_safetyTimer);_safetyTimer=null;}
  _st=s||'idle';
  if(_c)_c.setAttribute('data-state',_st);
}

window.EvaCharacter={
  create:function(id){
    _c=document.getElementById(id);if(!_c)return;
    _c.innerHTML='<canvas id="evaNeuralCanvas" style="display:block;margin:auto;border-radius:50%;"></canvas>';
    _cv=document.getElementById('evaNeuralCanvas');_cx=_cv.getContext('2d');
    _cv.width=SZ;_cv.height=SZ;_cv.style.width=SZ+'px';_cv.style.height=SZ+'px';
    init();_st='idle';sigs=[];glows=nodes.map(function(){return 0;});
    if(_raf)cancelAnimationFrame(_raf);
    _lt=performance.now();_raf=requestAnimationFrame(draw);
  },
  setIdle:     function(){setState('idle');},
  setThinking: function(){setState('thinking');},
  setHappy:    function(){
    setState('happy');
    for(var i=0;i<20;i++)sigs.push({ei:Math.floor(Math.random()*edges.length),t:Math.random()*.25,sp:.022,rv:Math.random()>.5});
    /* Auto-reset vers idle après 2.5 s pour éviter que l'orbe reste bloqué en or */
    _happyTimer=setTimeout(function(){_happyTimer=null;if(_st==='happy')setState('idle');},2500);
  },
  setListening:function(){setState('listening');},
  startTalking:function(){
    setState('speaking');
    /* Timer de sécurité : si stopTalking n'est pas appelé dans les 60 s, on revient à idle */
    _safetyTimer=setTimeout(function(){_safetyTimer=null;if(_st==='speaking')setState('idle');},60000);
  },
  stopTalking: function(){setState('idle');}
};
})();