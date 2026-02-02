import { MATCH_STATUS } from "../validation/matches.js";

/**
 * Determine a match's status based on its start and end times.
 * @param {Date|string|number} startTime - Match start time (Date or value parsable by Date).
 * @param {Date|string|number} endTime - Match end time (Date or value parsable by Date).
 * @param {Date} [now=new Date()] - Reference time to evaluate status.
 * @returns {('SCHEDULED'|'LIVE'|'FINISHED'|null)} `MATCH_STATUS.SCHEDULED`, `MATCH_STATUS.LIVE`, or `MATCH_STATUS.FINISHED` for the match state; returns `null` if `startTime` or `endTime` is invalid.
 */
export function getMatchStatus(startTime, endTime, now = new Date()) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (now < start) {
    return MATCH_STATUS.SCHEDULED;
  }

  if (now >= end) {
    return MATCH_STATUS.FINISHED;
  }

  return MATCH_STATUS.LIVE;
}

/**
 * Synchronizes a match object's status with the status computed from its start and end times, persisting any change.
 * @param {Object} match - Match object with properties `startTime`, `endTime`, and `status`; this object may be mutated to reflect the new status.
 * @param {(newStatus: string) => Promise<void>} updateStatus - Async function invoked with the new status when a change is required.
 * @returns {string|null} The match's status after synchronization (may be `null` if the match's status is `null` or computation failed).
 */
export async function syncMatchStatus(match, updateStatus) {
  const nextStatus = getMatchStatus(match.startTime, match.endTime);

  if (!nextStatus) {
    return match.status;
  }

  if (match.status !== nextStatus) {
    await updateStatus(nextStatus);
    match.status = nextStatus;
  }

  return match.status;
}