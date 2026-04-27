declare const io: any;
const socket = io("http://localhost:3000");

const SETTINGS = {
  BOARD_WIDTH: 1200,
  BOARD_HEIGHT: 1200,
  CELL_SIZE: 40,
  TICK_RATE: 10,
};

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = SETTINGS.BOARD_WIDTH;
canvas.height = SETTINGS.BOARD_HEIGHT;

let playerId: string = "";
let apples: any[] = [];
let players: any[] = [];
let currentDirection: string = "";
let isReady = false;
const oppositeDir: Record<string, string> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const readyButton = document.getElementById(
  "ready-button",
) as HTMLButtonElement | null;
const statusText = document.getElementById("status-text") as HTMLElement | null;
const gameOverModal = document.getElementById(
  "game-over-modal",
) as HTMLElement | null;
const gameOverCard = document.getElementById(
  "game-over-card",
) as HTMLElement | null;
const gameOverTitle = document.getElementById(
  "game-over-title",
) as HTMLElement | null;
const gameOverMessage = document.getElementById(
  "game-over-message",
) as HTMLElement | null;
const restartButton = document.getElementById(
  "restart-button",
) as HTMLButtonElement | null;

if (readyButton) {
  readyButton.addEventListener("click", () => {
    isReady = !isReady;
    readyButton.textContent = isReady ? "Cancel Ready" : "Ready";
    readyButton.classList.toggle("ready", isReady);
    socket.emit("player_ready", { ready: isReady });
    if (statusText) {
      statusText.textContent = isReady
        ? "Ready. Waiting for other player..."
        : "Waiting for players...";
    }
  });
}

if (restartButton) {
  restartButton.addEventListener("click", () => {
    window.location.reload();
  });
}

function showGameOver(isWinner: boolean | null) {
  if (!gameOverModal || !gameOverCard || !gameOverTitle || !gameOverMessage)
    return;

  if (isWinner === null) {
    gameOverTitle.textContent = "Draw!";
    gameOverMessage.textContent =
      "Both snakes reached the minimum length. Try again.";
    gameOverCard.classList.remove("win", "lose");
  } else {
    gameOverTitle.textContent = isWinner ? "Victory!" : "Defeat";
    gameOverMessage.textContent = isWinner
      ? "You won the match. Great job!"
      : "The other snake won this round. Try again!";
    gameOverCard.classList.toggle("win", isWinner);
    gameOverCard.classList.toggle("lose", !isWinner);
  }

  gameOverModal.classList.remove("hidden");
}

function hideGameOver() {
  if (!gameOverModal || !gameOverCard) return;
  gameOverModal.classList.add("hidden");
  gameOverCard.classList.remove("win", "lose");
}

function draw() {
  if (!ctx) return;

  drawBackground();
  drawApples();
  drawPlayers();

  updateScoreboard();
}

function drawBackground() {
  for (let row = 0; row < SETTINGS.BOARD_HEIGHT / SETTINGS.CELL_SIZE; row++) {
    for (let col = 0; col < SETTINGS.BOARD_WIDTH / SETTINGS.CELL_SIZE; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#AAD751" : "#A2D149";
      ctx.fillRect(
        col * SETTINGS.CELL_SIZE,
        row * SETTINGS.CELL_SIZE,
        SETTINGS.CELL_SIZE,
        SETTINGS.CELL_SIZE,
      );
    }
  }
}

function drawApples() {
  apples.forEach((apple) => {
    const appleRadius = 16;
    const type = apple.type || "normal";

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.arc(apple.pos.x, apple.pos.y + 4, appleRadius, 0, Math.PI * 2);
    ctx.fill();

    let fillColor = "#e74c3c";
    let bodyColor = "#4a2c00";
    let leafColor = "#2ecc71";

    if (type === "golden") {
      fillColor = "#f6c343";
      bodyColor = "#b57b00";
      leafColor = "#f8e77e";
    } else if (type === "blue") {
      fillColor = "#3498db";
      bodyColor = "#206b95";
      leafColor = "#83c5ea";
    } else if (type === "green") {
      fillColor = "#2ecc71";
      bodyColor = "#1f7a4d";
      leafColor = "#a8f0c6";
    }

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(apple.pos.x, apple.pos.y, appleRadius, 0, Math.PI * 2);
    ctx.fill();

    if (type === "golden") {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(apple.pos.x, apple.pos.y, appleRadius - 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(apple.pos.x - 6, apple.pos.y - 6, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bodyColor;
    ctx.fillRect(apple.pos.x - 2, apple.pos.y - appleRadius - 4, 4, 8);

    ctx.fillStyle = leafColor;
    ctx.beginPath();
    ctx.ellipse(
      apple.pos.x + 6,
      apple.pos.y - appleRadius - 2,
      6,
      3,
      Math.PI / 4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
}

function drawPlayers() {
  players.forEach((player) => {
    if (!player.body || player.body.length === 0) return;

    const color = player._color || "blue";
    const radius = SETTINGS.CELL_SIZE / 2 - 5;

    player.body.forEach((segment: any, idx: number) => {
      const next = player.body[idx + 1];

      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (next) {
        const dx = Math.abs(segment.x - next.x);
        const dy = Math.abs(segment.y - next.y);
        if (dx < SETTINGS.CELL_SIZE * 1.5 && dy < SETTINGS.CELL_SIZE * 1.5) {
          ctx.beginPath();
          ctx.lineWidth = radius * 2;
          ctx.lineCap = "round";
          ctx.strokeStyle = color;
          ctx.moveTo(segment.x, segment.y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }
      }

      if (idx === 0) {
        drawEyes(segment.x, segment.y, player.direction);
      }
    });
  });
}

function drawEyes(x: number, y: number, dir: string) {
  const eyeSize = 5;
  const eyeSpacing = 9;
  let e1 = { x: 0, y: 0 },
    e2 = { x: 0, y: 0 };

  if (dir === "up" || dir === "down") {
    e1 = { x: x - eyeSpacing, y: y };
    e2 = { x: x + eyeSpacing, y: y };
  } else {
    e1 = { x: x, y: y - eyeSpacing };
    e2 = { x: x, y: y + eyeSpacing };
  }

  ctx.fillStyle = "white";
  [e1, e2].forEach((e) => {
    ctx.beginPath();
    ctx.arc(e.x, e.y, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(e.x, e.y, eyeSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
  });
}

function updateScoreboard() {
  const scoreboard = document.getElementById("player-list");
  if (!scoreboard) return;
  scoreboard.innerHTML = "";

  if (players.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Waiting for players...";
    scoreboard.appendChild(li);
    return;
  }

  players.forEach((player) => {
    const li = document.createElement("li");
    li.style.color = player._color || "blue";
    const readyLabel = player.isReady ? "Ready" : "Not ready";
    const aliveLabel = player.isAlive ? "Alive" : "Dead";
    const speedLabel = player.speed ? `Speed: ${player.speed}` : "Speed: 1";
    li.textContent = `Player: ${player._id.substring(0, 5)} (Length: ${player.length}) - ${readyLabel} - ${aliveLabel} - ${speedLabel}`;
    scoreboard.appendChild(li);
  });
}

const sysncPlayerData = (data: any[]) => {
  players = data.map((p) => ({
    _id: p._id || p.id,
    _color: p._color || p.color,
    pos: p._pos || p.pos,
    body: p._body || p.body,
    length: p._length || p.length,
    speed: p._speed || p.speed || 1,
    direction: p._direction || p.direction,
    isReady: p._isReady || p.isReady || false,
    isAlive: p.isAlive,
  }));
};

socket.on("send_player_data", sysncPlayerData);

socket.on("player_moved", sysncPlayerData);

socket.on("connect", () => {
  playerId = socket.id;
});

socket.on("send_apple_data", (data: any) => {
  apples = data;
});

socket.on("game_started", () => {
  if (statusText) {
    statusText.textContent = "Game started!";
  }
  if (readyButton) {
    readyButton.disabled = true;
    readyButton.classList.remove("ready");
  }
  hideGameOver();
});

socket.on("game_over", (data: { winnerId: string | null }) => {
  const isWinner = data.winnerId === playerId;
  const isDraw = data.winnerId === null;
  showGameOver(isDraw ? null : isWinner);
  if (readyButton) {
    readyButton.disabled = true;
  }
});

function gameLoop() {
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();

setInterval(() => {
  const me = players.find((p) => p._id === playerId);
  if (!me || !me.pos || apples.length === 0) return;

  let closestApple = apples[0];
  let bestDist = Infinity;

  apples.forEach((a) => {
    const d = Math.hypot(me.pos.x - a.pos.x, me.pos.y - a.pos.y);
    if (d < bestDist) {
      bestDist = d;
      closestApple = a;
    }
  });

  let nextDir = currentDirection;
  const dx = closestApple.pos.x - me.pos.x;
  const dy = closestApple.pos.y - me.pos.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    nextDir = dx > 0 ? "right" : "left";
  } else {
    nextDir = dy > 0 ? "down" : "up";
  }

  if (
    nextDir !== currentDirection &&
    nextDir !== oppositeDir[currentDirection]
  ) {
    currentDirection = nextDir;
    socket.emit("move_player", { direction: currentDirection });
  }
}, 150);
