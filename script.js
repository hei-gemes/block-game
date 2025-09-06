// Phaser 3 プロト：ブロック崩し（iPhoneスワイプ対応 / HUD / クリア＆ゲームオーバー）
// ここから増築して「3択アイテム」「ドロップ」「マップ分岐」「ボス」へ拡張できます。

(() => {
  // ========= DOM参照（HUD / ボタン / スワイプゾーン） =========
  const hud = {
    score: document.getElementById("score"),
    lives: document.getElementById("lives"),
    stage: document.getElementById("stage"),
    elapsed: document.getElementById("elapsed"),
  };
  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const touchZone = document.getElementById("touchZone");

  // ========= 定数 =========
  const VIEW_W = 800;
  const VIEW_H = 1000;

  const GameState = {
    INIT: "INIT",
    READY: "READY",
    PLAY: "PLAY",
    PAUSE: "PAUSE",
    CLEAR: "CLEAR",
    OVER: "OVER",
  };

  // ========= ゲーム全体ステート =========
  let state = GameState.INIT;
  let score = 0;
  let lives = 3;
  let stage = 1;
  let runStartMs = 0;

  // ========= 入力（スワイプで狙うX座標） =========
  let targetX = VIEW_W / 2;

  // ========= Phaser コンフィグ =========
  const config = {
    type: Phaser.AUTO,
    parent: "gameParent",
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: "#0b0f15",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [MainScene]
  };

  const game = new Phaser.Game(config);

  // ========= シーン定義 =========
  function MainScene() {
    Phaser.Scene.call(this, { key: "MainScene" });
  }
  MainScene.prototype = Object.create(Phaser.Scene.prototype);
  MainScene.prototype.constructor = MainScene;

  MainScene.prototype.preload = function () {
    // 画像アセットを使う場合はここで読み込み
    // 今はシェイプ描画中心なので不要
  };

  MainScene.prototype.create = function () {
    const scene = this;

    // ワールド境界（ボールが下に抜けてもイベントで処理するので、collideWorldBoundsは上左右のみ有効）
    scene.physics.world.setBounds(0, 0, VIEW_W, VIEW_H);

    // パドル
    scene.paddle = scene.add.rectangle(VIEW_W / 2, VIEW_H - 140, 140, 18, 0x4fc3f7).setOrigin(0.5);
    scene.physics.add.existing(scene.paddle, true); // 静的ボディ（動かす時はsetXで）

    // ボール
    scene.ball = scene.add.circle(VIEW_W / 2, VIEW_H / 2 + 120, 10, 0xe3f2fd);
    scene.physics.add.existing(scene.ball);
    scene.ball.body.setCollideWorldBounds(true, 1, 1);
    scene.ball.body.onWorldBounds = true; // worldboundsイベント受け取り
    scene.ballStuck = true; // スタートまでパドルに吸着

    // ブロック（グループ）
    scene.bricks = scene.physics.add.staticGroup();
    setupBricks(scene);

    // 物理衝突
    scene.physics.add.collider(scene.ball, scene.paddle, onHitPaddle, null, scene);
    scene.physics.add.collider(scene.ball, scene.bricks, onHitBrick, null, scene);

    // 下抜け判定（WorldBounds）：下に抜けたらライフ減少
    scene.physics.world.on("worldbounds", (body, up, down) => {
      if (down) {
        onBallFall(scene);
      }
    });

    // 画面メッセージ
    scene.message = scene.add.text(VIEW_W / 2, VIEW_H / 2, "タップまたは▶︎で開始", {
      fontSize: "28px",
      color: "#cbd6e2",
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial'
    }).setOrigin(0.5);

    // Canvas上のタップでも開始
    scene.input.on("pointerdown", () => {
      if (state === GameState.READY) startOrRestart(scene);
    });

    // DOMボタン
    btnStart.addEventListener("click", () => {
      if (state === GameState.CLEAR) {
        nextStage(scene);
      } else {
        startOrRestart(scene);
      }
    });
    btnPause.addEventListener("click", () => pauseToggle(scene));

    // スワイプゾーン（iPhone想定）
    bindTouchZone();

    // PCマウス用：キャンバス上でのマウス移動もOK
    scene.input.on("pointermove", (pointer) => {
      // pointer.x/y は画面スケール後座標。パドルのローカルXへそのまま利用可
      targetX = Phaser.Math.Clamp(pointer.x, 0, VIEW_W);
    });

    // 初期化
    hardReset(scene);
    scene.time.addEvent({
      delay: 100, loop: true,
      callback: () => updateHUDElapsed()
    });
  };

  MainScene.prototype.update = function () {
    const scene = this;
    if (state !== GameState.PLAY) {
      // 吸着中はパドルの上にボールを追従
      if (scene.ballStuck) {
        stickBallToPaddle(scene);
      }
      return;
    }

    // パドルをtargetXに追従（速度制限）
    const speed = 12;
    const dx = targetX - scene.paddle.x;
    const step = Phaser.Math.Clamp(dx, -speed, speed);
    scene.paddle.x = Phaser.Math.Clamp(scene.paddle.x + step, scene.paddle.width / 2, VIEW_W - scene.paddle.width / 2);
    scene.paddle.body.updateFromGameObject();

    // 吸着中なら追従
    if (scene.ballStuck) {
      stickBallToPaddle(scene);
    }

    // ステージクリア判定
    if (isStageCleared(scene)) {
      state = GameState.CLEAR;
      scene.message.setText("ステージクリア！ ▶︎で次へ");
      scene.message.setVisible(true);
      scene.ball.body.setVelocity(0, 0);
      scene.ballStuck = true;
    }
  };

  // ========= ユーティリティ & ロジック =========
  function setupBricks(scene) {
    // レイアウト計算
    const rows = 6;
    const cols = 10;
    const padX = 16, padY = 20;
    const mTop = 120, mSide = 20;
    const w = Math.floor((VIEW_W - mSide * 2 - padX * (cols - 1)) / cols);
    const h = 28;

    scene.bricks.clear(true, true);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = mSide + c * (w + padX) + w / 2;
        const y = mTop + r * (h + padY) + h / 2;
        const color = (r >= 4) ? 0xff7043 : (r >= 2 ? 0xffd54f : 0x9ccc65);
        const rect = scene.add.rectangle(x, y, w, h, color).setStrokeStyle(2, 0x1a1f28);
        const brick = scene.bricks.add(rect);
        brick.hp = 1 + Math.floor(r / 2); // 下ほどHP高め
      }
    }
    scene.bricks.refresh();
  }

  function onHitPaddle(ball, paddle) {
    const scene = this;
    // 衝突点ベースで角度変化
    const rel = (ball.x - paddle.x) / (paddle.width / 2); // -1~1
    const angle = Phaser.Math.DegToRad(rel * 60); // 最大60度
    const speed = Math.min(Math.hypot(ball.body.velocity.x, ball.body.velocity.y) * 1.02, 600);

    ball.body.setVelocity(
      Math.sin(angle) * speed,
      -Math.abs(Math.cos(angle) * speed)
    );
  }

  function onHitBrick(ball, brick) {
    const scene = this;
    // HP制
    brick.hp -= 1;
    if (brick.hp <= 0) {
      brick.destroy(true);
      score += 10;
    } else {
      score += 2;
      // 色段階を簡易更新（任意）
      brick.fillColor = (brick.hp >= 3) ? 0xff7043 : (brick.hp === 2 ? 0xffd54f : 0x9ccc65);
    }
    hud.score.textContent = score;
  }

  function onBallFall(scene) {
    if (state !== GameState.PLAY && state !== GameState.READY) return;
    // 画面下に落下
    lives -= 1;
    hud.lives.textContent = lives;

    if (lives <= 0) {
      state = GameState.OVER;
      scene.message.setText("ゲームオーバー ▶︎で再スタート");
      scene.message.setVisible(true);
      scene.ball.body.setVelocity(0, 0);
      scene.ballStuck = true;
    } else {
      // 再開用に吸着
      scene.ballStuck = true;
      stickBallToPaddle(scene);
      scene.ball.body.setVelocity(0, 0);
    }
  }

  function stickBallToPaddle(scene) {
    scene.ball.x = scene.paddle.x;
    scene.ball.y = scene.paddle.y - (scene.ball.radius + 2);
  }

  function isStageCleared(scene) {
    // すべて破壊済みならtrue
    let alive = 0;
    scene.bricks.children.iterate(b => { if (b && b.active) alive++; });
    return alive === 0;
  }

  function hardReset(scene) {
    score = 0;
    lives = 3;
    stage = 1;
    hud.score.textContent = score;
    hud.lives.textContent = lives;
    hud.stage.textContent = stage;
    runStartMs = performance.now();

    // 初期配置
    scene.paddle.setSize(140, 18);
    scene.paddle.setPosition(VIEW_W / 2, VIEW_H - 140);
    scene.paddle.body.updateFromGameObject();

    scene.ball.setPosition(VIEW_W / 2, VIEW_H / 2 + 120);
    scene.ball.body.setVelocity(0, 0);
    scene.ball.body.setBounce(1, 1);
    scene.ball.body.setCollideWorldBounds(true, 1, 1);

    setupBricks(scene);

    state = GameState.READY;
    scene.ballStuck = true;
    scene.message.setText("タップまたは▶︎で開始");
    scene.message.setVisible(true);
  }

  function startOrRestart(scene) {
    if (state === GameState.PLAY) return;

    if (state === GameState.INIT) {
      hardReset(scene);
    } else if (state === GameState.OVER) {
      hardReset(scene);
    }

    state = GameState.PLAY;
    scene.message.setVisible(false);
    scene.ballStuck = false;
    // 初速
    const vx = Phaser.Math.RND.sign() * 260;
    const vy = -360;
    scene.ball.body.setVelocity(vx, vy);
    runStartMs = performance.now();
  }

  function pauseToggle(scene) {
    if (state === GameState.PLAY) {
      state = GameState.PAUSE;
      scene.physics.world.pause();
      scene.message.setText("一時停止中");
      scene.message.setVisible(true);
    } else if (state === GameState.PAUSE) {
      state = GameState.PLAY;
      scene.physics.world.resume();
      scene.message.setVisible(false);
    }
  }

  function nextStage(scene) {
    stage += 1;
    hud.stage.textContent = stage;

    // パドル・ボールリセット＆ブロック再生成（難易度は後で調整）
    setupBricks(scene);
    scene.paddle.setPosition(VIEW_W / 2, VIEW_H - 140);
    scene.paddle.body.updateFromGameObject();

    scene.ball.setPosition(scene.paddle.x, scene.paddle.y - (scene.ball.radius + 2));
    scene.ball.body.setVelocity(0, 0);
    state = GameState.READY;
    scene.ballStuck = true;
    scene.message.setText("▶︎で次ステージ開始");
    scene.message.setVisible(true);
  }

  function bindTouchZone() {
    // iPhoneのスワイプゾーン。左右移動にのみ使う（ページスクロール抑制）
    const onDown = (e) => {
      e.preventDefault();
      const x = pageToLocalX(e);
      if (x != null) targetX = x;
    };
    const onMove = (e) => {
      e.preventDefault();
      const x = pageToLocalX(e);
      if (x != null) targetX = x;
    };
    const onUp = (e) => {
      e.preventDefault();
    };

    ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerleave"].forEach(type => {
      touchZone.addEventListener(type, (e) => {
        if (type === "pointerdown") onDown(e);
        else if (type === "pointermove") onMove(e);
        else onUp(e);
      }, { passive: false });
    });
  }

  function pageToLocalX(e) {
    // gameParentの見た目幅→ゲーム座標（VIEW_W）へ変換
    const parent = document.getElementById("gameParent");
    const rect = parent.getBoundingClientRect();
    const px = (e.clientX ?? (e.touches && e.touches[0]?.clientX));
    if (px == null) return null;
    const ratio = VIEW_W / rect.width;
    return Phaser.Math.Clamp((px - rect.left) * ratio, 0, VIEW_W);
  }

  function updateHUDElapsed() {
    if (state === GameState.PLAY || state === GameState.READY) {
      const sec = Math.max(0, Math.floor((performance.now() - runStartMs) / 1000));
      hud.elapsed.textContent = formatTime(sec);
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
})();
