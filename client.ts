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
let players: { _id: string; _color: string; pos: { x: number; y: number } }[] =
  [];

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
    const grid = getGridCoords(player.pos.x, player.pos.y);
    const cell = document.getElementById(`cell-${grid.x}-${grid.y}`);

    if (cell) {
      cell.style.backgroundColor = player._color || "blue";
    }

    if (scoreboard) {
      const li = document.createElement("li");
      li.style.color = player._color || "blue";
      li.textContent = `Player: ${player._id.substring(0, 5)}... ${player._id === playerId ? "(You)" : ""}`;
      scoreboard.appendChild(li);
    }
  });
}

socket.io.opts.extraHeaders = {
  "Access-Control-Allow-Origin": "*",
};

window.addEventListener("DOMContentLoaded", () => {
  initBoard();
});

socket.on("connect", () => {
  console.log("Connected: " + socket.id);
  playerId = socket.id;
  socket.emit("window_details", {
    width: window.innerWidth,
    height: window.innerHeight,
  });
});

socket.on("disconnect", () => {
  console.log("Disconnected");
});

socket.on("enough_users", () => {
  alert("Cannot connect: 2 users are already connected");
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
  (data: { _id: string; _color: string; _pos: { x: number; y: number } }[]) => {
    players = data.map((p) => ({
      _id: p._id,
      _color: p._color,
      pos: p._pos,
    }));
    render();
  },
);

socket.on(
  "player_moved",
  (data: { id: string; pos: { x: number; y: number } }[]) => {
    data.forEach((movedData) => {
      const playerIndex = players.findIndex((p) => p._id === movedData.id);
      if (playerIndex !== -1) {
        players[playerIndex].pos = movedData.pos;
      } else {
        players.push({ _id: movedData.id, _color: "blue", pos: movedData.pos });
      }
    });
    render();
  },
);

socket.on("set_health", (data: { id: string; health: number }) => {
  console.log(`Player ${data.id} health set to ${data.health}`);
});

// Automated random movement tester
setInterval(() => {
  const directions = ["up", "down", "left", "right"];
  const randomDirection =
    directions[Math.floor(Math.random() * directions.length)];
  socket.emit("move_player", { direction: randomDirection });
}, 1000 / 60);
