(() => {
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;

const ui = {
  level:document.getElementById("level"), wave:document.getElementById("wave"),
  score:document.getElementById("score"), time:document.getElementById("time"),
  xpfill:document.getElementById("xpfill"), hp:document.getElementById("hp"),
  ballCount:document.getElementById("ballCount"), damage:document.getElementById("damage"),
  pierce:document.getElementById("pierce"), xpmul:document.getElementById("xpmul"),
  build:document.getElementById("build"), start:document.getElementById("start"),
  mobilePause:document.getElementById("mobilePause"),
  levelup:document.getElementById("levelup"), choices:document.getElementById("choices"),
  gameover:document.getElementById("gameover"), result:document.getElementById("result"),
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>Math.random()*(b-a)+a;
const pick=a=>a[(Math.random()*a.length)|0];

let keys = {};
let mouseX = W/2;
let state = null;
let last = performance.now();

const upgrades = [
  {id:"multi", name:"分裂弾", rarity:"RARE", desc:"ボールを1個追加する。", max:5, apply:s=>spawnExtraBall(s)},
  {id:"pierce", name:"貫通", rarity:"RARE", desc:"ボールがブロックを貫通できる回数 +1。", max:5, apply:s=>s.pierce++},
  {id:"wide", name:"巨大パドル", rarity:"COMMON", desc:"パドル幅 +18%。", max:6, apply:s=>s.paddle.w=Math.min(260,s.paddle.w*1.18)},
  {id:"damage", name:"ヘビーボール", rarity:"COMMON", desc:"ブロックへのダメージ +1。", max:8, apply:s=>s.ballDamage++},
  {id:"speed", name:"加速", rarity:"COMMON", desc:"ボール速度 +8%。", max:8, apply:s=>s.ballSpeedMul*=1.08},
  {id:"xp", name:"学習効率", rarity:"COMMON", desc:"獲得XP +20%。", max:8, apply:s=>s.xpMul*=1.2},
  {id:"magnet", name:"磁力", rarity:"COMMON", desc:"XPオーブの吸引距離 +45。", max:6, apply:s=>s.magnet+=45},
  {id:"heal", name:"修復", rarity:"UNCOMMON", desc:"最大HP +1、HPを2回復。", max:5, apply:s=>{s.maxHp++;s.hp=Math.min(s.maxHp,s.hp+2)}},
  {id:"shield", name:"バリア", rarity:"UNCOMMON", desc:"敵弾ダメージを1回無効化するシールド +1。", max:5, apply:s=>s.shields++},
  {id:"collector", name:"オートコレクト", rarity:"LEGEND", desc:"XPオーブがゆっくり自動追尾する。", max:1, apply:s=>s.autoCollect=true},
  {id:"fury", name:"瀕死の猛攻", rarity:"LEGEND", desc:"HPが半分以下ならボール速度とダメージが上昇。", max:1, apply:s=>s.fury=true},
  {id:"echo", name:"エコーショット", rarity:"LEGEND", desc:"8秒ごとに追加ボールを1個生成（上限あり）。", max:1, apply:s=>s.echo=true},
];

function newState(){
  const s = {
    running:false, paused:false, dead:false, startTime:0, elapsed:0, score:0, wave:1,
    level:1, xp:0, nextXp:30, hp:5, maxHp:5, shields:0,
    pierce:0, ballDamage:1, ballSpeedMul:1, xpMul:1, magnet:75, autoCollect:false, fury:false, echo:false,
    echoTimer:0, waveClearTimer:0,
    paddle:{x:W/2-70,y:H-54,w:140,h:16,speed:620},
    balls:[], bricks:[], orbs:[], bullets:[], particles:[], owned:{},
  };
  spawnBall(s, W/2, H-82, rand(-0.65,0.65), -1);
  generateWave(s);
  return s;
}

function spawnBall(s,x,y,dx,dy){
  const len=Math.hypot(dx,dy)||1;
  s.balls.push({x,y,r:7,vx:dx/len*330,vy:dy/len*330,pierceLeft:s.pierce,trail:[]});
}
function spawnExtraBall(s){
  const source = s.balls[0];
  if(source) spawnBall(s,source.x,source.y,rand(-1,1),-1);
  else spawnBall(s,W/2,H-90,rand(-1,1),-1);
}
function generateWave(s){
  s.bricks.length=0;
  const rows=Math.min(7,4+Math.floor(s.wave/2));
  const cols=9;
  const gap=7, margin=40;
  const bw=(W-margin*2-gap*(cols-1))/cols;
  const bh=28;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      if(Math.random()<0.08) continue;
      const x=margin+c*(bw+gap), y=82+r*(bh+gap);
      let type="normal";
      const roll=Math.random();
      if(roll<Math.min(.10+s.wave*.012,.28)) type="enemy";
      else if(roll<Math.min(.27+s.wave*.018,.55)) type="tank";
      const base=1+Math.floor((s.wave-1)/3);
      let hp= type==="tank" ? base+2 : type==="enemy" ? base+1 : base;
      s.bricks.push({x,y,w:bw,h:bh,hp,maxHp:hp,type,shot:rand(1.2,3.4)});
    }
  }
}
function dropOrb(s,x,y,value){s.orbs.push({x,y,r:6,vy:85,value});}
function particle(s,x,y,n=5){for(let i=0;i<n;i++) s.particles.push({x,y,vx:rand(-90,90),vy:rand(-100,50),life:rand(.25,.6),max:.6});}

function reset(){
  state=newState();
  updateUI();
  ui.gameover.classList.add("hidden");
  ui.levelup.classList.add("hidden");
}
reset();

function begin(){
  if(!state || state.dead) reset();
  state.running=true; state.paused=false;
  if(!state.startTime) state.startTime=performance.now();
  ui.start.classList.add("hidden");
}

function bindTap(el, handler){
  let lastTouch = 0;
  const activate = (e)=>{
    if(e && e.cancelable) e.preventDefault();
    if(e) e.stopPropagation();
    const now = performance.now();
    if(e && e.type === "click" && now - lastTouch < 400) return;
    if(e && e.type === "touchend") lastTouch = now;
    handler();
  };
  el.addEventListener("touchend", activate, {passive:false});
  el.addEventListener("click", activate, {passive:false});
}
bindTap(document.getElementById("startBtn"), begin);
bindTap(document.getElementById("retryBtn"), ()=>{reset();begin();});
if(isTouchDevice){
  ui.mobilePause.style.display="block";
  ui.mobilePause.addEventListener("pointerdown",e=>e.stopPropagation());
  bindTap(ui.mobilePause, ()=>{
    if(!state.running) begin();
    else if(ui.levelup.classList.contains("hidden")) state.paused=!state.paused;
  });
}

window.addEventListener("keydown",e=>{
  keys[e.key.toLowerCase()]=true;
  if(e.code==="Space"){
    e.preventDefault();
    if(!state.running) begin();
    else if(!ui.levelup.classList.contains("hidden")) return;
    else state.paused=!state.paused;
  }
});
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

function pointerToGameX(clientX){
  const rect=canvas.getBoundingClientRect();
  return (clientX-rect.left)*W/rect.width;
}

canvas.addEventListener("pointerdown",e=>{
  if(e.pointerType==="touch" || e.pointerType==="pen"){
    e.preventDefault();
    mouseX=pointerToGameX(e.clientX);
    try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
  }
},{passive:false});
canvas.addEventListener("pointermove",e=>{
  if(e.pointerType==="touch" || e.pointerType==="pen"){
    e.preventDefault(); mouseX=pointerToGameX(e.clientX);
  }else{mouseX=pointerToGameX(e.clientX);}
},{passive:false});
canvas.addEventListener("contextmenu",e=>e.preventDefault());
canvas.addEventListener("selectstart",e=>e.preventDefault());
canvas.addEventListener("dragstart",e=>e.preventDefault());
document.addEventListener("contextmenu",e=>{if(isTouchDevice) e.preventDefault();});
document.addEventListener("selectstart",e=>{if(isTouchDevice) e.preventDefault();});
document.addEventListener("touchmove",e=>{
  const t=e.target;
  if(t && t.closest && t.closest("button,.choice,.overlay")) return;
  if(t && t.closest && t.closest("#gamePanel")) e.preventDefault();
},{passive:false});

function hurt(amount=1){
  if(state.shields>0){state.shields--; flash("BLOCK"); return;}
  state.hp-=amount; flash("-"+amount+" HP");
  if(state.hp<=0) endGame();
}
let flashText="",flashLife=0;
function flash(t){flashText=t;flashLife=.8}

function endGame(){
  state.dead=true;state.running=false;
  ui.result.innerHTML=`到達 <b>WAVE ${state.wave}</b> ／ LV ${state.level}<br>スコア <b>${state.score.toLocaleString()}</b><br>生存時間 ${formatTime(state.elapsed)}`;
  ui.gameover.classList.remove("hidden");
}

function levelUp(){
  state.running=false;
  const choices=[];
  const pool=upgrades.filter(u=>(state.owned[u.id]||0)<u.max);
  while(choices.length<3 && pool.length){
    const u=pick(pool);
    if(!choices.includes(u)) choices.push(u);
  }
  if(!choices.length){state.running=true;return;}
  ui.choices.innerHTML="";
  choices.forEach(u=>{
    const div=document.createElement("div");
    div.className="choice";
    div.innerHTML=`<div class="rarity">${u.rarity}</div><h3>${u.name}</h3><p>${u.desc}</p><p>現在 Lv.${state.owned[u.id]||0}</p>`;
    div.addEventListener("contextmenu",e=>e.preventDefault());
    div.addEventListener("selectstart",e=>e.preventDefault());
    bindTap(div, ()=>{
      state.owned[u.id]=(state.owned[u.id]||0)+1;
      u.apply(state);
      state.balls.forEach(b=>b.pierceLeft=state.pierce);
      ui.levelup.classList.add("hidden");
      state.running=true;
      updateUI();
    });
    ui.choices.appendChild(div);
  });
  ui.levelup.classList.remove("hidden");
}

function gainXp(v){
  state.xp+=v*state.xpMul;
  while(state.xp>=state.nextXp){
    state.xp-=state.nextXp;
    state.level++;
    state.nextXp=Math.floor(state.nextXp*1.28+10);
    levelUp();
    break;
  }
}

function update(dt){
  if(!state.running || state.paused || state.dead) return;
  state.elapsed += dt;
  let dir=(keys["arrowright"]||keys["d"]?1:0)-(keys["arrowleft"]||keys["a"]?1:0);
  if(dir) state.paddle.x+=dir*state.paddle.speed*dt;
  else state.paddle.x += (mouseX-state.paddle.w/2-state.paddle.x)*Math.min(1,dt*12);
  state.paddle.x=clamp(state.paddle.x,0,W-state.paddle.w);

  if(state.echo){
    state.echoTimer+=dt;
    if(state.echoTimer>=8){state.echoTimer=0;if(state.balls.length<8) spawnExtraBall(state);}
  }

  for(const b of state.bricks){
    if(b.type==="enemy"){
      b.shot-=dt;
      if(b.shot<=0){
        b.shot=rand(1.7,3.3)*Math.max(.6,1-state.wave*.015);
        state.bullets.push({x:b.x+b.w/2,y:b.y+b.h,vx:rand(-35,35),vy:130+state.wave*5,r:5});
      }
    }
  }

  for(let i=state.bullets.length-1;i>=0;i--){
    const q=state.bullets[i]; q.x+=q.vx*dt;q.y+=q.vy*dt;
    if(circleRect(q,state.paddle)){state.bullets.splice(i,1);hurt(1);continue;}
    if(q.y>H+20) state.bullets.splice(i,1);
  }

  const furyOn=state.fury && state.hp<=state.maxHp/2;
  const speedMul=state.ballSpeedMul*(furyOn?1.18:1);
  const dmg=state.ballDamage+(furyOn?1:0);

  for(let i=state.balls.length-1;i>=0;i--){
    const ball=state.balls[i];
    ball.trail.push({x:ball.x,y:ball.y});
    if(ball.trail.length>7) ball.trail.shift();
    let target=330*speedMul, cur=Math.hypot(ball.vx,ball.vy)||1;
    ball.vx=ball.vx/cur*target; ball.vy=ball.vy/cur*target;
    ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;

    if(ball.x-ball.r<0){ball.x=ball.r;ball.vx=Math.abs(ball.vx)}
    if(ball.x+ball.r>W){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx)}
    if(ball.y-ball.r<52){ball.y=52+ball.r;ball.vy=Math.abs(ball.vy)}

    if(ball.vy>0 && circleRect(ball,state.paddle)){
      ball.y=state.paddle.y-ball.r-1;
      const hit=(ball.x-(state.paddle.x+state.paddle.w/2))/(state.paddle.w/2);
      const ang=hit*1.05;
      ball.vx=Math.sin(ang)*target;
      ball.vy=-Math.cos(ang)*target;
      ball.pierceLeft=state.pierce;
    }

    let hitBrick=-1;
    for(let j=0;j<state.bricks.length;j++){if(circleRect(ball,state.bricks[j])){hitBrick=j;break;}}
    if(hitBrick>=0){
      const b=state.bricks[hitBrick];
      b.hp-=dmg; particle(state,ball.x,ball.y,4);
      if(b.hp<=0){
        state.score += b.type==="enemy"?180:b.type==="tank"?120:75;
        dropOrb(state,b.x+b.w/2,b.y+b.h/2,b.type==="enemy"?8:b.type==="tank"?6:4);
        state.bricks.splice(hitBrick,1);
      }
      if(ball.pierceLeft>0){ball.pierceLeft--;}
      else{
        const cx=clamp(ball.x,b.x,b.x+b.w), cy=clamp(ball.y,b.y,b.y+b.h);
        const dx=ball.x-cx,dy=ball.y-cy;
        if(Math.abs(dx)>Math.abs(dy)) ball.vx*=-1; else ball.vy*=-1;
      }
    }

    if(ball.y-ball.r>H){
      state.balls.splice(i,1);
      if(state.balls.length===0){
        hurt(1);
        if(!state.dead) spawnBall(state,state.paddle.x+state.paddle.w/2,state.paddle.y-18,rand(-.65,.65),-1);
      }
    }
  }

  for(let i=state.orbs.length-1;i>=0;i--){
    const o=state.orbs[i];
    const pcx=state.paddle.x+state.paddle.w/2, pcy=state.paddle.y;
    const d=Math.hypot(pcx-o.x,pcy-o.y);
    if(d<state.magnet || state.autoCollect){
      const strength=state.autoCollect?210:260;
      o.x+=(pcx-o.x)/Math.max(d,1)*strength*dt;
      o.y+=(pcy-o.y)/Math.max(d,1)*strength*dt;
    }else o.y+=o.vy*dt;
    if(circleRect(o,state.paddle)){gainXp(o.value);state.orbs.splice(i,1);continue;}
    if(o.y>H+30) state.orbs.splice(i,1);
  }

  for(let i=state.particles.length-1;i>=0;i--){
    const p=state.particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;
    if(p.life<=0)state.particles.splice(i,1);
  }

  if(state.bricks.length===0){
    state.waveClearTimer+=dt;
    if(state.waveClearTimer>.9){state.wave++;state.waveClearTimer=0;state.score+=500*state.wave;generateWave(state);}
  }

  if(flashLife>0) flashLife-=dt;
  updateUI();
}

function circleRect(c,r){
  const x=clamp(c.x,r.x,r.x+r.w), y=clamp(c.y,r.y,r.y+r.h);
  return (c.x-x)**2+(c.y-y)**2 < c.r**2;
}
function formatTime(sec){sec=Math.floor(sec);const m=Math.floor(sec/60),s=sec%60;return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");}

function updateUI(){
  if(!state)return;
  ui.level.textContent="LV "+state.level;
  ui.wave.textContent="WAVE "+state.wave;
  ui.score.textContent="SCORE "+state.score.toLocaleString();
  ui.time.textContent=formatTime(state.elapsed);
  ui.xpfill.style.width=(state.xp/state.nextXp*100)+"%";
  ui.hp.textContent=`${state.hp} / ${state.maxHp}`+(state.shields?` + 🛡${state.shields}`:"");
  ui.ballCount.textContent=state.balls.length;
  ui.damage.textContent=state.ballDamage+(state.fury?" (+瀕死)":"");
  ui.pierce.textContent=state.pierce;
  ui.xpmul.textContent=state.xpMul.toFixed(2)+"x";
  ui.build.innerHTML=Object.entries(state.owned).map(([id,n])=>{
    const u=upgrades.find(x=>x.id===id);
    return `<div class="chip"><b>${u.name} Lv.${n}</b>${u.desc}</div>`;
  }).join("") || `<div class="chip">まだ強化なし</div>`;
}

function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#050810";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(100,140,190,.055)";ctx.lineWidth=1;
  for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  ctx.strokeStyle="rgba(255,90,90,.12)";ctx.beginPath();ctx.moveTo(0,H-90);ctx.lineTo(W,H-90);ctx.stroke();

  for(const b of state.bricks){
    const ratio=b.hp/b.maxHp;
    ctx.fillStyle=b.type==="enemy"?"#7f1d1d":b.type==="tank"?"#334155":"#1d4ed8";
    roundRect(ctx,b.x,b.y,b.w,b.h,7,true);
    ctx.fillStyle="rgba(255,255,255,.13)";ctx.fillRect(b.x+5,b.y+5,(b.w-10)*ratio,4);
    if(b.type==="enemy"){ctx.fillStyle="#fecaca";ctx.beginPath();ctx.arc(b.x+b.w/2,b.y+b.h/2,5,0,Math.PI*2);ctx.fill();}
    else if(b.type==="tank"){ctx.strokeStyle="#94a3b8";ctx.strokeRect(b.x+7,b.y+7,b.w-14,b.h-14);}
  }

  for(const o of state.orbs){ctx.shadowBlur=16;ctx.shadowColor="#38bdf8";ctx.fillStyle="#7dd3fc";ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  for(const q of state.bullets){ctx.shadowBlur=12;ctx.shadowColor="#ef4444";ctx.fillStyle="#fb7185";ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}

  const p=state.paddle;
  ctx.shadowBlur=18;ctx.shadowColor="#a78bfa";ctx.fillStyle="#c4b5fd";
  roundRect(ctx,p.x,p.y,p.w,p.h,8,true);ctx.shadowBlur=0;

  for(const b of state.balls){
    b.trail.forEach((t,i)=>{ctx.globalAlpha=(i+1)/b.trail.length*.16;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(t.x,t.y,b.r*(i+1)/b.trail.length,0,Math.PI*2);ctx.fill()});
    ctx.globalAlpha=1;ctx.shadowBlur=18;ctx.shadowColor="#fff";ctx.fillStyle="#f8fafc";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle="#f8fafc";ctx.fillRect(p.x,p.y,3,3);}
  ctx.globalAlpha=1;

  if(state.paused && state.running){ctx.fillStyle="rgba(0,0,0,.45)";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";ctx.font="900 34px system-ui";ctx.textAlign="center";ctx.fillText("PAUSED",W/2,H/2);}
  if(flashLife>0){ctx.globalAlpha=Math.min(1,flashLife*2);ctx.fillStyle="#fff";ctx.font="900 24px system-ui";ctx.textAlign="center";ctx.fillText(flashText,W/2,H-120);ctx.globalAlpha=1;}
}
function roundRect(c,x,y,w,h,r,fill){c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else{c.rect(x,y,w,h)}if(fill)c.fill();else c.stroke();}

function loop(now){
  const dt=Math.min(.025,(now-last)/1000);last=now;
  update(dt);draw();requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

})();
