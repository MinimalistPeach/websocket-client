const SETTINGS = {
  BOARD_WIDTH: 800,
  BOARD_HEIGHT: 800,
  CELL_SIZE: 40,
  TICK_RATE: 10,
  MAX_LENGTH: 40,
};

const CAMERA_SCALE = 1.7;
const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const OPPOSITE_DIRECTIONS: Record<string, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
