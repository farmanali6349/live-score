import { WebSocket, WebSocketServer } from "ws";
import { webSocketArcjet } from "../arcjet.js";

// Helper function to send JSON after checking if connection is open
function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

const matchSubscribers = new Map();

// Subscribe Function
function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }

  matchSubscribers.get(matchId).add(socket);
}

// Subscribe Function
function unSubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

// Cleanup Subscriptions
function cleanupSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unSubscribe(matchId, socket);
  }
}

function handleMessage(socket, data) {
  let message;

  try {
    // Convert Buffer to string
    let str = data.toString();

    // Remove surrounding single quotes if present
    if (str.startsWith("'") && str.endsWith("'")) {
      str = str.slice(1, -1);
    }

    // Parse JSON
    message = JSON.parse(str);
  } catch (error) {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
    return;
  }

  const type = message?.type;
  const matchId = message?.matchId;

  if (!type || !matchId) {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
    return;
  }

  if (type === "subscribe" && Number.isInteger(matchId)) {
    subscribe(matchId, socket);
    socket.subscriptions.add(matchId);
    sendJson(socket, { type: "subscribed", matchId });
    return;
  }

  if (type === "unsubscribe" && Number.isInteger(matchId)) {
    unSubscribe(matchId, socket);
    socket.subscriptions.delete(matchId);
    sendJson(socket, { type: "unsubscribed", matchId });
    return;
  }
}
// Broadcast To all active clients
function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;

    client.send(JSON.stringify(payload));
  }
}

// Broadcast To Specific Match
function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers || subscribers.size === 0) return;

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  }
}

// A function to attach the websocket server
export function attachWebsocketServer(server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
  });

  // Web Socket Security Via Arcjet
  server.on("upgrade", async (req, socket, head) => {
    // Only handle upgrades for the /ws path
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    if (webSocketArcjet) {
      try {
        const decision = await webSocketArcjet.protect(req);

        if (decision.isDenied()) {
          if (decision.reason.isRateLimit()) {
            socket.write(
              "HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n",
            );
          } else {
            socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
          }
          socket.destroy();
          return;
        }
      } catch (error) {
        console.error("Upgrade Protection Error", error);
        socket.write(
          "HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n",
        );
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (socket, request) => {
    socket.isAlive = true;

    // Attching The Empty Subscription Set To The New Socket
    socket.subscriptions = new Set();

    // Handle The Subscribe & UnSubscribe
    socket.on("message", (data) => {
      handleMessage(socket, data.toString());
    });

    socket.on("close", () => {
      cleanupSubscriptions(socket);
    });

    socket.on("error", () => {
      socket.terminate();
    });

    socket.on("pong", () => (socket.isAlive = true));

    sendJson(socket, { type: "welcome" });
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
    wss.clients.forEach((ws) => {
      ws.close(1001, "Server shutting down");
    });
  });

  function broadcastMatchCreated(match) {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentaryCreated(commentary) {
    broadcastToMatch(commentary.matchId, commentary);
  }

  return { broadcastMatchCreated, broadcastCommentaryCreated };
}
