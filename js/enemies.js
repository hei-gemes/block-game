(()=>{
"use strict";

window.createRogueEnemies=({W,BRICK_TOP,rand,flash})=>{
  function makeBossWave(state){
    const w=460,h=62,x=(W-w)/2,y=BRICK_TOP+34;
    const hp=35+state.wave*5;
    state.bricks.push({x,y,w,h,hp,maxHp:hp,type:"boss",shot:1.8,poisonTimer:0,poisonTick:1});
    flash("BOSS WAVE!");
  }

  function makeWave(state){
    state.bricks=[];
    state.splitShots=[];
    if(state.wave%5===0){makeBossWave(state);return}
    const rows=Math.min(7,4+Math.floor(state.wave/2)),cols=9,gap=7,margin=40;
    const bw=(W-margin*2-gap*(cols-1))/cols,bh=28;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      if(Math.random()<.08)continue;
      const x=margin+c*(bw+gap),y=BRICK_TOP+r*(bh+gap),roll=Math.random();
      let type="normal";
      if(roll<Math.min(.10+state.wave*.012,.28))type="enemy";
      else if(roll<Math.min(.27+state.wave*.018,.55))type="tank";
      const base=1+Math.floor((state.wave-1)/3);
      const hp=type==="tank"?base+2:type==="enemy"?base+1:base;
      state.bricks.push({x,y,w:bw,h:bh,hp,maxHp:hp,type,shot:rand(1.5,3.4),poisonTimer:0,poisonTick:1});
    }
  }

  function updateFire(state,dt){
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
  }

  return{makeWave,makeBossWave,updateFire};
};
})();