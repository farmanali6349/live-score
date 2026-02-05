import { WebSocket, WebSocketServer } from "ws";
import { webSocketArcjet } from "../arcjet.js";

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

  // Web Socket Security Via Arcjet
  server.on("upgrade", async (req, socket, head) => {
    if (webSocketArcjet) {
      try {
        const decision = await webSocketArcjet.protect(req);

        if (decision.isDenied()) {
          if (decision.reason.isRateLimit()) {
            socket.write(
              "HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n",
            );
          } else {
            socket.write("HTTP/1.1 403 Too Forbidden\r\n");
          }
          socket.destroy();
          return;
        }
      } catch (error) {
        console.error("Upgrade Protection Error", error);
        socket.write("HTTP/1.1 500 Internal Server Error\r\n");
        socket.destroy();
        return;
      }
    }
  });

  wss.on("connection", async (socket, request) => {
    socket.isAlive = true;
    socket.on("pong", () => (socket.isAlive = true));

    sendJson(socket, { type: "welcome" });

    socket.on("error", (err) => {
      console.error("WebSocket error:", err.message);
    });
  });

  // Setting Interval for Ping after every 30sec
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        ws.terminate();
      }
      ws.isAlive = false;

      try {
        ws.ping();
      } catch (err) {
        console.error("Ping error:", err);
      }
    });
  }, 30000);

  wss.on("close", () => {
    // Clear The Ping events
    clearInterval(pingInterval);

    // Closing The Clients
    wss.clients.forEach((ws) => ws.close(1001, "Server shutting down"));
  });

  function broadcastMatchCreated(match) {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
