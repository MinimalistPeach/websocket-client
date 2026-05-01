class Player {
  private _id: string;
  private _color: string;
  private _pos: Point;
  private _body: Point[];
  private _length: number;
  private _baseSpeed = 1;
  private _temporarySpeedBonus = 0;
  private _temporarySpeedUntil = 0;
  private _direction: Direction | "" = "";

  constructor(id: string, color: string, pos: Point, initialLength: number = 5) {
    this._id = id;
    this._color = color;
    this._pos = pos;
    this._length = initialLength;
    this._body = Array.from({ length: this._length }, () => ({
      x: pos.x,
      y: pos.y,
    }));
  }

  public movePlayer(dx: number, dy: number): Point[] {
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
        nextX > SETTINGS.BOARD_WIDTH - margin ||
        nextY < margin ||
        nextY > SETTINGS.BOARD_HEIGHT - margin
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

  public restoreFromState(state: PlayerState) {
    this._body = state.body;
    this._baseSpeed = 1;
    this._temporarySpeedBonus = Math.max(0, (state.speed || 1) - 1);
    this._temporarySpeedUntil = this._temporarySpeedBonus > 0 ? Date.now() + 5000 : 0;
    this._direction = state.direction;
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

  public toState(): PlayerState {
    return {
      id: this._id,
      color: this._color,
      pos: this._pos,
      body: this._body,
      length: this._length,
      speed: this.speed,
      direction: this._direction,
      isAlive: this.isAlive(),
    };
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

  public get direction(): Direction | "" {
    return this._direction;
  }

  public set direction(value: Direction | "") {
    this._direction = value;
  }

  public get speed(): number {
    this.updateTimedEffects();
    return this._baseSpeed + this._temporarySpeedBonus;
  }
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
