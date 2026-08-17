(()=>{
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const W=canvas.width,H=canvas.height,isTouch=("ontouchstart" in window)||navigator.maxTouchPoints>0;
const TOP_SAFE=isTouch?145:52;
const BRICK_TOP=isTouch?175:82;
const PADDLE_Y=isTouch?H-122:H-54;
const MAX_HP=20;
const AUTO_COLLECT_SECONDS=6;
const BASE_HIT_INVULN=.4;
const $=id=>document.getElementById(id);
const ui={
  level:$("level"),wave:$("wave"),score:$("score"),time:$("time"),
  xpfill:$("xpfill"),hp:$("hp"),hpHud:$("hpHud"),shieldHud:$("shieldHud"),
  barrierSide:$("barrierSide"),ballCount:$("ballCount"),damage:$("damage"),
  pierce:$("pierce"),xpmul:$("xpmul"),build:$("build"),start:$("start"),
  mobilePause:$("mobilePause"),levelup:$("levelup"),choices:$("choices"),
  gameover:$("gameover"),result:$("result")
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>Math.random()*(b-a)+a;
let keys={},mouseX=W/2,state,last=performance.now(),flashText="",flashLife=0;

function flash(t){flashText=t;flashLife=.9}
function barrierRechargeTime(level){return Math.max(4,12-(level-1)*2)}
function hitInvulnTime(){return BASE_HIT_INVULN+state.adrenalineLevel*.25}

const upgrades=window.createRogueUpgrades(MAX_HP);
const enemies=window.createRogueEnemies({W,BRICK_TOP,rand,flash});
const combat=window.createRogueCombat({W,H,TOP_SAFE,MAX_HP,AUTO_COLLECT_SECONDS,clamp,rand,flash});
const renderer=window.createRogueUI({
  canvas,ctx,W,H,TOP_SAFE,BRICK_TOP,isTouch,upgrades,
  getFlash:()=>({text:flashText,life:flashLife})
});

function newState(){
  const s={
    running:false,paused:false,dead:false,elapsed:0,score:0,wave:1,
    level:1,xp:0,nextXp:30,hp:5,maxHp:5,
    barrierLevel:0,barrierActive:false,barrierCooldown:0,
    pierce:0,ballDamage:1,xpMul:1,magnet:75,splitLevel:0,poisonLevel:0,
    shotgunLevel:0,shotgunTimer:0,adrenalineLevel:0,hitInvulnTimer:0,
    ghost:false,ghostBallWidth:210,
    autoCollectTimer:0,fury:false,echo:false,echoTimer:0,
    waveClearTimer:0,guardTimer:0,bossRewardPending:false,
    paddle:{x:W/2-70,y:PADDLE_Y,w:140,h:16,speed:620},
    balls:[],splitShots:[],interceptors:[],bricks:[],orbs:[],items:[],bullets:[],particles:[],owned:{}
  };
  combat.spawnBall(s,W/2,PADDLE_Y-28,rand(-.65,.65),-1);
  enemies.makeWave(s);
  return s;
}

function updateUI(){renderer.updateUI(state,ui)}

function reset(){
  state=newState();
  updateUI();
  ui.gameover.classList.add("hidden");
  ui.levelup.classList.add("hidden");
}
reset();

function begin(){
  if(!state||state.dead)reset();
  state.running=true;state.paused=false;
  ui.start.classList.add("hidden");
}

function bindTap(el,fn){
  let lastTouch=0;
  const a=e=>{
    if(e?.cancelable)e.preventDefault();
    e?.stopPropagation();
    const now=performance.now();
    if(e?.type==="click"&&now-lastTouch<400)return;
    if(e?.type==="touchend")lastTouch=now;
    fn();
  };
  el.addEventListener("touchend",a,{passive:false});
  el.addEventListener("click",a,{passive:false});
}

bindTap($("startBtn"),begin);
bindTap($("retryBtn"),()=>{reset();begin()});
if(isTouch){
  ui.mobilePause.style.display="block";
  bindTap(ui.mobilePause,()=>{
    if(!state.running)begin();
    else if(ui.levelup.classList.contains("hidden"))state.paused=!state.paused;
  });
}

window.addEventListener("keydown",e=>{
  keys[e.key.toLowerCase()]=true;
  if(e.code==="Space"){
    e.preventDefault();
    if(!state.running)begin();
    else if(ui.levelup.classList.contains("hidden"))state.paused=!state.paused;
  }
});
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

function clientToX(clientX){
  const r=canvas.getBoundingClientRect();
  return clamp((clientX-r.left)*W/r.width,0,W);
}
function mobileControl(e){
  if(!isTouch)return;
  const t=e.target;
  if(t?.closest?.("button,.choice,.overlay"))return;
  if(e.cancelable)e.preventDefault();
  const p=e.touches?.[0]||e;
  mouseX=clientToX(p.clientX);
}
document.addEventListener("touchstart",mobileControl,{passive:false});
document.addEventListener("touchmove",mobileControl,{passive:false});
canvas.addEventListener("mousemove",e=>mouseX=clientToX(e.clientX));
canvas.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("selectstart",e=>{if(isTouch)e.preventDefault()});

function hurt(n=1){
  if(state.guardTimer>0||state.hitInvulnTimer>0){flash("SAFE");return}
  if(state.barrierLevel>0&&state.barrierActive){
    state.barrierActive=false;
    state.barrierCooldown=barrierRechargeTime(state.barrierLevel);
    flash("BARRIER!");
    return;
  }
  state.hp-=n;
  state.hitInvulnTimer=hitInvulnTime();
  flash("-"+n+" HP");
  if(state.hp<=0)endGame();
}

function endGame(){
  state.dead=true;state.running=false;
  ui.result.innerHTML=`到達 <b>WAVE ${state.wave}</b> ／ LV ${state.level}<br>スコア <b>${state.score.toLocaleString()}</b><br>生存時間 ${renderer.fmt(state.elapsed)}`;
  ui.gameover.classList.remove("hidden");
}

function setChoiceHeader(title,text){
  const card=ui.levelup.querySelector(".card");
  const h=card?.querySelector("h2"),p=card?.querySelector("p");
  if(h)h.textContent=title;
  if(p)p.textContent=text;
}

function presentChoices(choices,title,text){
  if(!choices.length)return false;
  state.running=false;
  setChoiceHeader(title,text);
  ui.choices.innerHTML="";
  choices.forEach(u=>{
    const d=document.createElement("div");
    d.className="choice";
    const current=state.owned[u.id]||0;
    const levelText=u.max===1?"一度限り":`現在 Lv.${current}`;
    d.innerHTML=`<div class="rarity">${u.rarity}</div><h3>${u.name}</h3><p>${u.desc}</p><p>${levelText}</p>`;
    bindTap(d,()=>{
      state.owned[u.id]=current+1;
      u.apply(state);
      state.balls.forEach(b=>b.pierceLeft=state.pierce);
      ui.levelup.classList.add("hidden");
      setChoiceHeader("LEVEL UP","強化を1つ選んでください。");
      state.running=true;
      updateUI();
    });
    ui.choices.appendChild(d);
  });
  ui.levelup.classList.remove("hidden");
  return true;
}

function chooseFromPool(pool,count=3){
  const shuffled=[...pool];
  for(let i=shuffled.length-1;i>0;i--){
    const j=(Math.random()*(i+1))|0;
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  return shuffled.slice(0,Math.min(count,shuffled.length));
}

function levelUp(){
  const pool=upgrades.filter(u=>u.rarity!=="LEGEND"&&(state.owned[u.id]||0)<u.max);
  const choices=chooseFromPool(pool,3);
  if(!presentChoices(choices,"LEVEL UP","強化を1つ選んでください。"))state.running=true;
}

function legendReward(){
  const pool=upgrades.filter(u=>u.rarity==="LEGEND"&&(state.owned[u.id]||0)<u.max);
  const choices=chooseFromPool(pool,3);
  if(presentChoices(choices,"BOSS REWARD","金のハート獲得！ LEGENDを1つ選んでください。"))return;

  const normalPool=upgrades.filter(u=>u.rarity!=="LEGEND"&&(state.owned[u.id]||0)<u.max);
  const normalChoices=chooseFromPool(normalPool,3);
  if(!presentChoices(normalChoices,"BOSS REWARD","LEGENDを全て取得済み！ 通常強化を1つ選んでください。")){
    flash("UPGRADES COMPLETE!");
    state.running=true;
  }
}

function gainXp(v){
  state.xp+=v*state.xpMul;
  if(state.xp>=state.nextXp){
    state.xp-=state.nextXp;
    state.level++;
    state.nextXp=Math.floor(state.nextXp*1.28+10);
    levelUp();
  }
}

function update(dt){
  if(!state.running||state.paused||state.dead)return;
  state.elapsed+=dt;
  state.guardTimer=Math.max(0,state.guardTimer-dt);
  state.hitInvulnTimer=Math.max(0,state.hitInvulnTimer-dt);
  state.autoCollectTimer=Math.max(0,state.autoCollectTimer-dt);

  if(state.barrierLevel>0&&!state.barrierActive){
    state.barrierCooldown=Math.max(0,state.barrierCooldown-dt);
    if(state.barrierCooldown<=0){
      state.barrierActive=true;
      flash("BARRIER READY");
    }
  }

  combat.updatePoison(state,dt);

  let dir=(keys.arrowright||keys.d?1:0)-(keys.arrowleft||keys.a?1:0);
  if(dir)state.paddle.x+=dir*state.paddle.speed*dt;
  else state.paddle.x+=(mouseX-state.paddle.w/2-state.paddle.x)*Math.min(1,dt*14);
  state.paddle.x=clamp(state.paddle.x,0,W-state.paddle.w);

  if(state.echo){
    state.echoTimer+=dt;
    if(state.echoTimer>=8){
      state.echoTimer=0;
      if(state.balls.length<8)combat.extraBall(state);
    }
  }

  enemies.updateFire(state,dt);
  combat.updateShotgun(state,dt);
  combat.updateBullets(state,dt,()=>hurt());
  combat.updateBalls(state,dt,()=>hurt());
  combat.updateSplitShots(state,dt);
  combat.updateOrbs(state,dt,gainXp);
  combat.updateItems(state,dt);
  combat.updateParticles(state,dt);

  if(state.bossRewardPending){
    state.bossRewardPending=false;
    legendReward();
    updateUI();
    return;
  }

  if(!state.bricks.length){
    state.waveClearTimer+=dt;
    if(state.waveClearTimer>.9){
      state.wave++;
      state.waveClearTimer=0;
      state.score+=500*state.wave;
      enemies.makeWave(state);
    }
  }

  if(flashLife>0)flashLife-=dt;
  updateUI();
}

function loop(now){
  const dt=Math.min(.025,(now-last)/1000);last=now;
  update(dt);
  renderer.draw(state);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();