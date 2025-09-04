import { createServer } from 'http';
import app from "./app.js";
import config from "./config/config.js";
import db from "./db/db.js";
import { initializeSocketService } from './websocket/SocketService.js';

db(); //Fail-fast: Initialize the database connection before application starts

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io
const socketService = initializeSocketService(server);

// Start server
server.listen(config().PORT, () => {
  console.log(`Application is listening http://localhost:${config().PORT}`);
  console.log(`WebSocket server initialized and ready for connections`);
});
