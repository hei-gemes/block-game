(()=>{
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const W=canvas.width,H=canvas.height,isTouch=("ontouchstart" in window)||navigator.maxTouchPoints>0;
const TOP_SAFE=isTouch?145:52;
const BRICK_TOP=isTouch?175:82;
const PADDLE_Y=isTouch?H-122:H-54;
const MAX_HP=20;
const AUTO_COLLECT_SECONDS=6;
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
const pick=a=>a[(Math.random()*a.length)|0];
let keys={},mouseX=W/2,state,last=performance.now(),flashText="",flashLife=0;

function barrierRechargeTime(level){return Math.max(4,12-(level-1)*2)}
const upgrades=window.createRogueUpgrades(MAX_HP);

function newState(){
  const s={
    running:false,paused:false,dead:false,elapsed:0,score:0,wave:1,
    level:1,xp:0,nextXp:30,hp:5,maxHp:5,
    barrierLevel:0,barrierActive:false,barrierCooldown:0,
    pierce:0,ballDamage:1,xpMul:1,magnet:75,splitLevel:0,poisonLevel:0,
    autoCollectTimer:0,fury:false,echo:false,echoTimer:0,
    waveClearTimer:0,guardTimer:0,bossRewardPending:false,
    paddle:{x:W/2-70,y:PADDLE_Y,w:140,h:16,speed:620},
    balls:[],splitShots:[],bricks:[],orbs:[],items:[],bullets:[],particles:[],owned:{}
  };
  spawnBall(s,W/2,PADDLE_Y-28,rand(-.65,.65),-1);
  makeWave(s);
  return s;
}
function spawnBall(s,x,y,dx,dy){
  const len=Math.hypot(dx,dy)||1;
  s.balls.push({x,y,r:7,vx:dx/len*330,vy:dy/len*330,pierceLeft:s.pierce,trail:[],lastBrick:null});
}
function extraBall(s){
  const b=s.balls[0];
  b?spawnBall(s,b.x,b.y,rand(-1,1),-1):spawnBall(s,W/2,s.paddle.y-28,rand(-1,1),-1);
}
function makeWave(s){
  s.bricks=[];
  s.splitShots=[];
  if(s.wave%5===0){makeBossWave(s);return}
  const rows=Math.min(7,4+Math.floor(s.wave/2)),cols=9,gap=7,margin=40;
  const bw=(W-margin*2-gap*(cols-1))/cols,bh=28;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    if(Math.random()<.08)continue;
    const x=margin+c*(bw+gap),y=BRICK_TOP+r*(bh+gap),roll=Math.random();
    let type="normal";
    if(roll<Math.min(.10+s.wave*.012,.28))type="enemy";
    else if(roll<Math.min(.27+s.wave*.018,.55))type="tank";
    const base=1+Math.floor((s.wave-1)/3);
    const hp=type==="tank"?base+2:type==="enemy"?base+1:base;
    s.bricks.push({x,y,w:bw,h:bh,hp,maxHp:hp,type,shot:rand(1.5,3.4),poisonTimer:0,poisonTick:1});
  }
}
function makeBossWave(s){
  const w=460,h=62,x=(W-w)/2,y=BRICK_TOP+34;
  const hp=35+s.wave*5;
  s.bricks.push({x,y,w,h,hp,maxHp:hp,type:"boss",shot:1.8,poisonTimer:0,poisonTick:1});
  flash("BOSS WAVE!");
}
function dropOrb(s,x,y,value){s.orbs.push({x,y,r:6,vy:85,value})}
function dropHeal(s,x,y){s.items.push({type:"heal",x,y,r:10,vy:72,spin:0})}
function dropAutoCollect(s,x,y){s.items.push({type:"collect",x,y,r:11,vy:72,spin:0})}
function particles(x,y,n=5){
  for(let i=0;i<n;i++)state.particles.push({x,y,vx:rand(-90,90),vy:rand(-100,50),life:rand(.25,.6),max:.6});
}
function flash(t){flashText=t;flashLife=.9}
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
  if(state.guardTimer>0){flash("SAFE");return}
  if(state.barrierLevel>0&&state.barrierActive){
    state.barrierActive=false;
    state.barrierCooldown=barrierRechargeTime(state.barrierLevel);
    flash("BARRIER!");
    return;
  }
  state.hp-=n;
  flash("-"+n+" HP");
  if(state.hp<=0)endGame();
}
function endGame(){
  state.dead=true;state.running=false;
  ui.result.innerHTML=`到達 <b>WAVE ${state.wave}</b> ／ LV ${state.level}<br>スコア <b>${state.score.toLocaleString()}</b><br>生存時間 ${fmt(state.elapsed)}`;
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
    d.innerHTML=`<div class="rarity">${u.rarity}</div><h3>${u.name}</h3><p>${u.desc}</p><p>現在 Lv.${state.owned[u.id]||0}</p>`;
    bindTap(d,()=>{
      state.owned[u.id]=(state.owned[u.id]||0)+1;
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
function circleRect(c,r){
  const x=clamp(c.x,r.x,r.x+r.w),y=clamp(c.y,r.y,r.y+r.h);
  return(c.x-x)**2+(c.y-y)**2<c.r**2;
}
function applyPoison(br){
  if(state.poisonLevel<=0)return;
  if(br.poisonTimer<=0)br.poisonTick=1;
  br.poisonTimer=3;
}
function damageBrick(br,amount,x,y,withPoison=true){
  const idx=state.bricks.indexOf(br);
  if(idx<0)return false;
  br.hp-=amount;
  if(withPoison)applyPoison(br);
  particles(x??br.x+br.w/2,y??br.y+br.h/2,4);
  if(br.hp<=0){
    onBrickDestroyed(br);
    state.bricks.splice(idx,1);
    return true;
  }
  return false;
}
function bounceOffBrick(b,br){
  const left=(b.x+b.r)-br.x;
  const right=(br.x+br.w)-(b.x-b.r);
  const top=(b.y+b.r)-br.y;
  const bottom=(br.y+br.h)-(b.y-b.r);
  const m=Math.min(left,right,top,bottom);
  if(m===left){b.x=br.x-b.r-1;b.vx=-Math.abs(b.vx)}
  else if(m===right){b.x=br.x+br.w+b.r+1;b.vx=Math.abs(b.vx)}
  else if(m===top){b.y=br.y-b.r-1;b.vy=-Math.abs(b.vy)}
  else{b.y=br.y+br.h+b.r+1;b.vy=Math.abs(b.vy)}
}
function spawnSplitBurst(s,b){
  if(s.splitLevel<=0||!s.bricks.length)return;
  for(let i=0;i<5;i++){
    const target=s.bricks[(Math.random()*s.bricks.length)|0];
    const tx=target.x+target.w/2,ty=target.y+target.h/2;
    const angle=Math.atan2(ty-b.y,tx-b.x)+rand(-.10,.10),speed=470;
    s.splitShots.push({x:b.x,y:b.y,r:4,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,hitsLeft:s.splitLevel,lastBrick:null,life:2.4});
  }
  if(s.splitShots.length>80)s.splitShots.splice(0,s.splitShots.length-80);
}
function onBrickDestroyed(br){
  if(br.type==="boss"){
    state.score+=2000;
    dropOrb(state,br.x+br.w/2,br.y+br.h/2,28);
    if(state.maxHp<MAX_HP){
      state.maxHp++;
      state.hp=Math.min(state.maxHp,state.hp+1);
      flash("BOSS DOWN! GOLD HEART +1");
    }else{
      state.hp=Math.min(state.maxHp,state.hp+2);
      flash("BOSS DOWN! HP MAX");
    }
    state.bossRewardPending=true;
    return;
  }
  state.score+=br.type==="enemy"?180:br.type==="tank"?120:75;
  dropOrb(state,br.x+br.w/2,br.y+br.h/2,br.type==="enemy"?8:br.type==="tank"?6:4);
  if(Math.random()<.055)dropHeal(state,br.x+br.w/2,br.y+br.h/2);
  if(Math.random()<.035)dropAutoCollect(state,br.x+br.w/2,br.y+br.h/2);
}

function update(dt){
  if(!state.running||state.paused||state.dead)return;
  state.elapsed+=dt;
  state.guardTimer=Math.max(0,state.guardTimer-dt);
  state.autoCollectTimer=Math.max(0,state.autoCollectTimer-dt);

  if(state.barrierLevel>0&&!state.barrierActive){
    state.barrierCooldown=Math.max(0,state.barrierCooldown-dt);
    if(state.barrierCooldown<=0){
      state.barrierActive=true;
      flash("BARRIER READY");
    }
  }

  for(let i=state.bricks.length-1;i>=0;i--){
    const br=state.bricks[i];
    if(br.poisonTimer>0&&state.poisonLevel>0){
      br.poisonTimer=Math.max(0,br.poisonTimer-dt);
      br.poisonTick-=dt;
      if(br.poisonTick<=0){
        br.poisonTick+=1;
        br.hp-=state.poisonLevel;
        particles(br.x+br.w/2,br.y+br.h/2,3);
        if(br.hp<=0){
          onBrickDestroyed(br);
          state.bricks.splice(i,1);
        }
      }
    }
  }

  let dir=(keys.arrowright||keys.d?1:0)-(keys.arrowleft||keys.a?1:0);
  if(dir)state.paddle.x+=dir*state.paddle.speed*dt;
  else state.paddle.x+=(mouseX-state.paddle.w/2-state.paddle.x)*Math.min(1,dt*14);
  state.paddle.x=clamp(state.paddle.x,0,W-state.paddle.w);

  if(state.echo){
    state.echoTimer+=dt;
    if(state.echoTimer>=8){
      state.echoTimer=0;
      if(state.balls.length<8)extraBall(state);
    }
  }

  for(const br of state.bricks){
    if(br.type==="enemy"){
      br.shot-=dt;
      if(br.shot<=0){
        br.shot=rand(2.1,3.8)*Math.max(.7,1-state.wave*.012);
        state.bullets.push({x:br.x+br.w/2,y:br.y+br.h,vx:rand(-30,30),vy:125+state.wave*4,r:5});
      }
    }else if(br.type==="boss"){
      br.shot-=dt;
      if(br.shot<=0){
        br.shot=rand(1.8,2.5);
        const cx=br.x+br.w/2,by=br.y+br.h;
        [-75,0,75].forEach(vx=>state.bullets.push({x:cx,y:by,vx,vy:135+state.wave*2,r:6,boss:true}));
      }
    }
  }

  for(let i=state.bullets.length-1;i>=0;i--){
    const q=state.bullets[i];
    q.x+=q.vx*dt;q.y+=q.vy*dt;
    let dead=false;
    for(const b of state.balls){
      const rr=q.r+b.r;
      if((q.x-b.x)**2+(q.y-b.y)**2<rr*rr){
        state.bullets.splice(i,1);
        particles(q.x,q.y,5);
        state.score+=15;
        dead=true;
        break;
      }
    }
    if(dead)continue;
    if(circleRect(q,state.paddle)){
      state.bullets.splice(i,1);
      hurt();
      continue;
    }
    if(q.y>H+20||q.x<-30||q.x>W+30)state.bullets.splice(i,1);
  }

  const fury=state.fury&&state.hp<=state.maxHp/2;
  const targetBase=330*(fury?1.18:1);
  const dmg=state.ballDamage+(fury?1:0);

  for(let i=state.balls.length-1;i>=0;i--){
    const b=state.balls[i];
    b.trail.push({x:b.x,y:b.y});
    if(b.trail.length>7)b.trail.shift();
    const cur=Math.hypot(b.vx,b.vy)||1;
    b.vx=b.vx/cur*targetBase;b.vy=b.vy/cur*targetBase;
    b.x+=b.vx*dt;b.y+=b.vy*dt;

    if(b.lastBrick&&!circleRect(b,b.lastBrick))b.lastBrick=null;
    let wallHit=false;
    if(b.x-b.r<0){b.x=b.r;b.vx=Math.abs(b.vx);wallHit=true}
    if(b.x+b.r>W){b.x=W-b.r;b.vx=-Math.abs(b.vx);wallHit=true}
    if(b.y-b.r<TOP_SAFE){b.y=TOP_SAFE+b.r;b.vy=Math.abs(b.vy);wallHit=true}
    if(wallHit)spawnSplitBurst(state,b);

    if(b.vy>0&&circleRect(b,state.paddle)){
      b.y=state.paddle.y-b.r-1;
      const hit=(b.x-(state.paddle.x+state.paddle.w/2))/(state.paddle.w/2),ang=hit*1.05;
      b.vx=Math.sin(ang)*targetBase;b.vy=-Math.cos(ang)*targetBase;
      b.pierceLeft=state.pierce;
      state.guardTimer=.65;
    }

    let hit=-1;
    for(let j=0;j<state.bricks.length;j++){
      const br=state.bricks[j];
      if(br!==b.lastBrick&&circleRect(b,br)){hit=j;break}
    }
    if(hit>=0){
      const br=state.bricks[hit];
      b.lastBrick=br;
      damageBrick(br,dmg,b.x,b.y,true);
      if(b.pierceLeft>0)b.pierceLeft--;
      else bounceOffBrick(b,br);
    }

    if(b.y-b.r>H){
      state.balls.splice(i,1);
      if(!state.balls.length){
        hurt();
        if(!state.dead)spawnBall(state,state.paddle.x+state.paddle.w/2,state.paddle.y-18,rand(-.65,.65),-1);
      }
    }
  }

  for(let i=state.splitShots.length-1;i>=0;i--){
    const q=state.splitShots[i];
    q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;
    if(q.lastBrick&&!circleRect(q,q.lastBrick))q.lastBrick=null;
    let hit=-1;
    for(let j=0;j<state.bricks.length;j++){
      const br=state.bricks[j];
      if(br!==q.lastBrick&&circleRect(q,br)){hit=j;break}
    }
    if(hit>=0){
      const br=state.bricks[hit];
      q.lastBrick=br;
      damageBrick(br,dmg,q.x,q.y,true);
      q.hitsLeft--;
      if(q.hitsLeft<=0){state.splitShots.splice(i,1);continue}
    }
    if(q.life<=0||q.y<-30||q.y>H+30||q.x<-30||q.x>W+30)state.splitShots.splice(i,1);
  }

  for(let i=state.orbs.length-1;i>=0;i--){
    const o=state.orbs[i],px=state.paddle.x+state.paddle.w/2,py=state.paddle.y,d=Math.hypot(px-o.x,py-o.y);
    const auto=state.autoCollectTimer>0;
    if(d<state.magnet||auto){
      const speed=auto?240:260;
      o.x+=(px-o.x)/Math.max(d,1)*speed*dt;
      o.y+=(py-o.y)/Math.max(d,1)*speed*dt;
    }else o.y+=o.vy*dt;
    if(circleRect(o,state.paddle)){
      gainXp(o.value);
      state.orbs.splice(i,1);
      continue;
    }
    if(o.y>H+30)state.orbs.splice(i,1);
  }

  for(let i=state.items.length-1;i>=0;i--){
    const it=state.items[i];
    it.y+=it.vy*dt;it.spin+=dt*4;
    if(circleRect(it,state.paddle)){
      if(it.type==="heal"){
        if(state.hp<state.maxHp){
          state.hp++;
          flash("+1 HP");
        }else{
          state.score+=100;
          flash("FULL HP +100");
        }
      }else if(it.type==="collect"){
        state.autoCollectTimer=Math.max(state.autoCollectTimer,AUTO_COLLECT_SECONDS);
        flash(`AUTO COLLECT ${AUTO_COLLECT_SECONDS}s`);
      }
      state.items.splice(i,1);
      continue;
    }
    if(it.y>H+30)state.items.splice(i,1);
  }

  for(let i=state.particles.length-1;i>=0;i--){
    const p=state.particles[i];
    p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;
    if(p.life<=0)state.particles.splice(i,1);
  }

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
      makeWave(state);
    }
  }

  if(flashLife>0)flashLife-=dt;
  updateUI();
}

function fmt(s){
  s=Math.floor(s);
  return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
}
function barrierText(){
  if(!state.barrierLevel)return"なし";
  if(state.barrierActive)return`ON Lv.${state.barrierLevel}`;
  return`復活 ${state.barrierCooldown.toFixed(1)}s`;
}
function updateUI(){
  ui.level.textContent="LV "+state.level;
  ui.wave.textContent=state.wave%5===0?`BOSS ${state.wave}`:"WAVE "+state.wave;
  ui.score.textContent="SCORE "+state.score.toLocaleString();
  ui.time.textContent=fmt(state.elapsed);
  ui.xpfill.style.width=state.xp/state.nextXp*100+"%";
  ui.hp.textContent=`${state.hp} / ${state.maxHp}`;
  ui.hpHud.textContent=`♥ ${state.hp} / ${state.maxHp}`;
  ui.shieldHud.textContent=`🛡 ${barrierText()}`;
  ui.barrierSide.textContent=barrierText();
  ui.ballCount.textContent=state.balls.length;
  ui.damage.textContent=state.ballDamage;
  ui.pierce.textContent=state.pierce;
  ui.xpmul.textContent=state.xpMul.toFixed(2)+"x";
  ui.build.innerHTML=Object.entries(state.owned).map(([id,n])=>{
    const u=upgrades.find(x=>x.id===id);
    return u?`<div class="chip"><b>${u.name} Lv.${n}</b>${u.desc}</div>`:"";
  }).join("")||`<div class="chip">まだ強化なし</div>`;
}
function rr(x,y,w,h,r){
  ctx.beginPath();
  ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h);
}
function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#050810";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(100,140,190,.055)";
  for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}

  if(isTouch){
    ctx.fillStyle="rgba(125,211,252,.03)";ctx.fillRect(0,H-96,W,96);
    ctx.strokeStyle="rgba(125,211,252,.12)";ctx.beginPath();ctx.moveTo(0,H-96);ctx.lineTo(W,H-96);ctx.stroke();
    ctx.fillStyle="rgba(180,200,230,.4)";ctx.font="14px system-ui";ctx.textAlign="center";
    ctx.fillText("画面下部を左右にスライド",W/2,H-42);
  }

  const boss=state.bricks.find(b=>b.type==="boss");
  if(boss){
    ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(110,BRICK_TOP-18,W-220,7);
    ctx.fillStyle="#c084fc";ctx.fillRect(110,BRICK_TOP-18,(W-220)*Math.max(0,boss.hp/boss.maxHp),7);
  }

  for(const b of state.bricks){
    ctx.fillStyle=b.type==="boss"?"#6b21a8":b.type==="enemy"?"#7f1d1d":b.type==="tank"?"#334155":"#1d4ed8";
    rr(b.x,b.y,b.w,b.h,b.type==="boss"?14:7);ctx.fill();
    if(b.poisonTimer>0){
      ctx.strokeStyle="#4ade80";ctx.lineWidth=2;rr(b.x+1,b.y+1,b.w-2,b.h-2,b.type==="boss"?13:6);ctx.stroke();ctx.lineWidth=1;
    }
    ctx.fillStyle="rgba(255,255,255,.13)";
    ctx.fillRect(b.x+5,b.y+5,(b.w-10)*Math.max(0,b.hp/b.maxHp),4);
    if(b.type==="enemy"){
      ctx.fillStyle="#fecaca";ctx.beginPath();ctx.arc(b.x+b.w/2,b.y+b.h/2,5,0,Math.PI*2);ctx.fill();
    }else if(b.type==="boss"){
      ctx.fillStyle="#f5d0fe";ctx.font="900 18px system-ui";ctx.textAlign="center";
      ctx.fillText("BOSS",b.x+b.w/2,b.y+b.h/2+6);
    }
  }

  for(const o of state.orbs){
    ctx.shadowBlur=16;ctx.shadowColor="#38bdf8";ctx.fillStyle="#7dd3fc";
    ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }

  for(const it of state.items){
    ctx.save();ctx.translate(it.x,it.y);ctx.rotate(Math.sin(it.spin)*.12);
    if(it.type==="heal"){
      ctx.shadowBlur=18;ctx.shadowColor="#4ade80";ctx.fillStyle="#86efac";
      ctx.font="900 24px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("♥",0,1);
    }else if(it.type==="collect"){
      ctx.shadowBlur=18;ctx.shadowColor="#38bdf8";ctx.fillStyle="#7dd3fc";
      ctx.font="900 25px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("✦",0,1);
    }
    ctx.restore();ctx.shadowBlur=0;
  }

  for(const q of state.bullets){
    ctx.shadowBlur=q.boss?18:12;ctx.shadowColor=q.boss?"#f0abfc":"#ef4444";ctx.fillStyle=q.boss?"#e879f9":"#fb7185";
    ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }

  for(const q of state.splitShots){
    ctx.shadowBlur=14;ctx.shadowColor="#facc15";ctx.fillStyle="#fde047";
    ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }

  const p=state.paddle;
  const guard=state.guardTimer>0;
  const barrier=state.barrierLevel>0&&state.barrierActive;
  ctx.shadowBlur=guard?30:barrier?24:18;
  ctx.shadowColor=guard?"#67e8f9":barrier?"#60a5fa":"#a78bfa";
  ctx.fillStyle=guard?"#a5f3fc":barrier?"#bfdbfe":"#c4b5fd";
  rr(p.x,p.y,p.w,p.h,8);ctx.fill();ctx.shadowBlur=0;
  if(barrier){
    ctx.strokeStyle="rgba(96,165,250,.7)";ctx.lineWidth=2;
    rr(p.x-8,p.y-8,p.w+16,p.h+16,12);ctx.stroke();ctx.lineWidth=1;
  }

  for(const b of state.balls){
    b.trail.forEach((t,i)=>{
      ctx.globalAlpha=(i+1)/b.trail.length*.16;ctx.fillStyle="#fff";
      ctx.beginPath();ctx.arc(t.x,t.y,b.r*(i+1)/b.trail.length,0,Math.PI*2);ctx.fill();
    });
    ctx.globalAlpha=1;ctx.shadowBlur=18;ctx.shadowColor="#fff";ctx.fillStyle="#fff";
    ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }

  for(const p of state.particles){
    ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle="#fff";ctx.fillRect(p.x,p.y,3,3);
  }
  ctx.globalAlpha=1;

  if(state.autoCollectTimer>0){
    ctx.fillStyle="#7dd3fc";ctx.font="800 14px system-ui";ctx.textAlign="center";
    ctx.fillText(`AUTO COLLECT ${state.autoCollectTimer.toFixed(1)}s`,W/2,TOP_SAFE+20);
  }

  if(state.paused&&state.running){
    ctx.fillStyle="rgba(0,0,0,.45)";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#fff";ctx.font="900 34px system-ui";ctx.textAlign="center";ctx.fillText("PAUSED",W/2,H/2);
  }
  if(flashLife>0){
    ctx.globalAlpha=Math.min(1,flashLife*2);ctx.fillStyle="#fff";ctx.font="900 24px system-ui";ctx.textAlign="center";
    ctx.fillText(flashText,W/2,state.paddle.y-34);ctx.globalAlpha=1;
  }
}
function loop(now){
  const dt=Math.min(.025,(now-last)/1000);last=now;
  update(dt);draw();requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();