declare const io: any;
const socket = io("http://localhost:3000");

const SETTINGS = {
  BOARD_WIDTH: 800,
  BOARD_HEIGHT: 800,
  CELL_SIZE: 40,
  TICK_RATE: 10,
};

type Direction = "up" | "down" | "left" | "right";

class Player {
  private _id: string;
  private _color: string;
  private _pos: { x: number; y: number };
  private _body: { x: number; y: number }[];
  private _length: number;
  private _speed: number = 1;
  private _direction: string = "";

  constructor(
    id: string,
    color: string,
    pos: { x: number; y: number },
    initialLength: number = 5,
  ) {
    this._id = id;
    this._color = color;
    this._pos = pos;
    this._length = initialLength;
    this._body = Array.from({ length: this._length }, () => ({
      x: pos.x,
      y: pos.y,
    }));
  }

  public movePlayer(
    dx: number,
    dy: number,
    boardWidth: number,
    boardHeight: number,
  ): { x: number; y: number }[] {
    const visited: { x: number; y: number }[] = [];
    const margin = 20;
    const step = Math.max(1, Math.floor(this._speed));
    let nextX = this._pos.x;
    let nextY = this._pos.y;

    for (let i = 0; i < step; i++) {
      nextX += dx;
      nextY += dy;

      if (
        nextX < margin ||
        nextX > boardWidth - margin ||
        nextY < margin ||
        nextY > boardHeight - margin
      ) {
        this.applyDamage();
        this.autoTurn(boardWidth, boardHeight);
        this.addBodySegment({ x: this._pos.x, y: this._pos.y });
        return visited;
      }

      this._pos.x = nextX;
      this._pos.y = nextY;
      this.addBodySegment({ x: this._pos.x, y: this._pos.y });
      visited.push({ x: this._pos.x, y: this._pos.y });
    }

    return visited;
  }

  public autoTurn(width: number, height: number) {
    const possibleDirs: Direction[] = [];
    const margin = 20;

    if (this._pos.y > margin) possibleDirs.push("up");
    if (this._pos.y < height - margin) possibleDirs.push("down");
    if (this._pos.x > margin) possibleDirs.push("left");
    if (this._pos.x < width - margin) possibleDirs.push("right");

    const opposite: Record<Direction, Direction> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };

    const validChoices = possibleDirs.filter(
      (d) => d !== opposite[this._direction as Direction],
    );

    if (validChoices.length > 0) {
      this._direction =
        validChoices[Math.floor(Math.random() * validChoices.length)];
    }
  }

  public addBodySegment(pos: { x: number; y: number }) {
    this._body.unshift({ x: pos.x, y: pos.y });
    while (this._body.length > this._length) {
      this._body.pop();
    }
  }

  public grow(amount: number = 1) {
    this._length += amount;
  }

  public increaseSpeed() {
    this._speed += 1;
  }

  public applyDamage() {
    if (this._length > 2) {
      this._length -= 1;
    }
  }

  public isAlive(): boolean {
    return this._length > 2;
  }

  public get id(): string {
    return this._id;
  }

  public get color(): string {
    return this._color;
  }

  public get pos(): { x: number; y: number } {
    return this._pos;
  }

  public get body(): { x: number; y: number }[] {
    return this._body;
  }

  public get length(): number {
    return this._length;
  }

  public get direction(): string {
    return this._direction;
  }
  public set direction(value: string) {
    this._direction = value;
  }

  public get speed(): number {
    return this._speed;
  }
}

/**
 * Find the best direction to move toward a target using BFS pathfinding
 */
function findPathToTarget(
  startPos: { x: number; y: number },
  targetPos: { x: number; y: number },
  boardWidth: number,
  boardHeight: number,
  cellSize: number,
  obstacles: { x: number; y: number }[],
  currentDirection: string
): string | null {
  const margin = 20;
  const directions = ["up", "down", "left", "right"];
  const opposites: Record<string, string> = { up: "down", down: "up", left: "right", right: "left" };
  
  const startGrid = { x: Math.round(startPos.x / cellSize), y: Math.round(startPos.y / cellSize) };
  const targetGrid = { x: Math.round(targetPos.x / cellSize), y: Math.round(targetPos.y / cellSize) };
  
  const obstacleSet = new Set(obstacles.map(o => `${Math.round(o.x / cellSize)},${Math.round(o.y / cellSize)}`));
  
  const queue: Array<{ grid: { x: number; y: number }; direction: string }> = [];
  const visited = new Set<string>();
  
  queue.push({ grid: startGrid, direction: "" });
  visited.add(`${startGrid.x},${startGrid.y}`);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const { grid, direction: pathDirection } = current;
    
    if (grid.x === targetGrid.x && grid.y === targetGrid.y) {
      return pathDirection || "up";
    }
    
    for (const dir of directions) {
      if (currentDirection && dir === opposites[currentDirection]) {
        continue;
      }
      
      let nextGrid = { ...grid };
      switch (dir) {
        case "up":
          nextGrid.y -= 1;
          break;
        case "down":
          nextGrid.y += 1;
          break;
        case "left":
          nextGrid.x -= 1;
          break;
        case "right":
          nextGrid.x += 1;
          break;
      }
      
      const gridKey = `${nextGrid.x},${nextGrid.y}`;
      
      if (visited.has(gridKey)) continue;
      if (obstacleSet.has(gridKey)) continue;
      
      const pixelX = nextGrid.x * cellSize;
      const pixelY = nextGrid.y * cellSize;
      if (pixelX < margin || pixelX > boardWidth - margin || pixelY < margin || pixelY > boardHeight - margin) {
        continue;
      }
      
      visited.add(gridKey);
      const nextDirection = pathDirection || dir;
      queue.push({ grid: nextGrid, direction: nextDirection });
    }
  }
  
  return null;
}

const oppositeDir: Record<string, string> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = SETTINGS.BOARD_WIDTH;
canvas.height = SETTINGS.BOARD_HEIGHT;

let playerId: string = "";
let apples: any[] = [];
let remotePlayer: any = null;
let localPlayer: Player | null = null;
let isReady = false;
let gameStarted = false;
let focusView = false;
const CAMERA_SCALE = 1.7;
const opponents: Record<string, string> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const readyButton = document.getElementById(
  "ready-button",
) as HTMLButtonElement | null;
const playerIdText = document.getElementById("player-id-text") as HTMLElement | null;
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
const historyButton = document.getElementById(
  "history-button",
) as HTMLButtonElement | null;
const focusButton = document.getElementById(
  "focus-button",
) as HTMLButtonElement | null;
const historyModal = document.getElementById(
  "history-modal",
) as HTMLElement | null;
const historyContent = document.getElementById(
  "history-content",
) as HTMLElement | null;
const closeHistoryButton = document.getElementById(
  "close-history-button",
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

if (historyButton) {
  historyButton.addEventListener("click", openHistoryModal);
}

if (focusButton) {
  focusButton.addEventListener("click", () => {
    focusView = !focusView;
    if (focusButton) {
      focusButton.textContent = focusView ? "Exit focus view" : "Focus on snake";
    }
  });
}

if (closeHistoryButton) {
  closeHistoryButton.addEventListener("click", hideHistoryModal);
}

function hideHistoryModal() {
  if (!historyModal) return;
  historyModal.classList.add("hidden");
}

async function openHistoryModal() {
  if (!historyModal || !historyContent) return;

  historyContent.textContent = "Loading match history...";
  historyModal.classList.remove("hidden");

  try {
    const response = await fetch("http://localhost:3000/matches");
    if (!response.ok) {
      throw new Error("Failed to load matches");
    }

    const matches = await response.json();
    if (!Array.isArray(matches) || matches.length === 0) {
      historyContent.textContent = "No matches recorded yet.";
      return;
    }

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    ["ID", "Player 1", "Player 2", "Winner"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    matches.forEach((match: any) => {
      const row = document.createElement("tr");
      [
        match.ID,
        match.Player_1_ID?.substring(0, 5) || "",
        match.Player_2_ID?.substring(0, 5) || "",
        match.Winner_Player_ID ? match.Winner_Player_ID.substring(0, 5) : "Draw",
      ].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        row.appendChild(td);
      });
      table.appendChild(row);
    });

    historyContent.innerHTML = "";
    historyContent.appendChild(table);
  } catch (error) {
    historyContent.textContent = "Unable to load match history.";
  }
}

function updatePlayerIdText() {
  if (!playerIdText) return;
  const displayId = playerId ? playerId.substring(0, 5) : "connecting...";
  const color = localPlayer?.color || "#eef2f7";
  playerIdText.textContent = playerId
    ? `Player ID: ${displayId}`
    : "Player ID: connecting...";
  playerIdText.style.color = color;
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

  applyCameraTransform();
  drawBackground();
  drawApples();
  drawPlayers();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  updateScoreboard();
}

function applyCameraTransform() {
  if (!focusView || !localPlayer) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return;
  }

  const x = localPlayer.pos.x;
  const y = localPlayer.pos.y;
  const scale = CAMERA_SCALE;
  const offsetX = canvas.width / 2 - x * scale;
  const offsetY = canvas.height / 2 - y * scale;
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
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
  const playersToDisplay = [];
  if (localPlayer) playersToDisplay.push(localPlayer);
  if (remotePlayer) playersToDisplay.push(remotePlayer);
  
  playersToDisplay.forEach((player) => {
    if (!player.body || player.body.length === 0) return;

    const color = player._color || player.color || "blue";
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
        drawEyes(segment.x, segment.y, player._direction || player.direction);
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

  if (!localPlayer && !remotePlayer) {
    const li = document.createElement("li");
    li.textContent = "Waiting for players...";
    scoreboard.appendChild(li);
    return;
  }

  [localPlayer, remotePlayer].forEach((player) => {
    if (!player) return;
    const li = document.createElement("li");
    li.style.color = player._color || player.color || "blue";
    const aliveLabel = player.isAlive ? "Alive" : "Dead";
    const speedLabel = player._speed ? `Speed: ${player._speed}` : player.speed ? `Speed: ${player.speed}` : "Speed: 1";
    li.textContent = `Player: ${player.id?.substring(0, 5) || playerId?.substring(0, 5)} (Length: ${player.length}) - ${aliveLabel} - ${speedLabel}`;
    scoreboard.appendChild(li);
  });
}

socket.on("connect", () => {
  playerId = socket.id;
  updatePlayerIdText();
});

socket.on("player_moved", (playerStates: any[]) => {
  playerStates.forEach((state) => {
    if (state.id === playerId) {
      // Initialize localPlayer on first update if not exists
      if (!localPlayer) {
        localPlayer = new Player(
          state.id,
          state.color,
          state.pos,
          state.length,
        );
        localPlayer.direction = state.direction;
        // Restore body
        localPlayer["_body"] = state.body;
        localPlayer["_speed"] = state.speed;
      }
    } else {
      // Store remote player
      remotePlayer = state;
    }
  });
});

socket.on("send_apple_data", (data: any) => {
  apples = data;
});

socket.on("game_started", () => {
  gameStarted = true;
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
  gameStarted = false;
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

// Game update loop - runs at TICK_RATE and handles local movement
setInterval(() => {
  if (!gameStarted || !localPlayer || apples.length === 0) return;

  // Find closest apple
  let closestApple = apples[0];
  let bestDist = Infinity;
  apples.forEach((a) => {
    const d = Math.hypot(localPlayer!.pos.x - a.pos.x, localPlayer!.pos.y - a.pos.y);
    if (d < bestDist) {
      bestDist = d;
      closestApple = a;
    }
  });

  // Get all obstacles (remote player body)
  const obstacles = remotePlayer?.body || [];

  // Use pathfinding to find best direction
  const pathDirection = findPathToTarget(
    localPlayer.pos,
    closestApple.pos,
    SETTINGS.BOARD_WIDTH,
    SETTINGS.BOARD_HEIGHT,
    SETTINGS.CELL_SIZE,
    obstacles,
    localPlayer.direction
  );

  if (pathDirection && pathDirection !== opponents[localPlayer.direction]) {
    localPlayer.direction = pathDirection;
  }

  // Move the player
  let dx = 0, dy = 0;
  switch (localPlayer.direction) {
    case "up":
      dy = -SETTINGS.CELL_SIZE;
      break;
    case "down":
      dy = SETTINGS.CELL_SIZE;
      break;
    case "left":
      dx = -SETTINGS.CELL_SIZE;
      break;
    case "right":
      dx = SETTINGS.CELL_SIZE;
      break;
  }

  localPlayer.movePlayer(dx, dy, SETTINGS.BOARD_WIDTH, SETTINGS.BOARD_HEIGHT);

  // Send updated state to server
  socket.emit("update_snake_state", {
    pos: localPlayer.pos,
    body: localPlayer.body,
    length: localPlayer.length,
    speed: localPlayer.speed,
    direction: localPlayer.direction,
    isAlive: localPlayer.isAlive(),
  });
}, 1000 / SETTINGS.TICK_RATE);
