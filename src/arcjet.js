import "dotenv/config.js";
import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";

// Checking The Environment Variables Required
const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE === "DRY_RUN" ? "DRY_RUN" : "LIVE";

if (!arcjetKey) throw new Error("Invalid or Absent Arcjet Key");

// Arcjet To Protect The REST API (http, https) Routes
export const httpArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: arcjetMode }),
        detectBot({
          mode: arcjetMode,
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW", "POSTMAN"],
        }),
        slidingWindow({ mode: arcjetMode, interval: "10s", max: 50 }),
      ],
    })
  : null;

// Arcjet To Protect The Web Socket Connections
export const webSocketArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: arcjetMode }),
        detectBot({
          mode: arcjetMode,
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW", "POSTMAN"],
        }),
        slidingWindow({ mode: arcjetMode, interval: "2s", max: 5 }),
      ],
    })
  : null;

export function securityMiddleware() {
  return async (req, res, next) => {
    if (!httpArcjet) return next();

    try {
      const decision = await httpArcjet.protect(req);
      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          return res
            .status(429)
            .json({ success: false, error: "Too many requests" });
        }

        return res.status(403).json({ success: false, error: "Forbidden" });
      }
    } catch (e) {
      console.error("Arcjet Middleware Error :: ", e);
      return res.status(503).json({
        success: false,
        error: "Service Unavailable",
      });
    }

    next();
  };
}
