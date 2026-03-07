// Import Socket.IO types for TypeScript
// Note: Socket.IO client must be available globally in the browser (via CDN or bundling)

declare const io: any;

window.addEventListener("DOMContentLoaded", () => {
  const socket = io("http://localhost:3000");
  const statusDiv = document.getElementById("status");
  const messagesDiv = document.getElementById("messages");
  const chatInput = document.getElementById("chatInput") as HTMLInputElement;
  const chatSendBtn = document.getElementById("chatSendBtn");

  socket.on("connect", () => {
    if (statusDiv) statusDiv.textContent = "Connected: " + socket.id;
  });

  socket.on("disconnect", () => {
    if (statusDiv) statusDiv.textContent = "Disconnected";
  });

  if (chatSendBtn && chatInput) {
    chatSendBtn.onclick = () => {
      console.log("test");
      const msg = chatInput.value.trim();
      if (msg) {
        console.log("Sending chat message:", msg); // Add this line
        socket.emit("chat message", msg);
        chatInput.value = "";
      }
    };
  }

  socket.on("chat message", (msg: string) => {
    console.log(msg);
    if (messagesDiv) {
      const msgElem = document.createElement("div");
      msgElem.textContent = msg;
      messagesDiv.appendChild(msgElem);
    }
  });
});
