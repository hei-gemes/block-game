(()=>{
"use strict";

window.createRogueCombat=({W,H,TOP_SAFE,MAX_HP,AUTO_COLLECT_SECONDS,clamp,rand,flash})=>{
  function circleRect(c,r){
    const x=clamp(c.x,r.x,r.x+r.w),y=clamp(c.y,r.y,r.y+r.h);
    return(c.x-x)**2+(c.y-y)**2<c.r**2;
  }

  function ballPaddleRect(state){
    if(!state.ghost)return state.paddle;
    const w=state.ghostBallWidth||170;
    return{x:state.paddle.x+state.paddle.w/2-w/2,y:state.paddle.y,w,h:state.paddle.h};
  }

  function spawnBall(state,x,y,dx,dy){
    const len=Math.hypot(dx,dy)||1;
    state.balls.push({x,y,r:7,vx:dx/len*330,vy:dy/len*330,pierceLeft:state.pierce,trail:[],lastBrick:null});
  }

  function extraBall(state){
    const b=state.balls[0];
    b?spawnBall(state,b.x,b.y,rand(-1,1),-1):spawnBall(state,W/2,state.paddle.y-28,rand(-1,1),-1);
  }

  function dropOrb(state,x,y,value){state.orbs.push({x,y,r:6,vy:85,value})}
  function dropHeal(state,x,y){state.items.push({type:"heal",x,y,r:10,vy:72,spin:0})}
  function dropAutoCollect(state,x,y){state.items.push({type:"collect",x,y,r:11,vy:72,spin:0})}

  function particles(state,x,y,n=5){
    for(let i=0;i<n;i++)state.particles.push({x,y,vx:rand(-90,90),vy:rand(-100,50),life:rand(.25,.6),max:.6});
  }

  function applyPoison(state,br){
    if(state.poisonLevel<=0)return;
    if(br.poisonTimer<=0)br.poisonTick=1;
    br.poisonTimer=3;
  }

  function rewardFor(type){
    const score={normal:75,gunner:180,burst:220,armor:150,support:185,splitter:170,bomber:165,mover:135,splitling:25};
    const xp={normal:4,gunner:8,burst:9,armor:7,support:8,splitter:7,bomber:7,mover:6,splitling:1};
    return{score:score[type]??75,xp:xp[type]??4};
  }

  function spawnSplitlings(state,br){
    const w=Math.max(20,br.w*.42),h=Math.max(14,br.h*.72),gap=5;
    const total=w*2+gap,start=br.x+br.w/2-total/2,y=br.y+(br.h-h)/2;
    for(let i=0;i<2;i++){
      const x=clamp(start+i*(w+gap),6,W-w-6);
      state.bricks.push({x,y,w,h,hp:1,maxHp:1,type:"splitling",shot:0,poisonTimer:0,poisonTick:1});
    }
    particles(state,br.x+br.w/2,br.y+br.h/2,10);
  }

  function bomberBlast(state,br){
    const cx=br.x+br.w/2,cy=br.y+br.h/2,radius=Math.max(110,br.w*1.65);
    particles(state,cx,cy,18);
    const targets=[...state.bricks];
    for(const target of targets){
      if(target.type==="boss")continue;
      const tx=target.x+target.w/2,ty=target.y+target.h/2;
      if(Math.hypot(tx-cx,ty-cy)>radius)continue;
      const blastDamage=Math.max(2,Math.ceil(target.maxHp*.5));
      damageBrick(state,target,blastDamage,tx,ty,false);
    }
  }

  function onBrickDestroyed(state,br){
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

    const reward=rewardFor(br.type);
    state.score+=reward.score;
    if(reward.xp>0)dropOrb(state,br.x+br.w/2,br.y+br.h/2,reward.xp);

    if(br.type!=="splitling"){
      if(Math.random()<.055)dropHeal(state,br.x+br.w/2,br.y+br.h/2);
      if(Math.random()<.035)dropAutoCollect(state,br.x+br.w/2,br.y+br.h/2);
    }

    if(br.type==="splitter")spawnSplitlings(state,br);
    else if(br.type==="bomber")bomberBlast(state,br);
  }

  function damageBrick(state,br,amount,x,y,withPoison=true){
    const idx=state.bricks.indexOf(br);
    if(idx<0)return false;
    br.hp-=amount;
    if(withPoison)applyPoison(state,br);
    particles(state,x??br.x+br.w/2,y??br.y+br.h/2,4);
    if(br.hp<=0){
      state.bricks.splice(idx,1);
      onBrickDestroyed(state,br);
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

  function armorAdjustedDamage(br,b,damage){
    if(br.type!=="armor")return damage;
    const fromBelow=b.vy<0&&b.y>=br.y+br.h*.45;
    return fromBelow?Math.max(.35,damage*.35):damage;
  }

  function spawnSplitBurst(state,b){
    if(state.splitLevel<=0||!state.bricks.length)return;
    for(let i=0;i<5;i++){
      const target=state.bricks[(Math.random()*state.bricks.length)|0];
      const tx=target.x+target.w/2,ty=target.y+target.h/2;
      const angle=Math.atan2(ty-b.y,tx-b.x)+rand(-.10,.10),speed=470;
      state.splitShots.push({x:b.x,y:b.y,r:4,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,hitsLeft:state.splitLevel,lastBrick:null,life:2.4});
    }
    if(state.splitShots.length>80)state.splitShots.splice(0,state.splitShots.length-80);
  }

  function fireShotgun(state){
    if(state.shotgunLevel<=0)return;
    const lvl=state.shotgunLevel;
    const pellets=3+(lvl-1);
    const spread=.72;
    const range=120+(lvl-1)*18;
    const speed=430;
    const cx=state.paddle.x+state.paddle.w/2;
    const cy=state.paddle.y-2;
    for(let i=0;i<pellets;i++){
      const t=pellets===1?.5:i/(pellets-1);
      const angle=-Math.PI/2+(t-.5)*spread;
      state.interceptors.push({x:cx,y:cy,r:4,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:range/speed});
    }
  }

  function updateShotgun(state,dt){
    if(state.shotgunLevel>0){
      state.shotgunTimer-=dt;
      if(state.shotgunTimer<=0){
        fireShotgun(state);
        state.shotgunTimer=Math.max(.85,2.25-(state.shotgunLevel-1)*.3);
      }
    }

    for(let i=state.interceptors.length-1;i>=0;i--){
      const s=state.interceptors[i];
      s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;
      let spent=false;
      for(let j=state.bullets.length-1;j>=0;j--){
        const q=state.bullets[j],rr=s.r+q.r;
        if((s.x-q.x)**2+(s.y-q.y)**2<rr*rr){
          state.bullets.splice(j,1);
          state.interceptors.splice(i,1);
          particles(state,q.x,q.y,5);
          state.score+=10;
          spent=true;
          break;
        }
      }
      if(spent)continue;
      if(s.life<=0||s.y<-30||s.x<-30||s.x>W+30)state.interceptors.splice(i,1);
    }
  }

  function updatePoison(state,dt){
    const bricks=[...state.bricks];
    for(const br of bricks){
      if(!state.bricks.includes(br))continue;
      if(br.poisonTimer>0&&state.poisonLevel>0){
        br.poisonTimer=Math.max(0,br.poisonTimer-dt);
        br.poisonTick-=dt;
        if(br.poisonTick<=0){
          br.poisonTick+=1;
          damageBrick(state,br,state.poisonLevel,br.x+br.w/2,br.y+br.h/2,false);
        }
      }
    }
  }

  function updateBullets(state,dt,hurt){
    for(let i=state.bullets.length-1;i>=0;i--){
      const q=state.bullets[i];
      q.x+=q.vx*dt;q.y+=q.vy*dt;
      let dead=false;
      for(const b of state.balls){
        const rr=q.r+b.r;
        if((q.x-b.x)**2+(q.y-b.y)**2<rr*rr){
          state.bullets.splice(i,1);
          particles(state,q.x,q.y,5);
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
  }

  function updateBalls(state,dt,hurt){
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

      const paddleRect=ballPaddleRect(state);
      if(b.vy>0&&circleRect(b,paddleRect)){
        b.y=paddleRect.y-b.r-1;
        const hit=(b.x-(paddleRect.x+paddleRect.w/2))/(paddleRect.w/2),ang=hit*1.05;
        b.vx=Math.sin(ang)*targetBase;b.vy=-Math.cos(ang)*targetBase;
        b.pierceLeft=state.pierce;
      }

      let hit=-1;
      for(let j=0;j<state.bricks.length;j++){
        const br=state.bricks[j];
        if(br!==b.lastBrick&&circleRect(b,br)){hit=j;break}
      }
      if(hit>=0){
        const br=state.bricks[hit];
        b.lastBrick=br;
        damageBrick(state,br,armorAdjustedDamage(br,b,dmg),b.x,b.y,true);
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
    return{fury,targetBase,dmg};
  }

  function updateSplitShots(state,dt){
    const fury=state.fury&&state.hp<=state.maxHp/2;
    const dmg=state.ballDamage+(fury?1:0);
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
        damageBrick(state,br,dmg,q.x,q.y,true);
        q.hitsLeft--;
        if(q.hitsLeft<=0){state.splitShots.splice(i,1);continue}
      }
      if(q.life<=0||q.y<-30||q.y>H+30||q.x<-30||q.x>W+30)state.splitShots.splice(i,1);
    }
  }

  function updateOrbs(state,dt,gainXp){
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
  }

  function updateItems(state,dt){
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
  }

  function updateParticles(state,dt){
    for(let i=state.particles.length-1;i>=0;i--){
      const p=state.particles[i];
      p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;
      if(p.life<=0)state.particles.splice(i,1);
    }
  }

  return{
    circleRect,ballPaddleRect,spawnBall,extraBall,dropOrb,dropHeal,dropAutoCollect,particles,
    applyPoison,onBrickDestroyed,damageBrick,bounceOffBrick,spawnSplitBurst,fireShotgun,
    updatePoison,updateShotgun,updateBullets,updateBalls,updateSplitShots,updateOrbs,updateItems,updateParticles
  };
};
})();