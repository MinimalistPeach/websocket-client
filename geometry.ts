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

function collidesWithSnakeAtPositions(
  positions: Point[],
  otherSnake: PlayerState | null,
): boolean {
  if (!otherSnake || !otherSnake.isAlive) return false;
  return collidesWithPoints(positions, otherSnake.body);
}

function collidesWithPoints(positions: Point[], points: Point[]): boolean {
  const hitRadius = SETTINGS.CELL_SIZE * 0.9;

  return positions.some((position) => {
    return points.some((point) => {
      return Math.hypot(position.x - point.x, position.y - point.y) < hitRadius;
    });
  });
}
