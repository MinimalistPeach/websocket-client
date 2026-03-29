declare const io: any;
const socket = io("http://localhost:3000");
let playerId: string = "";

// Board dimensions & Grid Settings
const BOARD_WIDTH = 600;
const BOARD_HEIGHT = 800;
const CELL_SIZE = 20;

// Calculate how many rows and columns the table needs
const COLS = Math.floor(BOARD_WIDTH / CELL_SIZE);
const ROWS = Math.floor(BOARD_HEIGHT / CELL_SIZE);

let apples: { id: string; pos: { x: number; y: number } }[] = [];
let players: { _id: string; _color: string; pos: { x: number; y: number }; body?: { x: number; y: number }[]; length?: number }[] =
  [];

socket.io.opts.extraHeaders = {
  "Access-Control-Allow-Origin": "*",
};

window.addEventListener("DOMContentLoaded", () => {
  initBoard();
});

function initBoard() {
  const container = document.getElementById("board-container");
  if (!container) return;

  const table = document.createElement("table");
  for (let y = 0; y < ROWS; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < COLS; x++) {
      const td = document.createElement("td");

      td.id = `cell-${x}-${y}`;
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  container.appendChild(table);
}

function getGridCoords(pixelX: number, pixelY: number) {
  return {
    x: Math.floor(Math.max(0, Math.min(pixelX, BOARD_WIDTH - 1)) / CELL_SIZE),
    y: Math.floor(Math.max(0, Math.min(pixelY, BOARD_HEIGHT - 1)) / CELL_SIZE),
  };
}

function getDistance(p1: { x: number, y: number }, p2: { x: number, y: number }) {
  let dx = Math.abs(p1.x - p2.x);
  let dy = Math.abs(p1.y - p2.y);
  if (dx > BOARD_WIDTH / 2) dx = BOARD_WIDTH - dx;
  if (dy > BOARD_HEIGHT / 2) dy = BOARD_HEIGHT - dy;
  return Math.sqrt(dx * dx + dy * dy);
}

function render() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = document.getElementById(`cell-${x}-${y}`);
      if (cell) {
        cell.className = "";
        cell.style.backgroundColor = "";
      }
    }
  }

  // B. Draw Apples
  apples.forEach((apple) => {
    const grid = getGridCoords(apple.pos.x, apple.pos.y);
    const cell = document.getElementById(`cell-${grid.x}-${grid.y}`);
    if (cell) cell.classList.add("apple");
  });

  const scoreboard = document.getElementById("player-list");
  if (scoreboard) scoreboard.innerHTML = "";

  players.forEach((player) => {
    if (player.body) {
      player.body.forEach((segment, idx) => {
        const grid = getGridCoords(segment.x, segment.y);
        const cell = document.getElementById(`cell-${grid.x}-${grid.y}`);
        if (cell) {
          cell.style.backgroundColor = player._color || "blue";
          cell.style.opacity = idx === 0 ? "1" : "0.7";
          cell.style.border = "none";
        }
      });
    }

    const grid = getGridCoords(player.pos.x, player.pos.y);
    const headCell = document.getElementById(`cell-${grid.x}-${grid.y}`);
    if (headCell) {
      headCell.style.backgroundColor = "yellow";
      headCell.style.border = "none";
      headCell.style.opacity = "1";
    }

    const li = document.createElement("li");
    li.style.color = player._color || "blue";
    const lengthText = player.length != null ? ` (Length: ${player.length})` : "";
    li.textContent = `Player: ${player._id.substring(0, 5)}... ${lengthText}`;
    scoreboard?.appendChild(li);
  });
}

socket.on("connect", () => {
  console.log("Connected: " + socket.id);
  playerId = socket.id;
  socket.emit("window_details", {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
  });
});

socket.on("disconnect", () => {
  console.log("Disconnected");
});

socket.on("enough_users", () => {
  alert("Cannot connect: 2 users are already connected");
});

socket.on("player_hit", (data: { crashed: string; crasher: string; length: number, died: boolean }) => {
  console.log(`Player ${data.crashed} hit by ${data.crasher}, Remaining length=${data.length}`);
  if (data.died) {
    io.emit("player_died", { id: data.crashed });
  }
});

socket.on("game_over", (data: { winnerId: string }) => {
  alert(`Game Over! Winner: ${data.winnerId}`);
});

socket.on(
  "send_apple_data",
  (data: { id: string; pos: { x: number; y: number } }[]) => {
    apples = data;
    console.log(apples);
    render();
  },
);

socket.on(
  "send_player_data",
  (data: { _id: string; _color: string; _pos: { x: number; y: number }; body?: { x: number; y: number }[]; length?: number }[]) => {
    players = data.map((p) => ({
      _id: p._id,
      _color: p._color,
      pos: p._pos,
      body: p.body,
      length: p.length,
    }));
    render();
  },
);

socket.on(
  "player_moved",
  (data: { id: string; pos: { x: number; y: number }; body?: { x: number; y: number }[]; length?: number }[]) => {
    players = data.map((movedData) => {
      const existing = players.find((p) => p._id === movedData.id);
      return {
        _id: movedData.id,
        _color: existing ? existing._color : "blue",
        pos: movedData.pos,
        body: movedData.body,
        length: movedData.length,
      };
    });
    render();
  },
);

socket.on("set_health", (data: { id: string; health: number }) => {
  console.log(`Player ${data.id} health set to ${data.health}`);
});

socket.on("apple_picked", (data: { playerId: string; appleId: string }) => {
  console.log(`Apple ${data.appleId} picked by ${data.playerId}`);
});

socket.on("player_hit", (data: { crashed: string; crasher: string; length: number; died: boolean }) => {
  console.log(`Player ${data.crashed} hit by ${data.crasher}, length now ${data.length}, died: ${data.died}`);
});

// AI movement toward the closest apple with avoidance
const oppositeDir: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' };
let currentDirection = '';

setInterval(() => {
  const me = players.find((p) => p._id === playerId);
  if (!me || apples.length === 0) return;

  let closestApple = null as { id: string; pos: { x: number; y: number } } | null;
  let bestDist = Infinity;
  apples.forEach((apple) => {
    const d = getDistance(me.pos, apple.pos);
    if (d < bestDist) {
      bestDist = d;
      closestApple = apple;
    }
  });

  if (!closestApple) return;

  let vx = 0;
  let vy = 0;

  // Vector to apple (shortest path accounting for wrap-around)
  let dx = closestApple.pos.x - me.pos.x;
  let dy = closestApple.pos.y - me.pos.y;
  if (Math.abs(dx) > BOARD_WIDTH / 2) dx = dx > 0 ? dx - BOARD_WIDTH : dx + BOARD_WIDTH;
  if (Math.abs(dy) > BOARD_HEIGHT / 2) dy = dy > 0 ? dy - BOARD_HEIGHT : dy + BOARD_HEIGHT;
  const appleDist = Math.sqrt(dx * dx + dy * dy);
  if (appleDist > 0) {
    vx += dx / appleDist;
    vy += dy / appleDist;
  }

  // Avoidance vectors (wrap-aware)
  const AVOID_DISTANCE = 120;
  players.forEach((other) => {
    if (other._id === playerId) return;
    let odx = me.pos.x - other.pos.x;
    let ody = me.pos.y - other.pos.y;
    if (Math.abs(odx) > BOARD_WIDTH / 2) odx = odx > 0 ? odx - BOARD_WIDTH : odx + BOARD_WIDTH;
    if (Math.abs(ody) > BOARD_HEIGHT / 2) ody = ody > 0 ? ody - BOARD_HEIGHT : ody + BOARD_HEIGHT;
    const otherDist = Math.sqrt(odx * odx + ody * ody);
    if (otherDist > 0 && otherDist < AVOID_DISTANCE) {
      const avoidIntensity = (AVOID_DISTANCE - otherDist) / AVOID_DISTANCE;
      vx += (odx / otherDist) * avoidIntensity * 1.6;
      vy += (ody / otherDist) * avoidIntensity * 1.6;
    }
  });

  // Normalize and choose direction — never stop, always pick a valid non-reversing direction
  const allDirs = ['up', 'down', 'left', 'right'];
  const candidates: string[] = [];

  // Primary: axis with strongest signal
  const primary = Math.abs(vx) > Math.abs(vy)
    ? (vx > 0 ? 'right' : 'left')
    : (vy > 0 ? 'down' : 'up');
  // Secondary: the other axis
  const secondary = Math.abs(vx) <= Math.abs(vy)
    ? (vx > 0 ? 'right' : 'left')
    : (vy > 0 ? 'down' : 'up');

  candidates.push(primary, secondary);
  // Append remaining directions as last-resort (excluding reverse)
  allDirs.forEach(d => { if (!candidates.includes(d)) candidates.push(d); });

  const blocked = currentDirection ? oppositeDir[currentDirection] : '';
  const nextDirection = candidates.find(d => d !== blocked) ?? currentDirection;
  if (!nextDirection) return;

  currentDirection = nextDirection;
  socket.emit('move_player', { direction: nextDirection });
}, 1000 / 20);

