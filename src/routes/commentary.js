import { Router } from "express";
import {
  createCommentarySchema,
  listCommentaryQueryShema,
} from "../validation/commentary.js";
import { db } from "../db/db.js";
import { appEvents } from "../events/events.js";
import { matchIdParamSchema } from "../validation/matches.js";
import { commentary } from "../db/schema.js";
import { eq } from "drizzle-orm";
const MAX_LIMIT = 100;
export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get("/", async (req, res) => {
  // Validating matchId from Params
  const idParsed = matchIdParamSchema.safeParse(req.params);

  if (!idParsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid matchId",
      details: idParsed.error.issues,
    });
  }

  const parsedLimit = listCommentaryQueryShema.safeParse(req.query);

  if (!parsedLimit.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid query params",
      details: parsedLimit.error.issues,
    });
  }

  // Establishing The Limit
  const limit = Math.min(parsedLimit.data.limit ?? 50, MAX_LIMIT);

  try {
    const commentaryList = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, idParsed.data.id))
      .orderBy(commentary.createdAt)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Got Commentary List Successfully",
      data: commentaryList,
    });
  } catch (error) {
    console.error("Error Listing Commentary", error);
    return res.status(500).json({
      success: false,
      error: "Error Getting List Of Commentary",
    });
  }
});

// Route For Creating New Commentary
commentaryRouter.post("/", async (req, res) => {
  // Validating matchId from Params
  const idParsed = matchIdParamSchema.safeParse(req.params);

  if (!idParsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid matchId",
      details: idParsed.error.issues,
    });
  }

  // Validating Data
  const parsed = createCommentarySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid Payload",
      details: parsed.error.issues,
    });
  }

  // Creating New Commentary
  try {
    const [event] = await db
      .insert(commentary)
      .values({
        matchId: idParsed.data.id,
        ...parsed.data,
      })
      .returning();

    // Emitting An App Event For Commentary Broadcasting
    try {
      appEvents.emit("commentary_created", event);
    } catch (emitError) {
      console.error("commentary_created emit failed", emitError);
    }

    return res.status(201).json({
      success: true,
      message: "Commentary created successfully",
      data: event,
    });
  } catch (error) {
    // Handling Error In Match Creation
    console.error("Error Creating new commentary", error);
    return res.status(500).json({
      success: false,
      error: "Error in creating new commentary",
    });
  }
});
