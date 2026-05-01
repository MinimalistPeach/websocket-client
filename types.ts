type Direction = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type AppleType = "normal" | "golden" | "blue" | "green";

type Apple = {
  id?: string;
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

type MatchHistoryRow = {
  ID: number;
  Player_1_ID?: string;
  Player_2_ID?: string;
  Winner_Player_ID?: string | null;
};
