declare const io: any;
const socket = io("http://localhost:3000");
let playerId: string = '';
socket.io.opts.extraHeaders = {
    "Access-Control-Allow-Origin": "*"
};
socket.on("connect", () => {
    console.log("Connected: " + socket.id);
    playerId = socket.id;
    socket.emit("window_details", { width: window.innerWidth, height: window.innerHeight });
});

socket.on("disconnect", () => {
    console.log("Disconnected");
});

socket.on("send_apple_data", (data: { id: string, pos: { x: number, y: number } }[]) => {
    console.log("Received apple data:", data);
    const container = document.getElementById("objects")!;

    data.forEach(apple => {
        const appleElement = document.createElement("div");
        appleElement.style.position = "absolute";
        appleElement.style.left = apple.pos.x.toString() + "px";
        appleElement.style.top = apple.pos.y.toString() + "px";
        appleElement.style.width = "20px";
        appleElement.style.height = "20px";
        appleElement.style.backgroundColor = "red";
        appleElement.style.borderRadius = "50%";
        container.appendChild(appleElement);
    });
});

socket.on("send_player_data", (data: { _id: string, _color: string, _pos: { x: number, y: number } }[]) => {
    console.log("Received player data:", data);
    const player = data.find(p => p._id === playerId);
    const player2 = data.find(p => p._id !== playerId);
    if (player) {
        document.getElementById("snake")!.style.backgroundColor = player._color;
        document.getElementById("snake")!.style.left = (player._pos.x).toString() + "px";
        document.getElementById("snake")!.style.top = (player._pos.y).toString() + "px";
        document.getElementById("userid")!.textContent = `Player ID: ${player._id}`;
        document.getElementById("userid")!.style.left = (player._pos.x).toString() + "px";
        document.getElementById("userid")!.style.top = (player._pos.y + 20).toString() + "px";
    }

    if (player2) {
        document.getElementById("snake2")!.style.backgroundColor = player2._color;
        document.getElementById("snake2")!.style.left = (player2._pos.x).toString() + "px";
        document.getElementById("snake2")!.style.top = (player2._pos.y).toString() + "px";
        document.getElementById("userid2")!.textContent = `Player ID: ${player2._id}`;
        document.getElementById("userid2")!.style.left = (player2._pos.x).toString() + "px";
        document.getElementById("userid2")!.style.top = (player2._pos.y + 20).toString() + "px";
    }

});

socket.on("enough_users", () => {
    alert("Cannot connect: 2 users are already connected");
});

socket.on("player_moved", (data: { id: string, pos: { x: number, y: number } }[]) => {
    console.log(data)
    data.map(d => {
        if (d.id === playerId) {
            document.getElementById("snake")!.style.left = d.pos.x.toString() + 'px';
            document.getElementById("snake")!.style.top = d.pos.y.toString() + 'px';
            document.getElementById("userid")!.style.left = (d.pos.x).toString() + "px";
            document.getElementById("userid")!.style.top = (d.pos.y - 20).toString() + "px";
        }
        else {
            document.getElementById("snake2")!.style.left = d.pos.x.toString() + 'px';
            document.getElementById("snake2")!.style.top = d.pos.y.toString() + 'px';
            document.getElementById("userid2")!.style.left = (d.pos.x).toString() + "px";
            document.getElementById("userid2")!.style.top = (d.pos.y - 20).toString() + "px";
        }
        console.log(`Player ${d.id} moved to (${d.pos.x}, ${d.pos.y})`);
    });
});

socket.on("set_health", (data: { id: string, health: number }) => {
    console.log(`Player ${data.id} health set to ${data.health}`);
});

setInterval(() => {
    const directions = ['up', 'down', 'left', 'right'];
    const randomDirection = directions[Math.floor(Math.random() * directions.length)];
    socket.emit("move_player", { direction: randomDirection });
}, 1000 / 60);

