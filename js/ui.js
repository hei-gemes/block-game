(()=>{
"use strict";

window.createRogueUI=({canvas,ctx,W,H,TOP_SAFE,BRICK_TOP,isTouch,upgrades,getFlash})=>{
  function fmt(s){
    s=Math.floor(s);
    return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
  }

  function barrierText(state){
    if(!state.barrierLevel)return"なし";
    if(state.barrierActive)return`ON Lv.${state.barrierLevel}`;
    return`復活 ${state.barrierCooldown.toFixed(1)}s`;
  }

  function updateUI(state,ui){
    ui.level.textContent="LV "+state.level;
    ui.wave.textContent=state.wave%5===0?`BOSS ${state.wave}`:"WAVE "+state.wave;
    ui.score.textContent="SCORE "+state.score.toLocaleString();
    ui.time.textContent=fmt(state.elapsed);
    ui.xpfill.style.width=state.xp/state.nextXp*100+"%";
    ui.hp.textContent=`${state.hp} / ${state.maxHp}`;
    ui.hpHud.textContent=`♥ ${state.hp} / ${state.maxHp}`;
    ui.shieldHud.textContent=`🛡 ${barrierText(state)}`;
    ui.barrierSide.textContent=barrierText(state);
    ui.ballCount.textContent=state.balls.length;
    ui.damage.textContent=state.ballDamage;
    ui.pierce.textContent=state.pierce;
    ui.xpmul.textContent=state.xpMul.toFixed(2)+"x";
    ui.build.innerHTML=Object.entries(state.owned).map(([id,n])=>{
      const u=upgrades.find(x=>x.id===id);
      if(!u)return"";
      const level=u.max===1?"":` Lv.${n}`;
      return`<div class="chip"><b>${u.name}${level}</b>${u.desc}</div>`;
    }).join("")||`<div class="chip">まだ強化なし</div>`;
  }

  function rr(x,y,w,h,r){
    ctx.beginPath();
    ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h);
  }

  function drawBrickBody(b){
    const palette={
      normal:"#1d4ed8",
      gunner:"#7f1d1d",
      burst:"#9f1239",
      armor:"#334155",
      support:"#0f766e",
      splitter:"#6d28d9",
      bomber:"#b45309",
      mover:"#0369a1",
      splitling:"#8b5cf6",
      boss:"#6b21a8"
    };

    if(b.type==="support"){
      ctx.save();
      ctx.shadowBlur=18;ctx.shadowColor="#2dd4bf";
      ctx.strokeStyle="rgba(45,212,191,.48)";ctx.lineWidth=2;
      rr(b.x-3,b.y-3,b.w+6,b.h+6,9);ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle=palette[b.type]||palette.normal;
    rr(b.x,b.y,b.w,b.h,b.type==="boss"?14:b.type==="splitling"?5:7);ctx.fill();

    const cx=b.x+b.w/2,cy=b.y+b.h/2;
    ctx.save();
    ctx.lineWidth=2;
    ctx.lineCap="round";

    if(b.type==="gunner"){
      ctx.fillStyle="#fecaca";ctx.beginPath();ctx.arc(cx,cy-1,5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#fca5a5";ctx.beginPath();ctx.moveTo(cx,cy+4);ctx.lineTo(cx,cy+10);ctx.stroke();
    }else if(b.type==="burst"){
      ctx.fillStyle="#fecaca";
      [-8,0,8].forEach(dx=>{ctx.beginPath();ctx.arc(cx+dx,cy+1,3.2,0,Math.PI*2);ctx.fill()});
      ctx.strokeStyle="rgba(254,202,202,.75)";
      ctx.beginPath();ctx.moveTo(cx,cy+2);ctx.lineTo(cx-10,cy+9);ctx.moveTo(cx,cy+2);ctx.lineTo(cx+10,cy+9);ctx.stroke();
    }else if(b.type==="armor"){
      ctx.fillStyle="#94a3b8";ctx.fillRect(b.x+3,b.y+b.h-8,b.w-6,6);
      ctx.strokeStyle="#cbd5e1";
      for(let x=b.x+9;x<b.x+b.w-5;x+=13){ctx.beginPath();ctx.moveTo(x,b.y+b.h-8);ctx.lineTo(x-5,b.y+b.h-2);ctx.stroke()}
    }else if(b.type==="support"){
      ctx.strokeStyle="#99f6e4";ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(cx-8,cy);ctx.lineTo(cx+8,cy);ctx.moveTo(cx,cy-8);ctx.lineTo(cx,cy+8);ctx.stroke();
    }else if(b.type==="splitter"){
      ctx.strokeStyle="#ddd6fe";ctx.beginPath();ctx.moveTo(cx,cy-9);ctx.lineTo(cx-3,cy-2);ctx.lineTo(cx+3,cy+3);ctx.lineTo(cx,cy+10);ctx.stroke();
      ctx.fillStyle="#ddd6fe";ctx.beginPath();ctx.arc(cx-11,cy,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+11,cy,3,0,Math.PI*2);ctx.fill();
    }else if(b.type==="bomber"){
      ctx.strokeStyle="#fde68a";ctx.beginPath();ctx.arc(cx,cy+2,7,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx+4,cy-5);ctx.lineTo(cx+9,cy-9);ctx.lineTo(cx+13,cy-7);ctx.stroke();
    }else if(b.type==="mover"){
      ctx.fillStyle="#bae6fd";
      ctx.beginPath();ctx.moveTo(cx-18,cy);ctx.lineTo(cx-10,cy-6);ctx.lineTo(cx-10,cy+6);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(cx+18,cy);ctx.lineTo(cx+10,cy-6);ctx.lineTo(cx+10,cy+6);ctx.closePath();ctx.fill();
      ctx.strokeStyle="#e0f2fe";ctx.beginPath();ctx.moveTo(cx-7,cy);ctx.lineTo(cx+7,cy);ctx.stroke();
    }else if(b.type==="splitling"){
      ctx.strokeStyle="#ede9fe";ctx.beginPath();ctx.moveTo(cx-5,cy-4);ctx.lineTo(cx+5,cy+4);ctx.moveTo(cx+5,cy-4);ctx.lineTo(cx-5,cy+4);ctx.stroke();
    }else if(b.type==="normal"){
      ctx.fillStyle="rgba(191,219,254,.7)";ctx.fillRect(b.x+b.w*.28,cy-2,b.w*.44,4);
    }else if(b.type==="boss"){
      ctx.fillStyle="#f5d0fe";ctx.font="900 18px system-ui";ctx.textAlign="center";
      ctx.fillText("BOSS",cx,cy+6);
    }
    ctx.restore();
  }

  function draw(state){
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
      drawBrickBody(b);
      if(b.poisonTimer>0){
        ctx.strokeStyle="#4ade80";ctx.lineWidth=2;rr(b.x+1,b.y+1,b.w-2,b.h-2,b.type==="boss"?13:6);ctx.stroke();ctx.lineWidth=1;
      }
      ctx.fillStyle="rgba(255,255,255,.13)";
      ctx.fillRect(b.x+5,b.y+5,Math.max(0,(b.w-10)*Math.max(0,b.hp/b.maxHp)),4);
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
      const aura=q.aura==="boss"?"#c084fc":q.aura==="burst"?"#fb923c":q.aura==="buffed"?"#facc15":"#ef4444";
      ctx.shadowBlur=q.boss?20:q.aura==="buffed"?18:13;
      ctx.shadowColor=aura;
      ctx.fillStyle="#ff4d5e";
      ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#fecdd3";ctx.beginPath();ctx.arc(q.x-q.r*.18,q.y-q.r*.18,Math.max(1.5,q.r*.32),0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
    }

    for(const q of state.splitShots){
      ctx.shadowBlur=14;ctx.shadowColor="#facc15";ctx.fillStyle="#fde047";
      ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }

    for(const q of state.interceptors){
      ctx.shadowBlur=12;ctx.shadowColor="#67e8f9";ctx.fillStyle="#cffafe";
      ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }

    const p=state.paddle;
    const invulnerable=state.hitInvulnTimer>0;
    const barrier=state.barrierLevel>0&&state.barrierActive;

    if(state.ghost){
      const gw=state.ghostBallWidth||170,gx=p.x+p.w/2-gw/2;
      ctx.save();
      ctx.globalAlpha=.24;
      ctx.shadowBlur=16;ctx.shadowColor="#67e8f9";ctx.fillStyle="#67e8f9";
      rr(gx,p.y,gw,p.h,8);ctx.fill();
      ctx.globalAlpha=.58;ctx.strokeStyle="#a5f3fc";ctx.lineWidth=1.5;
      rr(gx,p.y,gw,p.h,8);ctx.stroke();
      ctx.restore();ctx.lineWidth=1;ctx.shadowBlur=0;
    }

    ctx.shadowBlur=invulnerable?30:barrier?24:18;
    ctx.shadowColor=invulnerable?"#67e8f9":barrier?"#60a5fa":"#a78bfa";
    ctx.fillStyle=invulnerable?"#a5f3fc":barrier?"#bfdbfe":"#c4b5fd";
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

    const f=getFlash();
    if(f.life>0){
      ctx.globalAlpha=Math.min(1,f.life*2);ctx.fillStyle="#fff";ctx.font="900 24px system-ui";ctx.textAlign="center";
      ctx.fillText(f.text,W/2,state.paddle.y-34);ctx.globalAlpha=1;
    }
  }

  return{fmt,barrierText,updateUI,draw};
};
})();