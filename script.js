// ====== ブロック崩し（安定版） ======
(() => {
  const cvs = document.getElementById("game");
  const ctx = cvs.getContext("2d");

  // UI
  const elScore = document.getElementById("score");
  const elLives = document.getElementById("lives");
  const elLevel = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const titleText = document.getElementById("titleText");
  const descText  = document.getElementById("descText");
  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnResume = document.getElementById("btnResume");
  const btnReset = document.getElementById("btnReset");

  // 基本設定
  const BASE_W = 480, BASE_H = 640, RATIO = BASE_H / BASE_W;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const PADDLE_W0 = 80, PADDLE_H = 12;
  const BALL_SPEED0 = 260;
  const LIVES_MAX = 3;

  // 状態
  let running = false, paused = false;
  let level = 1, score = 0, lives = LIVES_MAX;
  let last = 0;                   // 直前フレームの時刻
  let keys = { left:false, right:false };
  let pointerX = null;

  // エンティティ
  const paddle = { x:0, y:0, w:PADDLE_W0, h:PADDLE_H, speed:480 };
  const ball   = { x:0, y:0, r:7, vx:0, vy:0, speed:BALL_SPEED0 };
  let bricks = [];

  // -------- レイアウトと初期化 --------
  function resizeCanvas() {
    // CSS幅に合わせて内部解像度を調整（常に縦長比率を維持）
    const cssW = cvs.clientWidth || cvs.getBoundingClientRect().width || BASE_W;
    const cssH = Math.round(cssW * RATIO);
    cvs.style.height = cssH + "px";
    cvs.width  = Math.round(cssW * DPR);
    cvs.height = Math.round(cssH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    if (!running) { // タイトル中は見た目だけ整える
      paddle.x = (cssW - paddle.w) / 2;
      paddle.y = cssH - 40;
      ball.x = cssW / 2;
      ball.y = cssH - 60;
      buildLevel(level, cssW);
      draw();
    } else {
      paddle.y = cssH - 40;
      buildLevel(level, cssW);
    }
  }

  function buildLevel(n, widthCss) {
    const cols = 8;
    const rows = Math.min(4 + n, 10);
    const margin = 8;
    const top = 70;
    const brickW = (widthCss - margin * (cols + 1)) / cols;
    const brickH = 20;

    bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hp = 1 + Math.floor((n - 1) / 2);
        bricks.push({
          x: margin + c * (brickW + margin),
          y: top + r * (brickH + margin),
          w: brickW, h: brickH, hp,
          color: `hsl(${(c*32 + r*14)%360} 70% 55%)`,
        });
      }
    }
  }

  function resetBallAndPaddle() {
    const w = cvs.width / DPR, h = cvs.height / DPR;
    paddle.w = Math.max(56, PADDLE_W0 - (level-1)*4);
    paddle.x = (w - paddle.w) / 2;
    paddle.y = h - 40;

    ball.x = w / 2;
    ball.y = h - 60;
    const deg = -60 + Math.random()*120;              // -60°〜60°
    const speed = (BALL_SPEED0 + (level-1)*28);
    ball.vx = Math.sin(deg * Math.PI/180) * speed;
    ball.vy = -Math.abs(Math.cos(deg * Math.PI/180) * speed); // 必ず上向き
  }

  // -------- 入力 --------
  addEventListener("keydown", e => {
    if (e.key === "ArrowLeft")  keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
    if (e.key.toLowerCase() === "p") togglePause();
  });
  addEventListener("keyup", e => {
    if (e.key === "ArrowLeft")  keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });
  cvs.addEventListener("mousemove", e => {
    const r = cvs.getBoundingClientRect(); pointerX = e.clientX - r.left;
  });
  cvs.addEventListener("mouseleave", () => pointerX = null);
  cvs.addEventListener("touchstart", e => {
    const r = cvs.getBoundingClientRect(); pointerX = e.touches[0].clientX - r.left;
  }, {passive:true});
  cvs.addEventListener("touchmove", e => {
    const r = cvs.getBoundingClientRect(); pointerX = e.touches[0].clientX - r.left;
  }, {passive:true});
  cvs.addEventListener("touchend", () => pointerX = null);

  // -------- UI --------
  btnStart.addEventListener("click", startGame);
  btnPause.addEventListener("click", () => togglePause(true));
  btnResume.addEventListener("click", () => togglePause(false));
  btnReset.addEventListener("click", hardReset);
  addEventListener("resize", resizeCanvas);

  function updateHUD(){ elScore.textContent = score; elLives.textContent = lives; elLevel.textContent = level; }
  function showOverlay(show, title, desc){
    if (show) {
      titleText.textContent = title ?? "ブロック崩し";
      descText.textContent  = desc  ?? "左右キー / マウス / タッチ で操作";
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
    }
  }

  function startGame(){
    running = true; paused = false;
    btnStart.hidden = true; btnPause.hidden = false; btnResume.hidden = true; btnReset.hidden = false;
    level = 1; score = 0; lives = LIVES_MAX; updateHUD();
    showOverlay(false);
    resizeCanvas();
    resetBallAndPaddle();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function hardReset(){
    running = false; paused = false;
    btnStart.hidden = false; btnPause.hidden = true; btnResume.hidden = true; btnReset.hidden = true;
    showOverlay(true, "ブロック崩し", "左右キー / マウス / タッチ で操作");
    resizeCanvas(); draw();
  }

  function togglePause(forcePause){
    if (!running) return;
    const willPause = typeof forcePause === "boolean" ? forcePause : !paused;
    paused = willPause;
    btnPause.hidden = paused; btnResume.hidden = !paused;
    showOverlay(paused, "一時停止中…", `スコア: ${score} / レベル: ${level}`);
    if (!paused){ last = performance.now(); requestAnimationFrame(loop); }
  }

  // -------- ループ --------
  function loop(ts){
    if (!running || paused) return;
    const dt = Math.min((ts - last)/1000, 0.033);
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt){
    const w = cvs.width / DPR, h = cvs.height / DPR;

    // パドル
    if (pointerX != null){
      const target = Math.max(0, Math.min(w - paddle.w, pointerX - paddle.w/2));
      paddle.x += (target - paddle.x) * Math.min(1, dt * 12);
    } else {
      if (keys.left)  paddle.x -= paddle.speed * dt;
      if (keys.right) paddle.x += paddle.speed * dt;
      paddle.x = Math.max(0, Math.min(w - paddle.w, paddle.x));
    }

    // ボール
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;

    // 壁
    if (ball.x - ball.r < 0){ ball.x = ball.r; ball.vx *= -1; }
    if (ball.x + ball.r > w){ ball.x = w - ball.r; ball.vx *= -1; }
    if (ball.y - ball.r < 0){ ball.y = ball.r; ball.vy *= -1; }

    // パドル衝突
    if (rectCircleCollide(paddle, ball)){
      const hit = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2); // -1〜1
      const angle = clamp(hit, -0.95, 0.95) * (Math.PI/3);           // ±60°
      const speed = Math.hypot(ball.vx, ball.vy) * 1.02;
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.abs(Math.cos(angle) * speed);
      ball.y = paddle.y - ball.r - 0.1;
    }

    // ブロック衝突
    for (let i = bricks.length - 1; i >= 0; i--){
      const b = bricks[i]; if (b.hp <= 0) continue;
      if (rectCircleCollide(b, ball)){
        // 当たった面をだいたいで判断
        const prevX = ball.x - ball.vx*dt, prevY = ball.y - ball.vy*dt;
        const fromX = prevX < b.x || prevX > b.x + b.w;
        const fromY = prevY < b.y || prevY > b.y + b.h;
        if (fromX) ball.vx *= -1;
        if (fromY) ball.vy *= -1;
        b.hp -= 1; score += 10;
      }
    }

    // 落下
    if (ball.y - ball.r > h){
      lives -= 1; updateHUD();
      if (lives <= 0){ return gameOver(false); }
      resetBallAndPaddle();
    }

    // クリア
    if (bricks.every(b => b.hp <= 0)){
      level += 1; score += 100; updateHUD();
      buildLevel(level, w); resetBallAndPaddle();
    }
  }

  function draw(){
    const w = cvs.width / DPR, h = cvs.height / DPR;

    // 背景
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,"#081029"); g.addColorStop(1,"#0b1436");
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

    // ブロック
    for (const b of bricks){
      if (b.hp <= 0) continue;
      ctx.fillStyle = b.color; ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(b.x,b.y,b.w,4);
    }

    // パドル
    roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fillStyle = "#27d3a2"; ctx.fill();

    // ボール
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.closePath();
    ctx.fillStyle = "#3f82ff"; ctx.fill();

    // ほんのりグロー
    ctx.globalAlpha = 0.08; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r*5, 0, Math.PI*2);
    ctx.fillStyle = "#3f82ff"; ctx.fill(); ctx.globalAlpha = 1;
  }

  // -------- ユーティリティ --------
  function rectCircleCollide(rect, c){
    const cx = clamp(c.x, rect.x, rect.x + rect.w);
    const cy = clamp(c.y, rect.y, rect.y + rect.h);
    const dx = c.x - cx, dy = c.y - cy;
    return dx*dx + dy*dy <= c.r*c.r;
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w,y, x+w,y+h, r);
    ctx.arcTo(x+w,y+h, x,y+h, r);
    ctx.arcTo(x,y+h, x,y, r);
    ctx.arcTo(x,y, x+w,y, r);
    ctx.closePath();
  }

  function gameOver(cleared){
    running = false; paused = false;
    btnStart.hidden = false; btnPause.hidden = true; btnResume.hidden = true; btnReset.hidden = false;
    showOverlay(true, cleared ? "クリア！" : "ゲームオーバー", `スコア: ${score} / レベル: ${level}`);
  }

  // 初期表示
  resizeCanvas();
  showOverlay(true, "ブロック崩し", "左右キー / マウス / タッチ で操作");
  draw();
})();
