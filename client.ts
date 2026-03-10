import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { io } from 'socket.io-client';

const app = express();
const server = createServer(app);
const socket = io("http://localhost:3000");

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

server.listen(3001, () => {
  console.log('client started at http://localhost:3001');
});
