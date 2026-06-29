/**
 * GET /api/orchestration/process/:pid
 *
 * Returns the current state of an orchestration process.
 *
 * Returns: { item: { process, steps, extractions, clarifications } }
 */

import { getProcess, listProcesses } from "../../../../src/orchestration/process-tracker.js";

export async function onRequestGet(context) {
  const db = context.env.DB;
  const pid = context.params.pid;

  if (!pid) {
    const url = new URL(context.request.url);
    const status = url.searchParams.get("status");
    const orderId = url.searchParams.get("orderId");
    const limit = url.searchParams.get("limit") || 50;
    const offset = url.searchParams.get("offset") || 0;

    const result = await listProcesses({ db, status, orderId, limit, offset });
    return Response.json({ success: true, items: result.items || [] });
  }

  const process = await getProcess({ db, processId: pid });
  if (process.error) {
    return Response.json({ success: false, error: process.error }, { status: 404 });
  }

  const steps = await db.prepare(
    "SELECT * FROM orchestration_steps WHERE process_id = ? ORDER BY created_at DESC"
  ).bind(pid).all();

  const extractions = await db.prepare(
    "SELECT * FROM orchestration_extractions WHERE process_id = ? ORDER BY created_at DESC"
  ).bind(pid).all();

  const clarifications = await db.prepare(
    "SELECT * FROM orchestration_clarifications WHERE process_id = ? ORDER BY created_at DESC"
  ).bind(pid).all();

  return Response.json({
    success: true,
    item: {
      ...process.item,
      steps: steps?.results || [],
      extractions: extractions?.results || [],
      clarifications: clarifications?.results || []
    }
  });
}
