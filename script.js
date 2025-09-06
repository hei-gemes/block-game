// =========================
// 設定
// =========================
const CANVAS_W = 480;
const CANVAS_H = 640;

const PADDLE_W = 90;
const PADDLE_H = 14;
const PADDLE_SPEED = 7;          // キーボード用

const BALL_SPEED = 5.2;          // 初速
const BALL_SIZE  = 8;
const MAX_BALL_SPEED = 9.5;      // 時間加速の上限

const MIN_ANGLE_DEG = 15;        // 水平に近すぎる角度を禁止（最低15°）
const ACCEL_INTERVAL_MS = 3000;  // 何msごとに加速
const ACCEL_STEP = 0.25;

const BRICK_GAP = 4;
const TOP_OFFSET = 80;
const START_LIVES = 3;

// many Bricks 風：キャンバスの下側のみ操作ゾーン
const CONTROL_ZONE_RATIO = 0.35; // 下35%が操作ゾーン

// =========================
// ユーティリティ
// =========================
const MIN_ANGLE_RAD = (MIN_ANGLE_DEG * Math.PI) / 180;
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function randInt(min, max){ return min + Math.floor(Math.random()*(max-min+1)); }
function sign(n){ return n < 0 ? -1 : 1; }

// 速度ベクトルに「水平すぎ/垂直すぎ」の補正を入れ、ball.speed に正規化
function enforceAngleAndNormalize(ball){
  const sp = Math.hypot(ball.vx, ball.vy) || 1e-6;
  let vx = ball.vx / sp;
  let vy = ball.vy / sp;

  // 水平に近すぎるとき：縦成分を最低値まで入れる（符号は保持）
  if (Math.abs(vy) < Math.sin(MIN_ANGLE_RAD)) {
    vy = sign(vy || -1) * Math.sin(MIN_ANGLE_RAD);
    vx = sign(vx || 1) * Math.sqrt(Math.max(0, 1 - vy*vy));
  }

  // 正規化して目標速度へ
  ball.vx = vx * ball.speed;
  ball.vy = vy * ball.speed;
}

// 「上向きを0度」とする角度で速度をセット（どこでも同じ式を使う）
function setBallDirFromUpAxis(ball, angleRad){
  // angleRad: 0 = 真上、負=左寄り、正=右寄り
  ball.vx = ball.speed * Math.sin(angleRad);
  ball.vy = -ball.speed * Math.cos(angleRad);
  enforceAngleAndNormalize(ball);
}

// =========================
// ステージ（0=空, 1=通常, 2=固い）
// =========================
const STAGES = [
  [
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [0,0,1,1,1,1,1,1,0,0],
  ],
  [
    [1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1],
    [1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1],
  ],
  [
    [1,1,1,0,0,0,0,1,1,1],
    [1,1,1,0,2,2,0,1,1,1],
    [1,1,1,0,2,2,0,1,1,1],
    [1,1,1,0,0,0,0,1,1,1],
  ],
  [
    [1,0,0,0,1,1,0,0,0,1],
    [1,1,0,1,0,0,1,0,1,1],
    [2,1,1,0,0,0,0,1,1,2],
  ],
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

let level = 1, score = 0, lives = START_LIVES;
let bricks = []; // {x,y,w,h,hp,alive}
let cols=0, rows=0, brickW=0, brickH=22;

let paddle = { x: CANVAS_W/2 - PADDLE_W/2, y: CANVAS_H - 40, w: PADDLE_W, h: PADDLE_H, vx: 0 };
let ball   = { x: CANVAS_W/2, y: CANVAS_H - 60, vx: 0, vy: 0, size: BALL_SIZE, stuck: true, speed: BALL_SPEED, lastSpeedUpAt: 0 };

let keys = { left:false, right:false };
let playing = true;

// ドラッグ制御（many Bricks風）
let dragging = false;
let activePointerId = null;
const CONTROL_ZONE_START_Y = CANVAS_H * (1 - CONTROL_ZONE_RATIO); // このYより下のみ操作

// 「ドラッグ中のスクロール」を完全停止（iOS対応）
window.addEventListener('touchmove', (e)=>{ if(dragging) e.preventDefault(); }, {passive: false});

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

function updateHUD(){ $stage.textContent = level; $score.textContent = score; $lives.textContent = lives; }

// =========================
// ステージ
// =========================
function loadStageFromPattern(p){
  bricks.length = 0;
  rows = p.length; cols = p[0].length;

  const totalGap = (cols - 1) * BRICK_GAP;
  brickW = Math.floor((CANVAS_W - 40 - totalGap) / cols);
  const leftX = Math.floor((CANVAS_W - (brickW*cols + totalGap)) / 2);

  for(let r=0; r<rows; r++){
    for(let c=0; c<cols; c++){
      const cell = p[r][c];
      if(!cell) continue;
      const x = leftX + c * (brickW + BRICK_GAP);
      const y = TOP_OFFSET + r * (brickH + BRICK_GAP);
      const hp = (cell === 2) ? 2 : 1;
      bricks.push({ x, y, w: brickW, h: brickH, hp, alive: true });
    }
  }
}
function loadRandomStage(){ loadStageFromPattern(STAGES[randInt(0, STAGES.length-1)]); }

// =========================
// 入力
// =========================
document.addEventListener('keydown', (e)=>{
  if(e.key === 'ArrowLeft')  keys.left  = true;
  if(e.key === 'ArrowRight') keys.right = true;
  if((e.key === ' ' || e.key === 'ArrowUp') && ball.stuck) launchBall();
});
document.addEventListener('keyup', (e)=>{
  if(e.key === 'ArrowLeft')  keys.left  = false;
  if(e.key === 'ArrowRight') keys.right = false;
});

// マウスはいつでも追従（PC向け）
canvas.addEventListener('pointerdown', (e)=>{
  const {xCanvas, yCanvas} = canvasCoords(e);
  if(e.pointerType === 'mouse'){
    paddle.x = clamp(xCanvas - paddle.w/2, 0, CANVAS_W - paddle.w);
    if(ball.stuck) launchBall();
  }else{
    // タッチ：下の余白のみ有効
    if(yCanvas >= CONTROL_ZONE_START_Y){
      dragging = true;
      activePointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
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
canvas.addEventListener('pointercancel', ()=>{ dragging = false; activePointerId = null; });

function canvasCoords(e){
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    xCanvas: (e.clientX - rect.left) * scaleX,
    yCanvas: (e.clientY - rect.top)  * scaleY,
  };
}

// =========================
// ゲーム制御
// =========================
$restart.addEventListener('click', resetRun);

function launchBall(){
  // パドル中心からの相対位置に応じて -60°〜+60°（上向き基準）
  const rel = ((ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2)); // -1〜+1
  const angle = clamp(rel, -1, 1) * (Math.PI/3); // ±60°
  ball.speed = BALL_SPEED;
  setBallDirFromUpAxis(ball, angle);
  ball.stuck = false;
  ball.lastSpeedUpAt = performance.now();
}

// =========================
// 更新
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
      const sp = Math.hypot(ball.vx, ball.vy) || 1e-6;
      ball.vx = (ball.vx / sp) * ball.speed;
      ball.vy = (ball.vy / sp) * ball.speed;
      ball.lastSpeedUpAt = now;
    }
  }

  // ボール移動
  if(ball.stuck){ ball.x = paddle.x + paddle.w/2; ball.y = paddle.y - 10; }
  else { ball.x += ball.vx; ball.y += ball.vy; }

  // 壁反射
  if(ball.x - ball.size < 0){ ball.x = ball.size;      ball.vx *= -1; enforceAngleAndNormalize(ball); }
  if(ball.x + ball.size > CANVAS_W){ ball.x = CANVAS_W - ball.size; ball.vx *= -1; enforceAngleAndNormalize(ball); }
  if(ball.y - ball.size < 0){ ball.y = ball.size;      ball.vy *= -1; enforceAngleAndNormalize(ball); }

  // パドル反射（上向き基準で統一）
  if(ball.y + ball.size >= paddle.y &&
     ball.y + ball.size <= paddle.y + paddle.h &&
     ball.x >= paddle.x && ball.x <= paddle.x + paddle.w && ball.vy > 0){
    const rel = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2);
    const angle = clamp(rel, -1, 1) * (Math.PI/3); // ±60°
    setBallDirFromUpAxis(ball, angle);
  }

  // ブロック衝突
  for(const b of bricks){
    if(!b.alive) continue;
    if(ball.x + ball.size < b.x || ball.x - ball.size > b.x + b.w ||
       ball.y + ball.size < b.y || ball.y - ball.size > b.y + b.h) continue;

    const prevX = ball.x - ball.vx;
    const prevY = ball.y - ball.vy;
    const fromLeft   = prevX <= b.x;
    const fromRight  = prevX >= b.x + b.w;
    const fromTop    = prevY <= b.y;
    const fromBottom = prevY >= b.y + b.h;

    if((fromLeft && !fromTop && !fromBottom) || (fromRight && !fromTop && !fromBottom)){
      ball.vx *= -1;
    } else {
      ball.vy *= -1;
    }
    enforceAngleAndNormalize(ball);

    b.hp -= 1;
    if(b.hp <= 0){ b.alive = false; score += 10; }
    else { score += 3; }
    updateHUD();
    break;
  }

  // 落下＝ミス
  if(ball.y - ball.size > CANVAS_H){
    lives -= 1; updateHUD();
    if(lives <= 0){
      playing = false;
      setTimeout(()=>alert('ゲームオーバー！'), 50);
    }else{
      resetPaddleBall(true);
    }
  }

  // 全破壊 → 次ステージ
  if(bricks.every(b => !b.alive)){
    level += 1; updateHUD();
    loadRandomStage();
    resetPaddleBall(true);
  }
}

// =========================
// 描画
// =========================
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  for(const b of bricks){
    if(!b.alive) continue;
    if(b.hp >= 2){ ctx.fillStyle = '#60a5fa'; ctx.strokeStyle = '#2563eb'; }
    else         { ctx.fillStyle = '#22d3ee'; ctx.strokeStyle = '#0891b2'; }
    roundRect(ctx, b.x, b.y, b.w, b.h, 6, true, true);
  }

  ctx.fillStyle = '#e5e7eb';
  roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 8, true, false);

  ctx.fillStyle = '#fef08a';
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI*2); ctx.fill();

  // // 操作ゾーンの可視化（必要なら）
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
