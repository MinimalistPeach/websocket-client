class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context is unavailable");
    }
    this.ctx = context;
    this.canvas.width = SETTINGS.BOARD_WIDTH;
    this.canvas.height = SETTINGS.BOARD_HEIGHT;
  }

  public draw(
    apples: Apple[],
    localPlayer: Player | null,
    remotePlayer: PlayerState | null,
    focusView: boolean,
    playerId: string,
  ) {
    this.applyCameraTransform(localPlayer, focusView);
    this.drawBackground();
    this.drawApples(apples);
    this.drawPlayers(localPlayer, remotePlayer);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.updateScoreboard(localPlayer, remotePlayer, playerId);
  }

  private applyCameraTransform(localPlayer: Player | null, focusView: boolean) {
    if (!focusView || !localPlayer) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }

    const offsetX = this.canvas.width / 2 - localPlayer.pos.x * CAMERA_SCALE;
    const offsetY = this.canvas.height / 2 - localPlayer.pos.y * CAMERA_SCALE;
    this.ctx.setTransform(CAMERA_SCALE, 0, 0, CAMERA_SCALE, offsetX, offsetY);
  }

  private drawBackground() {
    for (let row = 0; row < SETTINGS.BOARD_HEIGHT / SETTINGS.CELL_SIZE; row++) {
      for (let col = 0; col < SETTINGS.BOARD_WIDTH / SETTINGS.CELL_SIZE; col++) {
        this.ctx.fillStyle = (row + col) % 2 === 0 ? "#AAD751" : "#A2D149";
        this.ctx.fillRect(
          col * SETTINGS.CELL_SIZE,
          row * SETTINGS.CELL_SIZE,
          SETTINGS.CELL_SIZE,
          SETTINGS.CELL_SIZE,
        );
      }
    }
  }

  private drawApples(apples: Apple[]) {
    apples.forEach((apple) => {
      const appleRadius = 16;
      const type = apple.type || "normal";

      this.ctx.fillStyle = "rgba(0,0,0,0.2)";
      this.ctx.beginPath();
      this.ctx.arc(apple.pos.x, apple.pos.y + 4, appleRadius, 0, Math.PI * 2);
      this.ctx.fill();

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

      this.ctx.fillStyle = fillColor;
      this.ctx.beginPath();
      this.ctx.arc(apple.pos.x, apple.pos.y, appleRadius, 0, Math.PI * 2);
      this.ctx.fill();

      if (type === "golden") {
        this.ctx.strokeStyle = "rgba(255,255,255,0.55)";
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(apple.pos.x, apple.pos.y, appleRadius - 4, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.fillStyle = "rgba(255,255,255,0.4)";
      this.ctx.beginPath();
      this.ctx.arc(apple.pos.x - 6, apple.pos.y - 6, 5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = bodyColor;
      this.ctx.fillRect(apple.pos.x - 2, apple.pos.y - appleRadius - 4, 4, 8);

      this.ctx.fillStyle = leafColor;
      this.ctx.beginPath();
      this.ctx.ellipse(
        apple.pos.x + 6,
        apple.pos.y - appleRadius - 2,
        6,
        3,
        Math.PI / 4,
        0,
        Math.PI * 2,
      );
      this.ctx.fill();
    });
  }

  private drawPlayers(localPlayer: Player | null, remotePlayer: PlayerState | null) {
    const playersToDisplay = [
      normalizePlayerState(localPlayer),
      normalizePlayerState(remotePlayer),
    ].filter((player): player is PlayerState => Boolean(player));

    playersToDisplay.forEach((player) => {
      if (!player.body || player.body.length === 0) return;

      const radius = SETTINGS.CELL_SIZE / 2 - 5;

      player.body.forEach((segment, idx) => {
        const next = player.body[idx + 1];

        this.ctx.beginPath();
        this.ctx.fillStyle = player.color || "blue";
        this.ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        if (next) {
          const dx = Math.abs(segment.x - next.x);
          const dy = Math.abs(segment.y - next.y);
          if (dx < SETTINGS.CELL_SIZE * 1.5 && dy < SETTINGS.CELL_SIZE * 1.5) {
            this.ctx.beginPath();
            this.ctx.lineWidth = radius * 2;
            this.ctx.lineCap = "round";
            this.ctx.strokeStyle = player.color || "blue";
            this.ctx.moveTo(segment.x, segment.y);
            this.ctx.lineTo(next.x, next.y);
            this.ctx.stroke();
          }
        }

        if (idx === 0) {
          this.drawEyes(segment.x, segment.y, player.direction);
        }
      });
    });
  }

  private drawEyes(x: number, y: number, dir: string) {
    const eyeSize = 5;
    const eyeSpacing = 9;
    let e1 = { x: 0, y: 0 };
    let e2 = { x: 0, y: 0 };

    if (dir === "up" || dir === "down") {
      e1 = { x: x - eyeSpacing, y };
      e2 = { x: x + eyeSpacing, y };
    } else {
      e1 = { x, y: y - eyeSpacing };
      e2 = { x, y: y + eyeSpacing };
    }

    this.ctx.fillStyle = "white";
    [e1, e2].forEach((eye) => {
      this.ctx.beginPath();
      this.ctx.arc(eye.x, eye.y, eyeSize, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "black";
      this.ctx.beginPath();
      this.ctx.arc(eye.x, eye.y, eyeSize / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "white";
    });
  }

  private updateScoreboard(
    localPlayer: Player | null,
    remotePlayer: PlayerState | null,
    playerId: string,
  ) {
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
}
