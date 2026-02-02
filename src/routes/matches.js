import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/utils.js";
import { desc } from "drizzle-orm";
import { appEvents } from "../events/events.js";

// Maximum Limit For Matches
const MAX_LIMIT = 100;

export const matchRouter = Router();

// Get List Of Matches
matchRouter.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid Query",
      details: parsed.error.issues,
    });
  }
  // Establishing The Limit
  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    const matchesList = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Got Matches List Successfully",
      data: matchesList,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Error Getting List Of Matches",
    });
  }
});

// 1. Creating New Match - POST (/)
matchRouter.post("/", async (req, res) => {
  // 1. Validating Payload
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid Payload",
      details: parsed.error.issues,
    });
  }

  const { startTime, endTime, homeScore, awayScore } = parsed.data;

  // Creating Match
  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Emitting An App Event For Match Broadcasting
    try {
      appEvents.emit("match_created", event);
    } catch (emitError) {
      console.error("match_created emit failed", emitError);
    }

    return res.status(201).json({
      success: true,
      message: "Match created successfully",
      data: event,
    });
  } catch (error) {
    // Handling Error In Match Creation
    return res.status(500).json({
      success: false,
      error: "Error in creating new match",
    });
  }
});
