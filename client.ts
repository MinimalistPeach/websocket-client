declare const io: any;
const socket = io("http://localhost:3000");

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const CELL_SIZE = 40;
const COLS = 20;
const ROWS = 20;

const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;

canvas.width = BOARD_WIDTH;
canvas.height = BOARD_HEIGHT;

let playerId: string = "";
let apples: { id: string; pos: { x: number; y: number } }[] = [];
let players: any[] = [];

function draw() {
    if (!ctx) return;

    drawBackground();

    apples.forEach(apple => {
        const appleRadius = 16;

        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.arc(apple.pos.x, apple.pos.y + 4, appleRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e74c3c";
        ctx.beginPath();
        ctx.arc(apple.pos.x, apple.pos.y, appleRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(apple.pos.x - 6, apple.pos.y - 6, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#4a2c00";
        ctx.fillRect(apple.pos.x - 2, apple.pos.y - appleRadius - 4, 4, 8);
        
        ctx.fillStyle = "#2ecc71";
        ctx.beginPath();
        ctx.ellipse(apple.pos.x + 6, apple.pos.y - appleRadius - 2, 6, 3, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
    });

    players.forEach(player => {
      if (!player.body || player.body.length === 0) return;

      const radius = (CELL_SIZE / 2) - 5;

      player.body.forEach((segment: { x: number; y: number }, idx: number) => {
          const next = player.body[idx + 1];

          ctx.beginPath();
          ctx.fillStyle = player._color || "blue";
          ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
          ctx.fill();

          if (next) {
              const dx = Math.abs(segment.x - next.x);
              const dy = Math.abs(segment.y - next.y);

              if (dx < CELL_SIZE * 2 && dy < CELL_SIZE * 2) {
                  ctx.beginPath();
                  ctx.lineWidth = radius * 2;
                  ctx.lineCap = "round";
                  ctx.strokeStyle = player._color || "blue";
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

    updateScoreboard();
}

function drawBackground() {
    ctx.fillStyle = "#A2D149";
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.fillStyle = "#AAD751";
    
    for (let row = 0; row < BOARD_HEIGHT / CELL_SIZE; row++) {
        for (let col = 0; col < BOARD_WIDTH / CELL_SIZE; col++) {
            if ((row + col) % 2 === 0) {
                ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }
}

function drawSnake(body: { x: number; y: number }[], color: string, radius: number) {
    if (body.length < 2) {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(body[0].x, body[0].y, radius, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.lineWidth = 1;

    const head = body[0];
    const tail = body[body.length - 1];

    const dxHead = head.x - body[1].x;
    const dyHead = head.y - body[1].y;
    const angleHead = Math.atan2(dyHead, dxHead);

    ctx.moveTo(
        head.x + Math.cos(angleHead + Math.PI / 2) * radius,
        head.y + Math.sin(angleHead + Math.PI / 2) * radius
    );

    ctx.arc(head.x, head.y, radius, angleHead + Math.PI / 2, angleHead - Math.PI / 2);

    for (let i = 1; i < body.length - 1; i++) {
        const p1 = body[i];
        const p2 = body[i + 1];
        
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) continue;

        const perpX = (-dy / dist) * radius;
        const perpY = (dx / dist) * radius;

        ctx.lineTo(p1.x + perpX, p1.y + perpY);
    }

    const dxTail = tail.x - body[body.length - 2].x;
    const dyTail = tail.y - body[body.length - 2].y;
    const angleTail = Math.atan2(dyTail, dxTail);

    ctx.arc(tail.x, tail.y, radius, angleTail + Math.PI / 2, angleTail - Math.PI / 2, true);

    for (let i = body.length - 2; i > 0; i--) {
        const p1 = body[i];
        const p2 = body[i - 1];

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) continue;

        const perpX = (dy / dist) * radius;
        const perpY = (-dx / dist) * radius;

        ctx.lineTo(p1.x + perpX, p1.y + perpY);
    }

    ctx.closePath();
    ctx.fill();
}

function drawEyes(x: number, y: number, dir: string) {
    const eyeSize = 5;
    const eyeSpacing = 9;

    let eyeX1, eyeY1, eyeX2, eyeY2;

    const cleanDir = dir ? dir.toLowerCase().trim() : '';

    if (cleanDir === 'up' || cleanDir === 'down') {
        eyeX1 = x - eyeSpacing; 
        eyeX2 = x + eyeSpacing;
        eyeY1 = y; 
        eyeY2 = y; 
    } 
    else if (cleanDir === 'left' || cleanDir === 'right') {
        eyeX1 = x; 
        eyeX2 = x;
        eyeY1 = y - eyeSpacing; 
        eyeY2 = y + eyeSpacing;
    }
    else {
        eyeX1 = x - eyeSpacing; eyeX2 = x + eyeSpacing;
        eyeY1 = y; eyeY2 = y;
    }

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(eyeX1, eyeY1, eyeSize, 0, Math.PI * 2);
    ctx.arc(eyeX2, eyeY2, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(eyeX1, eyeY1, eyeSize / 2, 0, Math.PI * 2);
    ctx.arc(eyeX2, eyeY2, eyeSize / 2, 0, Math.PI * 2);
    ctx.fill();
}

function updateScoreboard() {
    const scoreboard = document.getElementById("player-list");
    if (!scoreboard) return;
    scoreboard.innerHTML = "";

    players.forEach((player) => {
        const li = document.createElement("li");
        li.style.color = player._color || "blue";
        li.textContent = `Player: ${player._id.substring(0, 5)} (Length: ${player.length})`;
        scoreboard.appendChild(li);
    });
}

function getDistance(p1: { x: number, y: number }, p2: { x: number, y: number }) {
    let dx = Math.abs(p1.x - p2.x);
    let dy = Math.abs(p1.y - p2.y);
    
    if (dx > BOARD_WIDTH / 2) dx = BOARD_WIDTH - dx;
    if (dy > BOARD_HEIGHT / 2) dy = BOARD_HEIGHT - dy;
    
    return Math.sqrt(dx * dx + dy * dy);
}


socket.on("connect", () => {
    playerId = socket.id;
    socket.emit("window_details", { width: BOARD_WIDTH, height: BOARD_HEIGHT });
});

socket.on("send_apple_data", (data: any) => {
    apples = data;
});

socket.on("send_player_data", (data: any[]) => {
    players = data.map((p) => ({
        _id: p._id || p.id,
        _color: p._color || p.color,
        pos: p._pos || p.pos,
        body: p._body || p.body,
        length: p._length || p.length,
    }));
    draw();
});

socket.on("player_moved", (data: any[]) => {
    players = data.map((movedData) => {
        const existing = players.find((p) => p._id === movedData.id);
        return {
            _id: movedData.id,
            _color: existing ? existing._color : "blue",
            pos: movedData.pos,
            body: movedData.body,
            length: movedData.length,
            direction: movedData.direction
        };
    });
});

function gameLoop() {
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

const oppositeDir: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' };
let currentDirection = '';

setInterval(() => {
    const me = players.find((p) => p._id === playerId);
    if (!me || !me.pos || apples.length === 0) return;

    let closestApple = apples[0];
    let bestDist = Infinity;
    
    apples.forEach((apple) => {
        const d = getDistance(me.pos, apple.pos);
        if (d < bestDist) {
            bestDist = d;
            closestApple = apple;
        }
    });

    let vx = 0;
    let vy = 0;

    let dx = closestApple.pos.x - me.pos.x;
    if (Math.abs(dx) > BOARD_WIDTH / 2) {
        dx = dx > 0 ? dx - BOARD_WIDTH : dx + BOARD_WIDTH;
    }

    let dy = closestApple.pos.y - me.pos.y;
    if (Math.abs(dy) > BOARD_HEIGHT / 2) {
        dy = dy > 0 ? dy - BOARD_HEIGHT : dy + BOARD_HEIGHT;
    }

    const distToApple = Math.sqrt(dx * dx + dy * dy);
    if (distToApple > 0) {
        vx += dx / distToApple;
        vy += dy / distToApple;
    }

    const AVOID_DISTANCE = 160;
    players.forEach((other) => {
        if (other._id === playerId || !other.body) return;

        other.body.forEach((segment: {x: number, y: number}) => {
            let odx = me.pos.x - segment.x;
            let ody = me.pos.y - segment.y;

            if (Math.abs(odx) > BOARD_WIDTH / 2) odx = odx > 0 ? odx - BOARD_WIDTH : odx + BOARD_WIDTH;
            if (Math.abs(ody) > BOARD_HEIGHT / 2) ody = ody > 0 ? ody - BOARD_HEIGHT : ody + BOARD_HEIGHT;

            const distToSegment = Math.sqrt(odx * odx + ody * ody);
            if (distToSegment > 0 && distToSegment < AVOID_DISTANCE) {
                const force = (AVOID_DISTANCE - distToSegment) / AVOID_DISTANCE;
                vx += (odx / distToSegment) * force * 2;
                vy += (ody / distToSegment) * force * 2;
            }
        });
    });

    const candidates: string[] = [];
    
    if (Math.abs(vx) > Math.abs(vy)) {
        candidates.push(vx > 0 ? 'right' : 'left');
        candidates.push(vy > 0 ? 'down' : 'up');
    } else {
        candidates.push(vy > 0 ? 'down' : 'up');
        candidates.push(vx > 0 ? 'right' : 'left');
    }

    ['up', 'down', 'left', 'right'].forEach(d => {
        if (candidates.indexOf(d) === -1) {
            candidates.push(d);
        }
    });

    const forbidden = currentDirection ? oppositeDir[currentDirection] : '';
    const nextDirection = candidates.find(d => d !== forbidden);

    if (nextDirection && nextDirection !== currentDirection) {
        currentDirection = nextDirection;
        socket.emit('move_player', { direction: nextDirection });
    }
}, 1000 / 20);

