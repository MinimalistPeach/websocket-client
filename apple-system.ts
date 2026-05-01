class AppleSystem {
  public consumeApplesAtPositions(
    player: Player,
    apples: Apple[],
    positions: Point[],
  ): { remainingApples: Apple[]; eatenApples: Apple[] } {
    const pickupRadius = SETTINGS.CELL_SIZE * 0.65;
    const eatenApples: Apple[] = [];
    const pickupPositions = [player.pos, ...positions];

    const remainingApples = apples.filter((apple) => {
      const wasEaten = pickupPositions.some((position) => {
        return Math.hypot(position.x - apple.pos.x, position.y - apple.pos.y) < pickupRadius;
      });

      if (wasEaten) {
        this.applyAppleEffect(player, apple);
        eatenApples.push(apple);
        return false;
      }

      return true;
    });

    return { remainingApples, eatenApples };
  }

  private applyAppleEffect(player: Player, apple: Apple) {
    switch (apple.type || "normal") {
      case "golden":
        player.grow(3);
        break;
      case "blue":
        player.addTemporarySpeedBoost(1, 5000);
        break;
      case "green":
        player.applyDamage();
        break;
      default:
        player.grow(1);
        break;
    }
  }
}
