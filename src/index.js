import express from "express";
import { matchRouter } from "./routes/matches.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Get Route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// MATCH ROUTES
app.use("/matches", matchRouter);

// Server Listening
app.listen(port, () => {
  console.log(`Server started on port http://localhost:${port}`);
});
