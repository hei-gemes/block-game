// =========================
// 設定
// =========================
const CANVAS_W = 480;
const CANVAS_H = 640;

const PADDLE_W = 90;
const PADDLE_H = 14;
const PADDLE_SPEED = 7;

const BALL_SPEED = 5.2;        // 初速
const BALL_SIZE = 8;
const MAX_BALL_SPEED = 9.5;    // 上限速度（加速でここまで上がる）

const MIN_ANGLE_DEG = 15;      // 反射後の最小角度（水平に近すぎるのを防ぐ）
const ACCEL_INTERVAL_MS = 3000;// 何msごとに加速するか
const ACCEL_STEP = 0.25;       // 1回の加速量（速さに加算）

const BRICK_GAP = 4;      // ブロック間の隙間(px)
const TOP_OFFSET = 80;    // 上端からの開始位置

const START_LIVES = 3;

// =========================
// ユーティリティ
// =========================
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function randInt(min, max){ return (min + Math.floor(Math.random()*(max-min+1))); }
function sign(n){ return n < 0 ? -1 : 1; }

// 角度の下限を守りつつ、現在のball.speedに正規化
function enforceAngleAndNormalize(ball){
  const speed = Math.hypot(ball.vx, ball.vy) || 1e-6;
  let vx = ball.vx / speed;
  let vy = ball.vy / speed;

  const minRad = (MIN_ANGLE_DEG * Math.PI) / 180;
  const minSin = Math.sin(minRad); // |vy|の最小割合
  const minCos = Math.cos(minRad); // |vx|の最小割合（垂直すぎ防止）

  // 水平に近すぎるのを補正
  if(Math.abs(vy) < minSin){
    vy = sign(vy || 1) * minSin;
    vx = sign(vx || 1) * Math.sqrt(Math.max(0, 1 - vy*vy));
  }
  // 垂直に近すぎるのも少しだけ補正（任意）
  if(Math.abs(vx) < (1 - minCos)){
    vx = sign(vx || 1) * Math.max(1 - minCos, Math.abs(vx));
    const norm = Math.hypot(vx, vy);
    vx /= norm; vy /= norm;
  }

  // 目標速度に合わせる
  ball.vx = vx * ball.speed;
  ball.vy = vy * ball.speed;
}

// 現在の向きを保ったまま、ball.speedに合わせて速度ベクトルを正規化
function normalizeToSpeed(ball){
  const sp = Math.hypot(ball.vx, ball.vy) || 1e-6;
  ball.vx = (ball.vx / sp) * ball.speed;
  ball.vy = (ball.vy / sp) * ball.speed;
}

// =========================
// ステージ定義（0=空, 1=通常ブロック, 2=固めブロック）
// 配列の行=上→下、列=左→右
// いくつか形の違うパターンを用意
// =========================
const STAGES = [
  // 1) ベーシック：上部びっしり
  [
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [0,0,1,1,1,1,1,1,0,0],
  ],
  // 2) ジグザグ
  [
    [1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1],
    [1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1],
  ],
  // 3) 中央空洞（左右に壁）
  [
    [1,1,1,0,0,0,0,1,1,1],
    [1,1,1,0,2,2,0,1,1,1],
    [1,1,1,0,2,2,0,1,1,1],
    [1,1,1,0,0,0,0,1,1,1],
  ],
  // 4) V字
  [
    [1,0,0,0,1,1,0,0,0,1],
    [1,1,0,1,0,0,1,0,1,1],
    [2,1,1,0,0,0,0,1,1,2],
  ],
  // 5) 外枠+内側ドット
  [
    [2,1,1,1,1,1,1,1,1,2],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,0,1,1],
    [2,1,1,1,1,1,1,1,1,2],
  ],
];

// =========================
// 状態
// =========================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const $stage = document.getElementById('stage');
const $score = document.getElementById('score');
const $lives = document.getElementById('lives');
const $restart = document.getElementById('restart');

let level = 1;
let score = 0;
let lives = START_LIVES;

let bricks = [];     // {x,y,w,h,hp,alive}
let cols = 0;
let rows = 0;
let brickW = 0;
let brickH = 22;

let paddle = { x: CANVAS_W/2 - PADDLE_W/2, y: CANVAS_H - 40, w: PADDLE_W, h: PADDLE_H, vx: 0 };
let ball = { x: CANVAS_W/2, y: CANVAS_H - 60, vx: 0, vy: 0, size: BALL_SIZE, stuck: true, speed: BALL_SPEED, lastSpeedUpAt: 0 };

let keys = { left:false, right:false };
let playing = true;

// =========================
function resetRun(){
  level = 1;
  score = 0;
  lives = START_LIVES;
  loadRandomStage();
  resetPaddleBall(true);
  playing = true;
  updateHUD();
}

function resetPaddleBall(stick=true){
  paddle.x = CANVAS_W/2 - paddle.w/2;
  paddle.y = CANVAS_H - 40;
  paddle.vx = 0;

  ball.x = paddle.x + paddle.w/2;
  ball.y = paddle.y - 10;
  ball.vx = 0;
  ball.vy = 0;
  ball.speed = BALL_SPEED;
  ball.stuck = stick;
  ball.lastSpeedUpAt = performance.now();
}

function updateHUD(){
  $stage.textContent = level;
  $score.textContent = score;
  $lives.textContent = lives;
}

// =========================
// ステージ構築
// =========================
function loadStageFromPattern(pattern){
  bricks.length = 0;
  rows = pattern.length;
  cols = pattern[0].length;

  // 横幅に合わせてブロック幅を決定（隙間分を引く）
  const totalGap = (cols - 1) * BRICK_GAP;
  brickW = Math.floor((CANVAS_W - 40 - totalGap) / cols); // 左右に20pxずつ余白
  const leftX = Math.floor((CANVAS_W - (brickW*cols + totalGap)) / 2);

  for(let r=0; r<rows; r++){
    for(let c=0; c<cols; c++){
      const cell = pattern[r][c];
      if(cell === 0) continue;

      const x = leftX + c * (brickW + BRICK_GAP);
      const y = TOP_OFFSET + r * (brickH + BRICK_GAP);
      const hp = (cell === 2) ? 2 : 1; // 2=固め
      bricks.push({ x, y, w: brickW, h: brickH, hp, alive: true });
    }
  }
}

function loadRandomStage(){
  const idx = randInt(0, STAGES.length-1);
  loadStageFromPattern(STAGES[idx]);
}

// =========================
// 入力
// =========================
document.addEventListener('keydown', (e)=>{
  if(e.key === 'ArrowLeft') keys.left = true;
  if(e.key === 'ArrowRight') keys.right = true;

  // スペース or 上キーで発射
  if((e.key === ' ' || e.key === 'ArrowUp') && ball.stuck){
    launchBall();
  }
});
document.addEventListener('keyup', (e)=>{
  if(e.key === 'ArrowLeft') keys.left = false;
  if(e.key === 'ArrowRight') keys.right = false;
});

// タッチ/マウスでパドル追従 & タップで発射
function pointerPos(e){
  const rect = canvas.getBoundingClientRect();
  const px = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  return px * (canvas.width / rect.width);
}
canvas.addEventListener('pointerdown', (e)=>{
  const x = pointerPos(e);
  paddle.x = clamp(x - paddle.w/2, 0, CANVAS_W - paddle.w);
  if(ball.stuck) launchBall();
});
canvas.addEventListener('pointermove', (e)=>{
  if(e.pressure === 0 && e.pointerType !== 'mouse') return; // 画面上を滑らせたときのみ
  const x = pointerPos(e);
  paddle.x = clamp(x - paddle.w/2, 0, CANVAS_W - paddle.w);
});

// =========================
// ゲーム制御
// =========================
$restart.addEventListener('click', resetRun);

function launchBall(){
  // 斜め上に発射（パドル中心からの相対で多少角度がつく）
  const rel = ( (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2) );
  const angle = (-Math.PI/3) + (rel * Math.PI/6); // -60°±30°
  ball.speed = BALL_SPEED;
  ball.vx = Math.cos(angle) * ball.speed;
  ball.vy = Math.sin(angle) * ball.speed;
  ball.stuck = false;
  ball.lastSpeedUpAt = performance.now();
  enforceAngleAndNormalize(ball);
}

// =========================
// 更新
// =========================
function update(){
  if(!playing) return;

  // パドル移動（キーボード）
  if(keys.left)  paddle.x -= PADDLE_SPEED;
  if(keys.right) paddle.x += PADDLE_SPEED;
  paddle.x = clamp(paddle.x, 0, CANVAS_W - paddle.w);

  // 時間経過で少しずつ加速
  if(!ball.stuck){
    const now = performance.now();
    if(now - ball.lastSpeedUpAt >= ACCEL_INTERVAL_MS){
      ball.speed = Math.min(MAX_BALL_SPEED, ball.speed + ACCEL_STEP);
      normalizeToSpeed(ball);
      ball.lastSpeedUpAt = now;
    }
  }

  // ボール（吸着中はパドルに追従）
  if(ball.stuck){
    ball.x = paddle.x + paddle.w/2;
    ball.y = paddle.y - 10;
  }else{
    ball.x += ball.vx;
    ball.y += ball.vy;
  }

  // 壁反射
  if(ball.x - ball.size < 0){ ball.x = ball.size; ball.vx *= -1; enforceAngleAndNormalize(ball); }
  if(ball.x + ball.size > CANVAS_W){ ball.x = CANVAS_W - ball.size; ball.vx *= -1; enforceAngleAndNormalize(ball); }
  if(ball.y - ball.size < 0){ ball.y = ball.size; ball.vy *= -1; enforceAngleAndNormalize(ball); }

  // パドル反射
  if(ball.y + ball.size >= paddle.y &&
     ball.y + ball.size <= paddle.y + paddle.h &&
     ball.x >= paddle.x && ball.x <= paddle.x + paddle.w && ball.vy > 0){
    // 当たった位置で角度変更
    const hitPos = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2);
    const angle = (-Math.PI/3) + (hitPos * Math.PI/3); // -60°〜+60°
    ball.vx = Math.sin(angle) * ball.speed;
    ball.vy = -Math.abs(Math.cos(angle) * ball.speed);
    enforceAngleAndNormalize(ball);
  }

  // ブロック衝突
  for(const b of bricks){
    if(!b.alive) continue;
    if(ball.x + ball.size < b.x || ball.x - ball.size > b.x + b.w ||
       ball.y + ball.size < b.y || ball.y - ball.size > b.y + b.h) continue;

    // どの面に当たったかざっくり判定
    const prevX = ball.x - ball.vx;
    const prevY = ball.y - ball.vy;
    const fromLeft   = prevX <= b.x;
    const fromRight  = prevX >= b.x + b.w;
    const fromTop    = prevY <= b.y;
    const fromBottom = prevY >= b.y + b.h;

    if((fromLeft && !fromTop && !fromBottom) || (fromRight && !fromTop && !fromBottom)){
      ball.vx *= -1;
    }else{
      ball.vy *= -1;
    }

    // 角度と速度を補正
    enforceAngleAndNormalize(ball);

    // ブロックダメージ
    b.hp -= 1;
    if(b.hp <= 0){
      b.alive = false;
      score += 10;
    }else{
      score += 3; // 固いブロックに当てたボーナス
    }
    updateHUD();
    break;
  }

  // 落下＝ミス
  if(ball.y - ball.size > CANVAS_H){
    lives -= 1;
    updateHUD();
    if(lives <= 0){
      playing = false;
      // 簡易ゲームオーバー表示
      setTimeout(()=>{
        alert('ゲームオーバー！');
      }, 50);
    }else{
      resetPaddleBall(true); // 再吸着から
    }
  }

  // クリア判定（全ブロック破壊）
  if(bricks.every(b => !b.alive)){
    level += 1;
    updateHUD();
    loadRandomStage();
    resetPaddleBall(true);
  }
}

// =========================
// 描画
// =========================
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // ブロック
  for(const b of bricks){
    if(!b.alive) continue;
    // hpで色を変える
    if(b.hp >= 2){
      ctx.fillStyle = '#60a5fa'; // 2段ブロック（青系）
      ctx.strokeStyle = '#2563eb';
    }else{
      ctx.fillStyle = '#22d3ee'; // 通常（シアン）
      ctx.strokeStyle = '#0891b2';
    }
    roundRect(ctx, b.x, b.y, b.w, b.h, 6, true, true);
  }

  // パドル
  ctx.fillStyle = '#e5e7eb';
  roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 8, true, false);

  // ボール
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI*2);
  ctx.fill();

  if(!playing){
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '24px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('ゲームオーバー', canvas.width/2, canvas.height/2);
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if(w < 2*r) r = w/2;
  if(h < 2*r) r = h/2;
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

// =========================
// ループ
// =========================
function loop(){
  update();
  draw();
  requestAnimationFrame(loop);
}

// 初期化
resetRun();
loop();
