const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

// パドル
const paddle = { w: 90, h: 14, x: (W-90)/2, y: H-30, speed: 6, dx: 0 };

// ボール
const ball = { r: 7, x: W/2, y: H/2+80, dx: 3, dy: -3 };

// ブロック
const COLS = 8, ROWS = 6;
const brick = { w: (W-40)/COLS, h: 20, pad: 5, top: 60, left: 20 };
let bricks = [];

// スコア & ライフ
let score = 0, lives = 3, running = true;

// 初期化
function makeBricks(){
  bricks = [];
  for (let r=0;r<ROWS;r++){
    const row = [];
    for (let c=0;c<COLS;c++){
      row.push({ x: brick.left + c*brick.w, y: brick.top + r*(brick.h+brick.pad), alive: true, hue: 180 + r*25 });
    }
    bricks.push(row);
  }
}
function resetBall() {
  ball.x = W/2; ball.y = H/2+80; ball.dx = (Math.random()<.5? -1:1) * 3; ball.dy = -3;
}
function resetAll() {
  score = 0; lives = 3; running = true; paddle.x = (W-paddle.w)/2; makeBricks(); resetBall();
}

resetAll();

// 入力処理（修正版）
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") paddle.dx = -paddle.speed;
  if (e.key === "ArrowRight") paddle.dx = paddle.speed;
});
document.addEventListener("keyup", e => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") paddle.dx = 0;
});

// スマホ操作
canvas.addEventListener("pointerdown", e => {
  const x = e.offsetX;
  paddle.dx = x < W/2 ? -paddle.speed : paddle.speed;
});
canvas.addEventListener("pointerup", ()=> paddle.dx = 0);

document.getElementById("restart").addEventListener("click", resetAll);

// 更新
function update(){
  if (!running) return;

  paddle.x += paddle.dx;
  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));

  // ボール移動
  ball.x += ball.dx; ball.y += ball.dy;

  // 壁
  if (ball.x < ball.r || ball.x > W - ball.r) ball.dx *= -1;
  if (ball.y < ball.r) ball.dy *= -1;

  // パドル
  if (ball.y + ball.r >= paddle.y &&
      ball.x >= paddle.x && ball.x <= paddle.x + paddle.w &&
      ball.dy > 0) {
    const hit = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2);
    ball.dx = hit * 4;
    ball.dy = -Math.abs(ball.dy);
    ball.y = paddle.y - ball.r - 0.1;
  }

  // ブロック衝突
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      const b = bricks[r][c];
      if (!b.alive) continue;
      if (ball.x > b.x && ball.x < b.x + brick.w &&
          ball.y > b.y && ball.y < b.y + brick.h) {
        b.alive = false;
        score += 10;
        const prevX = ball.x - ball.dx, prevY = ball.y - ball.dy;
        const fromSide = (prevY > b.y && prevY < b.y + brick.h);
        if (fromSide) ball.dx *= -1; else ball.dy *= -1;
      }
    }
  }

  // 落下
  if (ball.y > H + 20) {
    lives--;
    if (lives <= 0) running = false;
    else resetBall();
  }
}

// 描画
function draw(){
  ctx.clearRect(0,0,W,H);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "16px system-ui, -apple-system";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE: ${score}`, 16, 28);
  ctx.textAlign = "right";
  ctx.fillText(`LIVES: ${lives}`, W-16, 28);

  ctx.fillStyle = "#22d3ee";
  roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 8);

  ctx.beginPath();
  ctx.fillStyle = "#93c5fd";
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
  ctx.fill();

  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      const b = bricks[r][c];
      if (!b.alive) continue;
      ctx.fillStyle = `hsl(${b.hue} 80% 60%)`;
      roundRect(ctx, b.x, b.y, brick.w - brick.pad, brick.h, 6);
    }
  }

  const cleared = bricks.every(row => row.every(b => !b.alive));
  if (cleared) { running = false; }

  if (!running) {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 28px system-ui";
    ctx.fillText(cleared ? "CLEAR! 🎉" : "GAME OVER", W/2, H/2 - 10);
    ctx.font = "16px system-ui";
    ctx.fillText("リスタートで再挑戦！", W/2, H/2 + 24);
  }
}

function loop(){
  update(); draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
  ctx.fill();
}
