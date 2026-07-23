import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

type BoardRow = {
  board_id: string;
  board_name: string;
  default_group_id: string | null;
  default_group_name: string | null;
};

export async function GET() {
  if (!env.DB) return NextResponse.json({ boards: [] });
  const result = await env.DB.prepare(
    `SELECT board_id, board_name, default_group_id, default_group_name
       FROM monday_board_mappings WHERE active = 1 ORDER BY created_at ASC`,
  ).all<BoardRow>();
  return NextResponse.json({
    boards: result.results.map((board) => ({
      id: board.board_id,
      name: board.board_name,
      groups: board.default_group_id ? [{ id: board.default_group_id, label: board.default_group_name || "Group ปลายทาง" }] : [],
    })),
  });
}

export async function POST(request: Request) {
  if (!env.DB) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { boardId?: string; boardName?: string; groupId?: string; groupName?: string } | null;
  const boardId = body?.boardId?.trim();
  const boardName = body?.boardName?.trim();
  const groupId = body?.groupId?.trim();
  const groupName = body?.groupName?.trim();
  if (!boardId || !boardName || !groupId || !groupName) return NextResponse.json({ error: "Board and Group details are required" }, { status: 400 });

  await env.DB.prepare(
    `INSERT INTO monday_board_mappings (board_id, board_name, default_group_id, default_group_name, active)
     VALUES (?1, ?2, ?3, ?4, 1)
     ON CONFLICT(board_id) DO UPDATE SET board_name = excluded.board_name, default_group_id = excluded.default_group_id, default_group_name = excluded.default_group_name, active = 1`,
  ).bind(boardId, boardName, groupId, groupName).run();
  return NextResponse.json({ board: { id: boardId, name: boardName, groups: [{ id: groupId, label: groupName }] } });
}
