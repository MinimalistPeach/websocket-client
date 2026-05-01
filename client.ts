declare const io: any;
const socket = io("http://localhost:3000");

const SETTINGS = {
  BOARD_WIDTH: 800,
  BOARD_HEIGHT: 800,
  CELL_SIZE: 40,
  TICK_RATE: 10,
  MAX_LENGTH: 40,
};

type Direction = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type AppleType = "normal" | "golden" | "blue" | "green";

type Apple = {
  pos: Point;
  type?: AppleType;
};

type PlayerState = {
  id: string;
  color: string;
  pos: Point;
  body: Point[];
  length: number;
  speed: number;
  direction: Direction | "";
  isAlive: boolean;
};

class Player {
  private _id: string;
  private _color: string;
  private _pos: Point;
  private _body: Point[];
  private _length: number;
  private _baseSpeed: number = 1;
  private _temporarySpeedBonus: number = 0;
  private _temporarySpeedUntil: number = 0;
  private _direction: string = "";

  constructor(
    id: string,
    color: string,
    pos: Point,
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
  ): Point[] {
    const visited: Point[] = [];
    const margin = 20;
    this.updateTimedEffects();
    const step = Math.max(1, Math.floor(this._baseSpeed + this._temporarySpeedBonus));
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
        this.kill();
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

  public addBodySegment(pos: Point) {
    this._body.unshift({ x: pos.x, y: pos.y });
    while (this._body.length > this._length) {
      this._body.pop();
    }
  }

  public grow(amount: number = 1) {
    this._length += amount;
  }

  public kill() {
    this._length = 0;
    this._body = [{ x: this._pos.x, y: this._pos.y }];
  }

  public addTemporarySpeedBoost(amount: number, durationMs: number) {
    this._temporarySpeedBonus = amount;
    this._temporarySpeedUntil = Date.now() + durationMs;
  }

  public updateTimedEffects() {
    if (this._temporarySpeedBonus > 0 && Date.now() >= this._temporarySpeedUntil) {
      this._temporarySpeedBonus = 0;
      this._temporarySpeedUntil = 0;
    }
  }

  public applyDamage() {
    if (this._length > 2) {
      this._length -= 1;
    }
  }

  public isAlive(): boolean {
    return this._length > 0;
  }

  public hasWonByLength(): boolean {
    return this._length > SETTINGS.MAX_LENGTH;
  }

  public get id(): string {
    return this._id;
  }

  public get color(): string {
    return this._color;
  }

  public get pos(): Point {
    return this._pos;
  }

  public get body(): Point[] {
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
    this.updateTimedEffects();
    return this._baseSpeed + this._temporarySpeedBonus;
  }

  public toState(): PlayerState {
    return {
      id: this._id,
      color: this._color,
      pos: this._pos,
      body: this._body,
      length: this._length,
      speed: this.speed,
      direction: this._direction as Direction | "",
      isAlive: this.isAlive(),
    };
  }
}

function findPathToTarget(
  startPos: Point,
  targetPos: Point,
  boardWidth: number,
  boardHeight: number,
  cellSize: number,
  obstacles: Point[],
  currentDirection: Direction | "",
  dangerPoints: Point[] = [],
  dangerWeight: number = 2.5,
): Direction | null {
  const margin = 20;
  const directions: Direction[] = ["up", "down", "left", "right"];
  
  const startGrid = { x: Math.round(startPos.x / cellSize), y: Math.round(startPos.y / cellSize) };
  const targetGrid = { x: Math.round(targetPos.x / cellSize), y: Math.round(targetPos.y / cellSize) };
  
  const obstacleSet = new Set(obstacles.map(o => `${Math.round(o.x / cellSize)},${Math.round(o.y / cellSize)}`));
  
  const queue: Array<{ grid: Point; direction: Direction | ""; cost: number }> = [];
  const bestCosts = new Map<string, number>();
  
  queue.push({ grid: startGrid, direction: "", cost: 0 });
  bestCosts.set(`${startGrid.x},${startGrid.y}`, 0);
  
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const { grid, direction: pathDirection, cost } = current;
    
    if (grid.x === targetGrid.x && grid.y === targetGrid.y) {
      return pathDirection || null;
    }
    
    for (const dir of directions) {
      const isFirstStep = pathDirection === "";
      if (isFirstStep && currentDirection && dir === oppositeDir[currentDirection]) {
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
      
      if (obstacleSet.has(gridKey)) continue;
      
      const pixelX = nextGrid.x * cellSize;
      const pixelY = nextGrid.y * cellSize;
      if (pixelX < margin || pixelX > boardWidth - margin || pixelY < margin || pixelY > boardHeight - margin) {
        continue;
      }
      
      const nextDirection = pathDirection || dir;
      const dangerCost = dangerPoints.reduce((total, point) => {
        const dangerGrid = {
          x: Math.round(point.x / cellSize),
          y: Math.round(point.y / cellSize),
        };
        const distance = Math.abs(nextGrid.x - dangerGrid.x) + Math.abs(nextGrid.y - dangerGrid.y);
        if (distance === 0) return total + dangerWeight * 8;
        if (distance === 1) return total + dangerWeight * 3;
        if (distance === 2) return total + dangerWeight;
        return total;
      }, 0);
      const targetDistance = Math.abs(nextGrid.x - targetGrid.x) + Math.abs(nextGrid.y - targetGrid.y);
      const nextCost = cost + 1 + dangerCost + targetDistance * 0.05;
      const previousBest = bestCosts.get(gridKey);

      if (previousBest !== undefined && previousBest <= nextCost) continue;

      bestCosts.set(gridKey, nextCost);
      queue.push({ grid: nextGrid, direction: nextDirection, cost: nextCost });
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

function directionToDelta(direction: Direction | ""): Point {
  switch (direction) {
    case "up":
      return { x: 0, y: -SETTINGS.CELL_SIZE };
    case "down":
      return { x: 0, y: SETTINGS.CELL_SIZE };
    case "left":
      return { x: -SETTINGS.CELL_SIZE, y: 0 };
    case "right":
      return { x: SETTINGS.CELL_SIZE, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

function isInsideBoard(pos: Point): boolean {
  const margin = 20;
  return (
    pos.x >= margin &&
    pos.x <= SETTINGS.BOARD_WIDTH - margin &&
    pos.y >= margin &&
    pos.y <= SETTINGS.BOARD_HEIGHT - margin
  );
}

function gridKey(pos: Point): string {
  return `${Math.round(pos.x / SETTINGS.CELL_SIZE)},${Math.round(pos.y / SETTINGS.CELL_SIZE)}`;
}

function nextPosition(pos: Point, direction: Direction): Point {
  const delta = directionToDelta(direction);
  return {
    x: pos.x + delta.x,
    y: pos.y + delta.y,
  };
}

function chooseSafeDirection(player: Player, target: Point | null): Direction | null {
  const directions: Direction[] = ["up", "down", "left", "right"];
  const ownBody = new Set(player.body.slice(1).map(gridKey));
  const opponentBody = new Set((remotePlayer?.body || []).map(gridKey));

  const choices = directions
    .filter((direction) => {
      if (player.direction && direction === oppositeDir[player.direction]) {
        return false;
      }

      const next = nextPosition(player.pos, direction);
      const key = gridKey(next);
      return isInsideBoard(next) && !ownBody.has(key) && !opponentBody.has(key);
    })
    .map((direction) => {
      const next = nextPosition(player.pos, direction);
      const targetDistance = target
        ? Math.hypot(next.x - target.x, next.y - target.y)
        : 0;
      const dangerPenalty = (remotePlayer?.body || []).reduce((penalty, point) => {
        const distance = Math.hypot(next.x - point.x, next.y - point.y);
        if (distance < SETTINGS.CELL_SIZE * 0.75) return penalty + 800;
        if (distance < SETTINGS.CELL_SIZE * 1.75) return penalty + 180;
        return penalty;
      }, 0);

      return {
        direction,
        score: targetDistance + dangerPenalty,
      };
    })
    .sort((a, b) => a.score - b.score);

  return choices[0]?.direction || null;
}

function chooseImmediateAppleDirection(player: Player, apple: Apple | null): Direction | null {
  if (!apple) return null;

  const ownBody = new Set(player.body.slice(1).map(gridKey));
  const opponentBody = new Set((remotePlayer?.body || []).map(gridKey));
  const directions: Direction[] = ["up", "down", "left", "right"];

  for (const direction of directions) {
    const next = nextPosition(player.pos, direction);
    const reachesApple = Math.hypot(next.x - apple.pos.x, next.y - apple.pos.y) < SETTINGS.CELL_SIZE * 0.65;

    const key = gridKey(next);
    if (reachesApple && isInsideBoard(next) && !ownBody.has(key) && !opponentBody.has(key)) {
      return direction;
    }
  }

  return null;
}

function chooseNearbyAppleDirection(player: Player, apple: Apple | null): Direction | null {
  if (!apple) return null;

  const distanceToApple = Math.hypot(player.pos.x - apple.pos.x, player.pos.y - apple.pos.y);
  if (distanceToApple > SETTINGS.CELL_SIZE * 1.75) return null;

  return chooseSafeDirection(player, apple.pos);
}

function chooseImmediateAppleTarget(player: Player, availableApples: Apple[]): Apple | null {
  let bestApple: Apple | null = null;
  let bestDistance = Infinity;

  availableApples.forEach((apple) => {
    const direction = chooseImmediateAppleDirection(player, apple);
    if (!direction) return;

    const distance = Math.hypot(player.pos.x - apple.pos.x, player.pos.y - apple.pos.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestApple = apple;
    }
  });

  return bestApple;
}

function normalizePlayerState(player: Player | PlayerState | null): PlayerState | null {
  if (!player) return null;
  if (player instanceof Player) return player.toState();

  return {
    id: player.id,
    color: player.color,
    pos: player.pos,
    body: Array.isArray(player.body) ? player.body : [],
    length: player.length,
    speed: player.speed || 1,
    direction: player.direction || "",
    isAlive: Boolean(player.isAlive),
  };
}

function appleValue(apple: Apple, playerLength: number): number {
  switch (apple.type || "normal") {
    case "golden":
      return 4;
    case "blue":
      return playerLength >= 4 ? 3 : 1;
    case "green":
      return playerLength > 4 ? 0.5 : -8;
    default:
      return 2;
  }
}

function chooseAppleTarget(player: Player, availableApples: Apple[]): Apple | null {
  const immediateApple = chooseImmediateAppleTarget(player, availableApples);
  if (immediateApple) return immediateApple;

  const remoteState = normalizePlayerState(remotePlayer);
  const dangerPoints = remoteState?.body || [];
  const obstacles = [
    ...player.body.slice(1),
    ...dangerPoints,
  ];

  let bestApple: Apple | null = null;
  let bestScore = -Infinity;

  availableApples.forEach((apple) => {
    const direction = findPathToTarget(
      player.pos,
      apple.pos,
      SETTINGS.BOARD_WIDTH,
      SETTINGS.BOARD_HEIGHT,
      SETTINGS.CELL_SIZE,
      obstacles,
      player.direction as Direction | "",
      dangerPoints,
    );

    if (!direction) return;

    const distance = Math.max(1, Math.hypot(player.pos.x - apple.pos.x, player.pos.y - apple.pos.y));
    const nearestDanger = dangerPoints.reduce((nearest, point) => {
      const dangerDistance = Math.hypot(apple.pos.x - point.x, apple.pos.y - point.y);
      return Math.min(nearest, dangerDistance);
    }, Infinity);
    const dangerPenalty = nearestDanger < SETTINGS.CELL_SIZE * 2 ? 1.8 : 1;
    const score = appleValue(apple, player.length) * 1000 / distance / dangerPenalty;

    if (score > bestScore) {
      bestScore = score;
      bestApple = apple;
    }
  });

  return bestApple;
}

function collidesWithSnakeAtPositions(positions: Point[], otherSnake: PlayerState | null): boolean {
  if (!otherSnake || !otherSnake.isAlive) return false;
  const hitRadius = SETTINGS.CELL_SIZE * 0.9;

  return positions.some((position) => {
    return otherSnake.body.some((segment) => {
      return Math.hypot(position.x - segment.x, position.y - segment.y) < hitRadius;
    });
  });
}

function collidesWithPoints(positions: Point[], points: Point[]): boolean {
  const hitRadius = SETTINGS.CELL_SIZE * 0.9;

  return positions.some((position) => {
    return points.some((point) => {
      return Math.hypot(position.x - point.x, position.y - point.y) < hitRadius;
    });
  });
}

function emitSnakeState(player: Player) {
  socket.emit("update_snake_state", {
    pos: player.pos,
    body: player.body,
    length: player.length,
    speed: player.speed,
    direction: player.direction,
    isAlive: player.isAlive(),
    wonByLength: player.hasWonByLength(),
  });
}

function finishLocalGame(isWinner: boolean | null) {
  gameStarted = false;
  showGameOver(isWinner);
}

function applyAppleEffect(player: Player, apple: Apple) {
  switch (apple.type || "normal") {
    case "golden":
      player.grow(3);
      break;
    case "blue":
      player.addTemporarySpeedBoost(1, 5000);
      break;
    case "green":
      player.applyDamage();
      break;
    default:
      player.grow(1);
      break;
  }
}

function consumeApplesAtPositions(player: Player, positions: Point[]) {
  const pickupRadius = SETTINGS.CELL_SIZE * 0.65;
  const eatenApples: Apple[] = [];
  const pickupPositions = [player.pos, ...positions];

  apples = apples.filter((apple) => {
    const wasEaten = pickupPositions.some((position) => {
      return Math.hypot(position.x - apple.pos.x, position.y - apple.pos.y) < pickupRadius;
    });

    if (wasEaten) {
      applyAppleEffect(player, apple);
      eatenApples.push(apple);
      return false;
    }

    return true;
  });

  eatenApples.forEach((apple) => {
    socket.emit("apple_collected", {
      pos: apple.pos,
      type: apple.type || "normal",
    });
  });
}

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = SETTINGS.BOARD_WIDTH;
canvas.height = SETTINGS.BOARD_HEIGHT;

let playerId: string = "";
let apples: Apple[] = [];
let remotePlayer: PlayerState | null = null;
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
  const playersToDisplay = [
    normalizePlayerState(localPlayer),
    normalizePlayerState(remotePlayer),
  ].filter((player): player is PlayerState => Boolean(player));
  
  playersToDisplay.forEach((player) => {
    if (!player.body || player.body.length === 0) return;

    const color = player.color || "blue";
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

  if (!localPlayer && !remotePlayer) {
    const li = document.createElement("li");
    li.textContent = "Waiting for players...";
    scoreboard.appendChild(li);
    return;
  }

  [normalizePlayerState(localPlayer), normalizePlayerState(remotePlayer)].forEach((player) => {
    if (!player) return;
    const li = document.createElement("li");
    li.style.color = player.color || "blue";
    const aliveLabel = player.isAlive ? "Alive" : "Dead";
    const speedLabel = `Speed: ${player.speed || 1}`;
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
    if (state.length > SETTINGS.MAX_LENGTH) {
      finishLocalGame(state.id === playerId);
      return;
    }

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
        localPlayer["_baseSpeed"] = 1;
        localPlayer["_temporarySpeedBonus"] = Math.max(0, (state.speed || 1) - 1);
        localPlayer["_temporarySpeedUntil"] = localPlayer["_temporarySpeedBonus"] > 0
          ? Date.now() + 5000
          : 0;
      }
    } else {
      remotePlayer = normalizePlayerState(state);
    }
  });
});

socket.on("send_apple_data", (data: Apple[]) => {
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
  if (!gameStarted || !localPlayer) return;

  const targetApple = chooseAppleTarget(localPlayer, apples);

  if (targetApple) {
    const immediateDirection = chooseImmediateAppleDirection(localPlayer, targetApple);
    const nearbyDirection = chooseNearbyAppleDirection(localPlayer, targetApple);
    const pathDirection = findPathToTarget(
      localPlayer.pos,
      targetApple.pos,
      SETTINGS.BOARD_WIDTH,
      SETTINGS.BOARD_HEIGHT,
      SETTINGS.CELL_SIZE,
      [
        ...localPlayer.body.slice(1),
        ...(remotePlayer?.body || []),
      ],
      localPlayer.direction as Direction | "",
      remotePlayer?.body || [],
    );
    const fallbackDirection = chooseSafeDirection(localPlayer, targetApple.pos);
    const nextDirection = immediateDirection || nearbyDirection || pathDirection || fallbackDirection;

    if (nextDirection) {
      localPlayer.direction = nextDirection;
    }
  } else {
    const cruisingDirection = chooseSafeDirection(localPlayer, null);
    if (cruisingDirection && cruisingDirection !== opponents[localPlayer.direction]) {
      localPlayer.direction = cruisingDirection;
    }
  }

  const currentDirection = localPlayer.direction as Direction | "";
  if (!currentDirection) {
    const startingDirection = chooseSafeDirection(localPlayer, targetApple?.pos || null);
    if (!startingDirection) return;
    localPlayer.direction = startingDirection;
  }

  const currentDelta = directionToDelta(localPlayer.direction as Direction);
  const bodyBeforeMove = localPlayer.body.slice(1);
  const visitedPositions = localPlayer.movePlayer(
    currentDelta.x,
    currentDelta.y,
    SETTINGS.BOARD_WIDTH,
    SETTINGS.BOARD_HEIGHT,
  );
  const collisionTrail = [localPlayer.pos, ...visitedPositions];

  if (
    !localPlayer.isAlive() ||
    collidesWithPoints(collisionTrail, bodyBeforeMove) ||
    collidesWithSnakeAtPositions(collisionTrail, remotePlayer)
  ) {
    localPlayer.kill();
    emitSnakeState(localPlayer);
    socket.emit("player_died", { id: playerId, reason: "collision" });
    finishLocalGame(false);
    return;
  }

  consumeApplesAtPositions(localPlayer, visitedPositions);

  if (localPlayer.hasWonByLength()) {
    emitSnakeState(localPlayer);
    socket.emit("max_length_reached", { id: playerId, length: localPlayer.length });
    finishLocalGame(true);
    return;
  }

  emitSnakeState(localPlayer);
}, 1000 / SETTINGS.TICK_RATE);
