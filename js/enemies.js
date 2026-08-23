(()=>{
"use strict";

window.createRogueEnemies=({W,BRICK_TOP,rand,flash})=>{
  const FORMATIONS=["full","stagger","diamond","lanes","fortress"];

  function makeBossWave(state){
    const w=460,h=62,x=(W-w)/2,y=BRICK_TOP+34;
    const hp=35+state.wave*5;
    state.bricks.push({x,y,w,h,hp,maxHp:hp,type:"boss",shot:1.8,poisonTimer:0,poisonTick:1});
    flash("BOSS WAVE!");
  }

  function formationAllows(name,r,c,rows,cols){
    const mid=(cols-1)/2;
    if(name==="stagger")return (r+c)%2===0||r===0;
    if(name==="diamond")return Math.abs(c-mid)<=Math.max(1,Math.floor(rows/2)-Math.abs(r-(rows-1)/2)+1);
    if(name==="lanes")return c%3!==1||r%2===0;
    if(name==="fortress")return r===0||r===rows-1||c===0||c===cols-1||Math.abs(c-mid)<=1;
    return true;
  }

  function typePool(wave){
    const pool=[
      ["normal",42],
      ["gunner",30]
    ];
    if(wave>=2)pool.push(["armor",7],["mover",5]);
    if(wave>=3)pool.push(["bomber",5],["splitter",4]);
    if(wave>=4)pool.push(["burst",5],["support",4]);
    return pool;
  }

  function pickType(wave){
    const pool=typePool(wave),total=pool.reduce((s,[,w])=>s+w,0);
    let roll=Math.random()*total;
    for(const [type,weight] of pool){
      roll-=weight;
      if(roll<=0)return type;
    }
    return "normal";
  }

  function hpFor(type,base){
    if(type==="armor")return base+2;
    if(["gunner","burst","support","splitter","bomber"].includes(type))return base+1;
    return base;
  }

  function makeBrick(type,x,y,w,h,state){
    const base=1+Math.floor((state.wave-1)/4);
    const hp=hpFor(type,base);
    const brick={
      x,y,w,h,hp,maxHp:hp,type,shot:rand(1.6,3.2),poisonTimer:0,poisonTick:1
    };
    if(type==="gunner")brick.shot=rand(1.4,2.7);
    if(type==="burst")brick.shot=rand(2.7,4.1);
    if(type==="mover"){
      brick.homeX=x;
      brick.movePhase=rand(0,Math.PI*2);
      brick.moveSpeed=rand(.75,1.15);
      brick.moveAmp=Math.min(26,w*.38);
    }
    return brick;
  }

  function ensureShooters(state,minCount){
    const shooters=state.bricks.filter(b=>b.type==="gunner"||b.type==="burst").length;
    let need=Math.max(0,minCount-shooters);
    if(!need)return;
    const candidates=state.bricks.filter(b=>b.type!=="gunner"&&b.type!=="burst"&&b.type!=="boss");
    for(let i=candidates.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0;
      [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
    }
    for(const br of candidates){
      if(need<=0)break;
      br.type="gunner";
      br.hp=br.maxHp=Math.max(br.maxHp,1+Math.floor((state.wave-1)/4)+1);
      br.shot=rand(1.4,2.7);
      need--;
    }
  }

  function makeWave(state){
    state.bricks=[];
    state.splitShots=[];
    if(state.wave%5===0){makeBossWave(state);return}

    const rows=state.wave<6?4:5,cols=9,gap=7,margin=40;
    const bw=(W-margin*2-gap*(cols-1))/cols,bh=28;
    const formation=FORMATIONS[(Math.random()*FORMATIONS.length)|0];

    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      if(!formationAllows(formation,r,c,rows,cols))continue;
      if(Math.random()<(formation==="full"?.10:.05))continue;
      const x=margin+c*(bw+gap),y=BRICK_TOP+r*(bh+gap);
      state.bricks.push(makeBrick(pickType(state.wave),x,y,bw,bh,state));
    }

    const minShooters=Math.max(3,Math.floor(state.bricks.length*.24));
    ensureShooters(state,minShooters);
  }

  function nearbySupports(state,br){
    let count=0;
    const cx=br.x+br.w/2,cy=br.y+br.h/2;
    for(const s of state.bricks){
      if(s===br||s.type!=="support")continue;
      const sx=s.x+s.w/2,sy=s.y+s.h/2;
      if(Math.hypot(cx-sx,cy-sy)<=145)count++;
    }
    return Math.min(2,count);
  }

  function fireGunner(state,br,buffed){
    state.bullets.push({
      x:br.x+br.w/2,y:br.y+br.h,vx:rand(-30,30),vy:125+state.wave*4,r:5,
      kind:"gunner",aura:buffed?"buffed":"red"
    });
  }

  function fireBurst(state,br,buffed){
    const cx=br.x+br.w/2,by=br.y+br.h;
    [-58,0,58].forEach(vx=>state.bullets.push({
      x:cx,y:by,vx,vy:118+state.wave*3,r:5,
      kind:"burst",aura:buffed?"buffed":"burst"
    }));
  }

  function updateMovers(state,dt){
    for(const br of state.bricks){
      if(br.type!=="mover")continue;
      br.movePhase+=dt*br.moveSpeed;
      const target=br.homeX+Math.sin(br.movePhase)*br.moveAmp;
      br.x=Math.max(26,Math.min(W-br.w-26,target));
    }
  }

  function updateFire(state,dt){
    updateMovers(state,dt);
    for(const br of state.bricks){
      if(br.type==="gunner"||br.type==="burst"){
        br.shot-=dt;
        if(br.shot<=0){
          const supportCount=nearbySupports(state,br);
          const buffed=supportCount>0;
          const waveFactor=Math.max(.72,1-state.wave*.010);
          const supportFactor=Math.pow(.78,supportCount);
          if(br.type==="gunner"){
            br.shot=rand(2.1,3.7)*waveFactor*supportFactor;
            fireGunner(state,br,buffed);
          }else{
            br.shot=rand(3.2,4.8)*waveFactor*supportFactor;
            fireBurst(state,br,buffed);
          }
        }
      }else if(br.type==="boss"){
        br.shot-=dt;
        if(br.shot<=0){
          br.shot=rand(1.8,2.5);
          const cx=br.x+br.w/2,by=br.y+br.h;
          [-75,0,75].forEach(vx=>state.bullets.push({
            x:cx,y:by,vx,vy:135+state.wave*2,r:6,boss:true,kind:"boss",aura:"boss"
          }));
        }
      }
    }
  }

  return{makeWave,makeBossWave,updateFire};
};
})();