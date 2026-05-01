declare const io: any;

class SnakeGameClient {
  private socket = io("http://localhost:3000");
  private renderer: GameRenderer;
  private ui = new GameUi();
  private ai = new SnakeAi();
  private appleSystem = new AppleSystem();
  private playerId = "";
  private apples: Apple[] = [];
  private remotePlayer: PlayerState | null = null;
  private localPlayer: Player | null = null;
  private gameStarted = false;
  private focusView = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new GameRenderer(canvas);
    this.bindUi();
    this.bindSocket();
    this.startRenderLoop();
    this.startUpdateLoop();
  }

  private bindUi() {
    this.ui.bindControls({
      onReadyToggle: (ready) => {
        this.socket.emit("player_ready", { ready });
      },
      onFocusToggle: (focusView) => {
        this.focusView = focusView;
      },
    });
  }

  private bindSocket() {
    this.socket.on("connect", () => {
      this.playerId = this.socket.id;
      this.ui.updatePlayerIdText(this.playerId, this.localPlayer);
    });

    this.socket.on("player_moved", (playerStates: PlayerState[]) => {
      playerStates.forEach((state) => this.applyPlayerState(state));
    });

    this.socket.on("send_apple_data", (data: Apple[]) => {
      this.apples = data;
    });

    this.socket.on("game_started", () => {
      this.gameStarted = true;
      this.ui.showGameStarted();
    });

    this.socket.on("game_over", (data: { winnerId: string | null }) => {
      this.gameStarted = false;
      const isDraw = data.winnerId === null;
      this.ui.showGameOver(isDraw ? null : data.winnerId === this.playerId);
      this.ui.disableReadyButton();
    });
  }

  private applyPlayerState(state: PlayerState) {
    if (state.length > SETTINGS.MAX_LENGTH) {
      this.finishLocalGame(state.id === this.playerId);
      return;
    }

    if (state.id === this.playerId) {
      if (!this.localPlayer) {
        this.localPlayer = new Player(state.id, state.color, state.pos, state.length);
        this.localPlayer.restoreFromState(state);
        this.ui.updatePlayerIdText(this.playerId, this.localPlayer);
      }
      return;
    }

    this.remotePlayer = normalizePlayerState(state);
  }

  private startRenderLoop() {
    const loop = () => {
      this.renderer.draw(
        this.apples,
        this.localPlayer,
        this.remotePlayer,
        this.focusView,
        this.playerId,
      );
      requestAnimationFrame(loop);
    };

    loop();
  }

  private startUpdateLoop() {
    setInterval(() => this.tick(), 1000 / SETTINGS.TICK_RATE);
  }

  private tick() {
    if (!this.gameStarted || !this.localPlayer) return;

    const targetApple = this.ai.chooseAppleTarget(this.localPlayer, this.apples, this.remotePlayer);
    const nextDirection = this.ai.chooseNextDirection(
      this.localPlayer,
      targetApple,
      this.remotePlayer,
    );

    if (nextDirection) {
      this.localPlayer.direction = nextDirection;
    }

    if (!this.localPlayer.direction) {
      const startingDirection = this.ai.chooseSafeDirection(
        this.localPlayer,
        targetApple?.pos || null,
        this.remotePlayer,
      );
      if (!startingDirection) return;
      this.localPlayer.direction = startingDirection;
    }

    const currentDelta = directionToDelta(this.localPlayer.direction);
    const bodyBeforeMove = this.localPlayer.body.slice(1);
    const visitedPositions = this.localPlayer.movePlayer(currentDelta.x, currentDelta.y);
    const collisionTrail = [this.localPlayer.pos, ...visitedPositions];

    if (this.hasLethalCollision(collisionTrail, bodyBeforeMove)) {
      this.localPlayer.kill();
      this.emitSnakeState();
      this.socket.emit("player_died", { id: this.playerId, reason: "collision" });
      this.finishLocalGame(false);
      return;
    }

    const result = this.appleSystem.consumeApplesAtPositions(
      this.localPlayer,
      this.apples,
      visitedPositions,
    );
    this.apples = result.remainingApples;
    result.eatenApples.forEach((apple) => {
      this.socket.emit("apple_collected", {
        id: apple.id,
        pos: apple.pos,
        type: apple.type || "normal",
      });
    });

    if (this.localPlayer.hasWonByLength()) {
      this.emitSnakeState();
      this.socket.emit("max_length_reached", {
        id: this.playerId,
        length: this.localPlayer.length,
      });
      this.finishLocalGame(true);
      return;
    }

    this.emitSnakeState();
  }

  private hasLethalCollision(collisionTrail: Point[], bodyBeforeMove: Point[]): boolean {
    if (!this.localPlayer?.isAlive()) return true;
    return (
      collidesWithPoints(collisionTrail, bodyBeforeMove) ||
      collidesWithSnakeAtPositions(collisionTrail, this.remotePlayer)
    );
  }

  private emitSnakeState() {
    if (!this.localPlayer) return;

    this.socket.emit("update_snake_state", {
      pos: this.localPlayer.pos,
      body: this.localPlayer.body,
      length: this.localPlayer.length,
      speed: this.localPlayer.speed,
      direction: this.localPlayer.direction,
      isAlive: this.localPlayer.isAlive(),
      wonByLength: this.localPlayer.hasWonByLength(),
    });
  }

  private finishLocalGame(isWinner: boolean | null) {
    this.gameStarted = false;
    this.ui.showGameOver(isWinner);
  }
}

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("Missing game canvas");
}

new SnakeGameClient(canvas);
