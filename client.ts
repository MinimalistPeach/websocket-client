declare const io: any;
const socket = io("http://localhost:3000");

const SETTINGS = {
    BOARD_WIDTH: 800,
    BOARD_HEIGHT: 800,
    CELL_SIZE: 40,
    TICK_RATE: 10
};

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = SETTINGS.BOARD_WIDTH;
canvas.height = SETTINGS.BOARD_HEIGHT;

let playerId: string = "";
let apples: any[] = [];
let players: any[] = [];
let currentDirection: string = '';
const oppositeDir: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' };

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
            ctx.fillRect(col * SETTINGS.CELL_SIZE, row * SETTINGS.CELL_SIZE, SETTINGS.CELL_SIZE, SETTINGS.CELL_SIZE);
        }
    }
}

function drawApples() {
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
}

function drawPlayers() {
    players.forEach(player => {
        if (!player.body || player.body.length === 0) return;

        const color = player._color || "blue";
        const radius = (SETTINGS.CELL_SIZE / 2) - 5;

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
    let e1 = { x: 0, y: 0 }, e2 = { x: 0, y: 0 };

    if (dir === 'up' || dir === 'down') {
        e1 = { x: x - eyeSpacing, y: y };
        e2 = { x: x + eyeSpacing, y: y };
    } else {
        e1 = { x: x, y: y - eyeSpacing };
        e2 = { x: x, y: y + eyeSpacing };
    }

    ctx.fillStyle = "white";
    [e1, e2].forEach(e => {
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

    players.forEach((player) => {
        const li = document.createElement("li");
        li.style.color = player._color || "blue";
        li.textContent = `Player: ${player._id.substring(0, 5)} (Length: ${player.length})`;
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
        direction: p._direction || p.direction
    }));
}

socket.on("send_player_data", sysncPlayerData);

socket.on("player_moved", sysncPlayerData);

socket.on("connect", () => {
    playerId = socket.id;
});

socket.on("send_apple_data", (data: any) => {
    apples = data;
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
        nextDir = dx > 0 ? 'right' : 'left';
    } else {
        nextDir = dy > 0 ? 'down' : 'up';
    }

    if (nextDir !== currentDirection && nextDir !== oppositeDir[currentDirection]) {
        currentDirection = nextDir;
        socket.emit('move_player', { direction: currentDirection });
    }
}, 150);

