// =========================
// 設定
// =========================
const CANVAS_W = 480;
const CANVAS_H = 640;

const PADDLE_W = 90;
const PADDLE_H = 14;
const PADDLE_SPEED = 7;       // キーボード用移動速度

const BALL_SPEED = 5.2;       // 初速
const BALL_SIZE = 8;
const MAX_BALL_SPEED = 9.5;   // 時間加速の上限

const MIN_ANGLE_DEG = 15;     // 反射後の最小角度（水平/垂直すぎ防止）
const ACCEL_INTERVAL_MS = 3000;
const ACCEL_STEP = 0.25;

const BRICK_GAP = 4;
const TOP_OFFSET = 80;

const START_LIVES = 3;

// many Bricks 風：キャンバス下の余白を操作ゾーンに
const CONTROL_ZONE_RATIO = 0.35; // 下35%が操作ゾーン

// =========================
// ユーティリティ
// =========================
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function randInt(min, max){ return min + Math.floor(Math.random()*(max-min+1)); }
function sign(n){ return n < 0 ? -1 : 1; }

function enforceAngleAndNormalize(ball){
  const speed = Math.hypot(ball.vx, ball.vy) || 1e-6;
  let vx = ball.vx / speed;
  let vy = ball.vy / speed;

  const minRad = (MIN_ANGLE_DEG * Math.PI) / 180;
  const minSin = Math.sin(minRad);
  const minCos = Math.cos(minRad);

  // 水平に近すぎ → 縦成分を最低値まで入れる
  if(Math.abs(vy) < minSin){
    vy = sign(vy || 1) * minSin;
    vx = sign(vx || 1) * Math.sqrt(Math.max(0, 1 - vy*vy));
  }
  // 垂直に近すぎも少し補正（任意）
  if(Math.abs(vx) < (1 - minCos)){
    vx = sign(vx || 1) * Math.max(1 - minCos, Math.abs(vx));
    const n = Math.hypot(vx, vy);
    vx /= n; vy /= n;
  }

  ball.vx = vx * ball.speed;
  ball.vy = vy * ball.speed;
}

function normalizeToSpeed(ball){
  const sp = Math.hypot(ball.vx, ball.vy) || 1e-6;
  ball.vx = (ball.vx / sp) * ball.speed;
  ball.vy = (ball.vy / sp) * ball.speed;
}

// =========================
// ステージ定義（0=空, 1=通常, 2=固い）
// =========================
const STAGES = [
  // 1) ベーシック
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
  // 3) 中央空洞
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

let bricks = []; // {x,y,w,h,hp,alive}
let cols = 0, rows = 0;
let brickW = 0, brickH = 22;

let paddle = {
  x: CANVAS_W/2 - PADDLE_W/2,
  y: CANVAS_H - 40,
  w: PADDLE_W, h: PADDLE_H, vx: 0
};

let ball = {
  x: CANVAS_W/2, y: CANVAS_H - 60,
  vx: 0, vy: 0, size: BALL_SIZE,
  stuck: true, speed: BALL_SPEED,
  lastSpeedUpAt: 0
};

let keys = { left:false, right:false };
let playing = true;

// スマホのドラッグ操作（many Bricks 風）
let dragging = false;
let activePointerId = null;
const CONTROL_ZONE_START_Y = CANVAS_H * (1 - CONTROL_ZONE_RATIO); // このYより下だけ有効

// =========================
function resetRun(){
  level = 1; score = 0; lives = START_LIVES;
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
  ball.vx = 0; ball.vy = 0;
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

  const totalGap = (cols - 1) * BRICK_GAP;
  brickW = Math.floor((CANVAS_W - 40 - totalGap) / cols); // 左右に20px余白
  const leftX = Math.floor((CANVAS_W - (brickW*cols + totalGap)) / 2);

  for(let r=0; r<rows; r++){
    for(let c=0; c<cols; c++){
      const cell = pattern[r][c];
      if(cell === 0) continue;
      const x = leftX + c * (brickW + BRICK_GAP);
      const y = TOP_OFFSET + r * (brickH + BRICK_GAP);
      const hp = (cell === 2) ? 2 : 1;
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
  if((e.key === ' ' || e.key === 'ArrowUp') && ball.stuck) launchBall();
});
document.addEventListener('keyup', (e)=>{
  if(e.key === 'ArrowLeft') keys.left = false;
  if(e.key === 'ArrowRight') keys.right = false;
});

// デスクトップ：マウスはどこでも追従
canvas.addEventListener('pointerdown', (e)=>{
  if(e.pointerType === 'mouse'){
    const {xCanvas} = canvasCoords(e);
    paddle.x = clamp(xCanvas - paddle.w/2, 0, CANVAS_W - paddle.w);
    if(ball.stuck) launchBall();
  }else{
    // タッチ：下の余白だけ有効
    const {xCanvas, yCanvas} = canvasCoords(e);
    if(yCanvas >= CONTROL_ZONE_START_Y){
      dragging = true;
      activePointerId = e.pointerId;
      paddle.x = clamp(xCanvas - paddle.w/2, 0, CANVAS_W - paddle.w);
      if(ball.stuck) launchBall();
      e.preventDefault();
    }
  }
});
canvas.addEventListener('pointermove', (e)=>{
  if(e.pointerType === 'mouse'){
    const {xCanvas} = canvasCoords(e);
    paddle.x = clamp(xCanvas - paddle.w/2, 0, CANVAS_W - paddle.w);
  }else{
    if(!dragging || e.pointerId !== activePointerId) return;
    const {xCanvas} = canvasCoords(e);
    paddle.x = clamp(xCanvas - paddle.w/2, 0, CANVAS_W - paddle.w);
    e.preventDefault();
  }
});
canvas.addEventListener('pointerup', (e)=>{
  if(e.pointerType !== 'mouse' && e.pointerId === activePointerId){
    dragging = false; activePointerId = null;
    e.preventDefault();
  }
});
canvas.addEventListener('pointercancel', (e)=>{
  if(e.pointerType !== 'mouse' && e.pointerId === activePointerId){
    dragging = false; activePointerId = null;
  }
});

function canvasCoords(e){
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    xCanvas: (e.clientX - rect.left) * scaleX,
    yCanvas: (e.clientY - rect.top) * scaleY,
  };
}

// =========================
// ゲーム制御
// =========================
$restart.addEventListener('click', resetRun);

function launchBall(){
  // パドル位置から角度付けて発射
  const rel = ((ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2));
  const angle = (-Math.PI/3) + (rel * Math.PI/6); // -60°±30°
  ball.speed = BALL_SPEED;
  ball.vx = Math.cos(angle) * ball.speed;
  ball.vy = Math.sin(angle) * ball.speed;
  ball.stuck = false;
  ball.lastSpeedUpAt = performance.now();
  enforceAngleAndNormalize(ball);
}

// =========================
function update(){
  if(!playing) return;

  // キーボード移動
  if(keys.left)  paddle.x -= PADDLE_SPEED;
  if(keys.right) paddle.x += PADDLE_SPEED;
  paddle.x = clamp(paddle.x, 0, CANVAS_W - paddle.w);

  // 経時加速
  if(!ball.stuck){
    const now = performance.now();
    if(now - ball.lastSpeedUpAt >= ACCEL_INTERVAL_MS){
      ball.speed = Math.min(MAX_BALL_SPEED, ball.speed + ACCEL_STEP);
      normalizeToSpeed(ball);
      ball.lastSpeedUpAt = now;
    }
  }

  // ボール更新
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

    // ざっくり接触面
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
    enforceAngleAndNormalize(ball);

    // ダメージ
    b.hp -= 1;
    if(b.hp <= 0){ b.alive = false; score += 10; }
    else { score += 3; }
    updateHUD();
    break;
  }

  // 落下＝ミス
  if(ball.y - ball.size > CANVAS_H){
    lives -= 1;
    updateHUD();
    if(lives <= 0){
      playing = false;
      setTimeout(()=>alert('ゲームオーバー！'), 50);
    }else{
      resetPaddleBall(true);
    }
  }

  // クリア（全破壊）
  if(bricks.every(b => !b.alive)){
    level += 1;
    updateHUD();
    loadRandomStage();
    resetPaddleBall(true);
  }
}

// =========================
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // ブロック
  for(const b of bricks){
    if(!b.alive) continue;
    if(b.hp >= 2){ ctx.fillStyle = '#60a5fa'; ctx.strokeStyle = '#2563eb'; }
    else         { ctx.fillStyle = '#22d3ee'; ctx.strokeStyle = '#0891b2'; }
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

  // （デバッグ用）操作ゾーン可視化したい時はコメント解除
  // ctx.fillStyle = 'rgba(255,255,255,0.04)';
  // ctx.fillRect(0, CONTROL_ZONE_START_Y, canvas.width, canvas.height - CONTROL_ZONE_START_Y);

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
function loop(){ update(); draw(); requestAnimationFrame(loop); }

// 初期化
resetRun();
loop();
