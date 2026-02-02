import "dotenv/config.js";
import express from "express";
import { matchRouter } from "./routes/matches.js";
import http from "http";
import { attachWebsocketServer } from "./ws/server.js";
const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1.0 REST API --> ROUTES

// 1.1 Get Route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// 1.2 Match Routes
app.use("/matches", matchRouter);

// 2.0 REAL-TIME --> WEBSOCKETS

// 2.1 Attaching The Websocket Server
const { broadcastMatchCreated } = attachWebsocketServer(server);

// 2.3 To access the function anyWhere in the app
app.locals.broadcastMatchCreated = broadcastMatchCreated;

// 3.0 Server Listening
server.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  const urlHost = HOST.includes(":") ? `[${displayHost}]` : displayHost;
  const baseUrl = `http://${urlHost}:${PORT}`;
  console.log(`Server is listening at ${baseUrl}`);
  console.log(
    `WebSocket Server is listening at ${baseUrl.replace("http", "ws")}/ws`,
  );
});
