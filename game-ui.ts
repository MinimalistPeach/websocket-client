class GameUi {
  private readyButton = document.getElementById("ready-button") as HTMLButtonElement | null;
  private playerIdText = document.getElementById("player-id-text") as HTMLElement | null;
  private statusText = document.getElementById("status-text") as HTMLElement | null;
  private gameOverModal = document.getElementById("game-over-modal") as HTMLElement | null;
  private gameOverCard = document.getElementById("game-over-card") as HTMLElement | null;
  private gameOverTitle = document.getElementById("game-over-title") as HTMLElement | null;
  private gameOverMessage = document.getElementById("game-over-message") as HTMLElement | null;
  private restartButton = document.getElementById("restart-button") as HTMLButtonElement | null;
  private historyButton = document.getElementById("history-button") as HTMLButtonElement | null;
  private focusButton = document.getElementById("focus-button") as HTMLButtonElement | null;
  private historyModal = document.getElementById("history-modal") as HTMLElement | null;
  private historyContent = document.getElementById("history-content") as HTMLElement | null;
  private closeHistoryButton = document.getElementById("close-history-button") as HTMLButtonElement | null;

  public bindControls(callbacks: {
    onReadyToggle: (ready: boolean) => void;
    onFocusToggle: (focusView: boolean) => void;
  }) {
    let isReady = false;
    let focusView = false;

    this.readyButton?.addEventListener("click", () => {
      isReady = !isReady;
      this.readyButton!.textContent = isReady ? "Cancel Ready" : "Ready";
      this.readyButton!.classList.toggle("ready", isReady);
      this.setStatus(isReady ? "Ready. Waiting for other player..." : "Waiting for players...");
      callbacks.onReadyToggle(isReady);
    });

    this.restartButton?.addEventListener("click", () => {
      window.location.reload();
    });

    this.historyButton?.addEventListener("click", () => this.openHistoryModal());

    this.focusButton?.addEventListener("click", () => {
      focusView = !focusView;
      this.focusButton!.textContent = focusView ? "Exit focus view" : "Focus on snake";
      callbacks.onFocusToggle(focusView);
    });

    this.closeHistoryButton?.addEventListener("click", () => this.hideHistoryModal());
  }

  public updatePlayerIdText(playerId: string, localPlayer: Player | null) {
    if (!this.playerIdText) return;
    const displayId = playerId ? playerId.substring(0, 5) : "connecting...";
    this.playerIdText.textContent = playerId
      ? `Player ID: ${displayId}`
      : "Player ID: connecting...";
    this.playerIdText.style.color = localPlayer?.color || "#eef2f7";
  }

  public showGameStarted() {
    this.setStatus("Game started!");
    if (this.readyButton) {
      this.readyButton.disabled = true;
      this.readyButton.classList.remove("ready");
    }
    this.hideGameOver();
  }

  public showGameOver(isWinner: boolean | null) {
    if (!this.gameOverModal || !this.gameOverCard || !this.gameOverTitle || !this.gameOverMessage) {
      return;
    }

    if (isWinner === null) {
      this.gameOverTitle.textContent = "Draw!";
      this.gameOverMessage.textContent = "Both snakes reached the minimum length. Try again.";
      this.gameOverCard.classList.remove("win", "lose");
    } else {
      this.gameOverTitle.textContent = isWinner ? "Victory!" : "Defeat";
      this.gameOverMessage.textContent = isWinner
        ? "You won the match. Great job!"
        : "The other snake won this round. Try again!";
      this.gameOverCard.classList.toggle("win", isWinner);
      this.gameOverCard.classList.toggle("lose", !isWinner);
    }

    this.gameOverModal.classList.remove("hidden");
  }

  public disableReadyButton() {
    if (this.readyButton) {
      this.readyButton.disabled = true;
    }
  }

  private setStatus(message: string) {
    if (this.statusText) {
      this.statusText.textContent = message;
    }
  }

  private hideGameOver() {
    if (!this.gameOverModal || !this.gameOverCard) return;
    this.gameOverModal.classList.add("hidden");
    this.gameOverCard.classList.remove("win", "lose");
  }

  private hideHistoryModal() {
    this.historyModal?.classList.add("hidden");
  }

  private async openHistoryModal() {
    if (!this.historyModal || !this.historyContent) return;

    this.historyContent.textContent = "Loading match history...";
    this.historyModal.classList.remove("hidden");

    try {
      const response = await fetch("http://localhost:3000/matches");
      if (!response.ok) {
        throw new Error("Failed to load matches");
      }

      const matches = await response.json() as MatchHistoryRow[];
      if (!Array.isArray(matches) || matches.length === 0) {
        this.historyContent.textContent = "No matches recorded yet.";
        return;
      }

      const table = document.createElement("table");
      const headerRow = document.createElement("tr");
      ["ID", "Player 1", "Player 2", "Winner"].forEach((label) => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
      });
      table.appendChild(headerRow);

      matches.forEach((match) => {
        const row = document.createElement("tr");
        [
          match.ID,
          match.Player_1_ID?.substring(0, 5) || "",
          match.Player_2_ID?.substring(0, 5) || "",
          match.Winner_Player_ID ? match.Winner_Player_ID.substring(0, 5) : "Draw",
        ].forEach((value) => {
          const td = document.createElement("td");
          td.textContent = String(value);
          row.appendChild(td);
        });
        table.appendChild(row);
      });

      this.historyContent.innerHTML = "";
      this.historyContent.appendChild(table);
    } catch (error) {
      this.historyContent.textContent = "Unable to load match history.";
    }
  }
}
