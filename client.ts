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

