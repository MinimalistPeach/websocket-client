declare const io: any;
const socket = io("http://localhost:3000");
socket.io.opts.extraHeaders = {
    "Access-Control-Allow-Origin": "*"
};
socket.on("connect", () => {
    console.log("Connected: " + socket.id);
});

socket.on("disconnect", () => {
    console.log("Disconnected");
});

socket.on("enough_users", () => {
    alert("Cannot connect: 2 users are already connected");
});

socket.on("player_moved", (data: { id: string, pos: { x: number, y: number } }) => {
    console.log(`Player ${data.id} moved to (${data.pos.x}, ${data.pos.y})`);

});

socket.on("set_health", (data: { id: string, health: number }) => {
    console.log(`Player ${data.id} health set to ${data.health}`);
});

socket.emit("move_player", 5, 0);

