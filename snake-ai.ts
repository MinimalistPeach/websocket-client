class SnakeAi {
  public chooseAppleTarget(
    player: Player,
    availableApples: Apple[],
    remotePlayer: PlayerState | null,
  ): Apple | null {
    const immediateApple = this.chooseImmediateAppleTarget(player, availableApples, remotePlayer);
    if (immediateApple) return immediateApple;

    const dangerPoints = remotePlayer?.body || [];
    const obstacles = [
      ...player.body.slice(1),
      ...dangerPoints,
    ];

    let bestApple: Apple | null = null;
    let bestScore = -Infinity;

    availableApples.forEach((apple) => {
      const direction = this.findPathToTarget(
        player.pos,
        apple.pos,
        obstacles,
        player.direction,
        dangerPoints,
      );

      if (!direction) return;

      const distance = Math.max(1, Math.hypot(player.pos.x - apple.pos.x, player.pos.y - apple.pos.y));
      const nearestDanger = dangerPoints.reduce((nearest, point) => {
        const dangerDistance = Math.hypot(apple.pos.x - point.x, apple.pos.y - point.y);
        return Math.min(nearest, dangerDistance);
      }, Infinity);
      const dangerPenalty = nearestDanger < SETTINGS.CELL_SIZE * 2 ? 1.8 : 1;
      const score = this.appleValue(apple, player.length) * 1000 / distance / dangerPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestApple = apple;
      }
    });

    return bestApple;
  }

  public chooseNextDirection(
    player: Player,
    targetApple: Apple | null,
    remotePlayer: PlayerState | null,
  ): Direction | null {
    if (!targetApple) {
      return this.chooseSafeDirection(player, null, remotePlayer);
    }

    const immediateDirection = this.chooseImmediateAppleDirection(player, targetApple, remotePlayer);
    const nearbyDirection = this.chooseNearbyAppleDirection(player, targetApple, remotePlayer);
    const pathDirection = this.findPathToTarget(
      player.pos,
      targetApple.pos,
      [
        ...player.body.slice(1),
        ...(remotePlayer?.body || []),
      ],
      player.direction,
      remotePlayer?.body || [],
    );
    const fallbackDirection = this.chooseSafeDirection(player, targetApple.pos, remotePlayer);

    return immediateDirection || nearbyDirection || pathDirection || fallbackDirection;
  }

  public chooseSafeDirection(
    player: Player,
    target: Point | null,
    remotePlayer: PlayerState | null,
  ): Direction | null {
    const ownBody = new Set(player.body.slice(1).map(gridKey));
    const opponentBody = new Set((remotePlayer?.body || []).map(gridKey));

    const choices = DIRECTIONS
      .filter((direction) => {
        if (player.direction && direction === OPPOSITE_DIRECTIONS[player.direction]) {
          return false;
        }

        const next = nextPosition(player.pos, direction);
        const key = gridKey(next);
        return isInsideBoard(next) && !ownBody.has(key) && !opponentBody.has(key);
      })
      .map((direction) => {
        const next = nextPosition(player.pos, direction);
        const targetDistance = target ? Math.hypot(next.x - target.x, next.y - target.y) : 0;
        const dangerPenalty = (remotePlayer?.body || []).reduce((penalty, point) => {
          const distance = Math.hypot(next.x - point.x, next.y - point.y);
          if (distance < SETTINGS.CELL_SIZE * 0.75) return penalty + 800;
          if (distance < SETTINGS.CELL_SIZE * 1.75) return penalty + 180;
          return penalty;
        }, 0);

        return {
          direction,
          score: targetDistance + dangerPenalty,
        };
      })
      .sort((a, b) => a.score - b.score);

    return choices[0]?.direction || null;
  }

  private findPathToTarget(
    startPos: Point,
    targetPos: Point,
    obstacles: Point[],
    currentDirection: Direction | "",
    dangerPoints: Point[] = [],
    dangerWeight: number = 2.5,
  ): Direction | null {
    const margin = 20;
    const startGrid = { x: Math.round(startPos.x / SETTINGS.CELL_SIZE), y: Math.round(startPos.y / SETTINGS.CELL_SIZE) };
    const targetGrid = { x: Math.round(targetPos.x / SETTINGS.CELL_SIZE), y: Math.round(targetPos.y / SETTINGS.CELL_SIZE) };
    const obstacleSet = new Set(obstacles.map(gridKey));
    const queue: Array<{ grid: Point; direction: Direction | ""; cost: number }> = [];
    const bestCosts = new Map<string, number>();

    queue.push({ grid: startGrid, direction: "", cost: 0 });
    bestCosts.set(`${startGrid.x},${startGrid.y}`, 0);

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;
      const { grid, direction: pathDirection, cost } = current;

      if (grid.x === targetGrid.x && grid.y === targetGrid.y) {
        return pathDirection || null;
      }

      for (const dir of DIRECTIONS) {
        const isFirstStep = pathDirection === "";
        if (isFirstStep && currentDirection && dir === OPPOSITE_DIRECTIONS[currentDirection]) {
          continue;
        }

        const nextGrid = { ...grid };
        if (dir === "up") nextGrid.y -= 1;
        if (dir === "down") nextGrid.y += 1;
        if (dir === "left") nextGrid.x -= 1;
        if (dir === "right") nextGrid.x += 1;

        const nextKey = `${nextGrid.x},${nextGrid.y}`;
        if (obstacleSet.has(nextKey)) continue;

        const pixelX = nextGrid.x * SETTINGS.CELL_SIZE;
        const pixelY = nextGrid.y * SETTINGS.CELL_SIZE;
        if (
          pixelX < margin ||
          pixelX > SETTINGS.BOARD_WIDTH - margin ||
          pixelY < margin ||
          pixelY > SETTINGS.BOARD_HEIGHT - margin
        ) {
          continue;
        }

        const dangerCost = dangerPoints.reduce((total, point) => {
          const dangerGrid = {
            x: Math.round(point.x / SETTINGS.CELL_SIZE),
            y: Math.round(point.y / SETTINGS.CELL_SIZE),
          };
          const distance = Math.abs(nextGrid.x - dangerGrid.x) + Math.abs(nextGrid.y - dangerGrid.y);
          if (distance === 0) return total + dangerWeight * 8;
          if (distance === 1) return total + dangerWeight * 3;
          if (distance === 2) return total + dangerWeight;
          return total;
        }, 0);
        const targetDistance = Math.abs(nextGrid.x - targetGrid.x) + Math.abs(nextGrid.y - targetGrid.y);
        const nextCost = cost + 1 + dangerCost + targetDistance * 0.05;
        const previousBest = bestCosts.get(nextKey);

        if (previousBest !== undefined && previousBest <= nextCost) continue;

        bestCosts.set(nextKey, nextCost);
        queue.push({ grid: nextGrid, direction: pathDirection || dir, cost: nextCost });
      }
    }

    return null;
  }

  private chooseImmediateAppleDirection(
    player: Player,
    apple: Apple | null,
    remotePlayer: PlayerState | null,
  ): Direction | null {
    if (!apple) return null;

    const ownBody = new Set(player.body.slice(1).map(gridKey));
    const opponentBody = new Set((remotePlayer?.body || []).map(gridKey));

    for (const direction of DIRECTIONS) {
      const next = nextPosition(player.pos, direction);
      const reachesApple = Math.hypot(next.x - apple.pos.x, next.y - apple.pos.y) < SETTINGS.CELL_SIZE * 0.65;
      const key = gridKey(next);
      if (reachesApple && isInsideBoard(next) && !ownBody.has(key) && !opponentBody.has(key)) {
        return direction;
      }
    }

    return null;
  }

  private chooseNearbyAppleDirection(
    player: Player,
    apple: Apple | null,
    remotePlayer: PlayerState | null,
  ): Direction | null {
    if (!apple) return null;

    const distanceToApple = Math.hypot(player.pos.x - apple.pos.x, player.pos.y - apple.pos.y);
    if (distanceToApple > SETTINGS.CELL_SIZE * 1.75) return null;

    return this.chooseSafeDirection(player, apple.pos, remotePlayer);
  }

  private chooseImmediateAppleTarget(
    player: Player,
    availableApples: Apple[],
    remotePlayer: PlayerState | null,
  ): Apple | null {
    let bestApple: Apple | null = null;
    let bestDistance = Infinity;

    availableApples.forEach((apple) => {
      const direction = this.chooseImmediateAppleDirection(player, apple, remotePlayer);
      if (!direction) return;

      const distance = Math.hypot(player.pos.x - apple.pos.x, player.pos.y - apple.pos.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestApple = apple;
      }
    });

    return bestApple;
  }

  private appleValue(apple: Apple, playerLength: number): number {
    switch (apple.type || "normal") {
      case "golden":
        return 4;
      case "blue":
        return playerLength >= 4 ? 3 : 1;
      case "green":
        return playerLength > 4 ? 0.5 : -8;
      default:
        return 2;
    }
  }
}
