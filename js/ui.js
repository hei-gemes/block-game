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
      return u?`<div class="chip"><b>${u.name} Lv.${n}</b>${u.desc}</div>`:"";
    }).join("")||`<div class="chip">まだ強化なし</div>`;
  }

  function rr(x,y,w,h,r){
    ctx.beginPath();
    ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h);
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

    const f=getFlash();
    if(f.life>0){
      ctx.globalAlpha=Math.min(1,f.life*2);ctx.fillStyle="#fff";ctx.font="900 24px system-ui";ctx.textAlign="center";
      ctx.fillText(f.text,W/2,state.paddle.y-34);ctx.globalAlpha=1;
    }
  }

  return{fmt,barrierText,updateUI,draw};
};
})();