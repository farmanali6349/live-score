import "dotenv/config.js";
import express from "express";
import { matchRouter } from "./routes/matches.js";
import http from "http";
import { attachWebsocketServer } from "./ws/server.js";
import { appEvents } from "./events/events.js";

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REST API --> ROUTES

// Get Route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// REAL-TIME --> WEBSOCKETS

// Attaching The Websocket Server
const { broadcastMatchCreated } = attachWebsocketServer(server);

// Listening To App Events
// New Match Created
appEvents.on("match_created", broadcastMatchCreated);

// Match Routes
app.use("/matches", matchRouter);

// Server Listening
server.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  const urlHost = HOST.includes(":") ? `[${displayHost}]` : displayHost;
  const baseUrl = `http://${urlHost}:${PORT}`;
  console.log(`Server is listening at ${baseUrl}`);
  console.log(
    `WebSocket Server is listening at ${baseUrl.replace("http", "ws")}/ws`,
  );
});
