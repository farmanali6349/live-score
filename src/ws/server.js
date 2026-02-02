import { WebSocket, WebSocketServer } from "ws";

// Helper function to send JSON after checking if connection is open
function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

// Helper function to broadcast all active clients
function broadcast(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;

    client.send(JSON.stringify(payload));
  }
}

// A function to attach the websocket server
export function attachWebsocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", (socket, request) => {
    socket.isAlive = true;
    socket.on("pong", () => (socket.isAlive = true));

    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

  // Setting Interval for Ping after every 30sec
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(pingInterval));

  function broadcastMatchCreated(match) {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
