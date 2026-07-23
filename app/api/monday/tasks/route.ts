import { NextResponse } from "next/server";

type CreateMondayTaskRequest = {
  contentId: string;
  title: string;
  client: string;
  format: string;
  scheduledFor?: string;
  contentBrief?: string;
};

type CreateMondayTasksRequest = {
  boardId?: string;
  groupId?: string;
  tasks?: CreateMondayTaskRequest[];
};

const formatLabels: Record<string, string> = {
  "วิดีโอ": "วีดิโอ",
  "ภาพนิ่ง": "ภาพ",
};

const createItemMutation = `
  mutation CreateItem($boardId: ID!, $groupId: String, $itemName: String!, $columnValues: JSON!) {
    create_item(
      board_id: $boardId
      group_id: $groupId
      item_name: $itemName
      column_values: $columnValues
    ) { id name }
  }
`;

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateMondayTaskRequest & CreateMondayTasksRequest>;
  const tasks = body.tasks ?? (body.contentId ? [body as CreateMondayTaskRequest] : []);
  if (!tasks.length || tasks.some((task) => !task.contentId || !task.title || !task.client || !task.format)) {
    return NextResponse.json(
      { error: "contentId, title, client and format are required" },
      { status: 400 },
    );
  }

  const token = process.env.MONDAY_API_TOKEN;
  const boardId = body.boardId || process.env.MONDAY_CONTENT_BOARD_ID;
  if (!token || !boardId) {
    return NextResponse.json(
      {
        error: "Monday push is not configured yet",
        nextStep:
          "Set MONDAY_API_TOKEN and MONDAY_CONTENT_BOARD_ID as server-side secrets. Set MONDAY_CONTENT_BRIEF_COLUMN_ID too when the task should receive the generated slide brief.",
      },
      { status: 503 },
    );
  }

  const created: { id: string; name: string }[] = [];
  for (const task of tasks) {
    const mondayFormat = formatLabels[task.format] ?? task.format;
    const columnValues: Record<string, unknown> = {
      dropdown14: { labels: [task.client] },
      dropdown9: { labels: [mondayFormat] },
    };
    if (task.scheduledFor) columnValues.date6 = { date: task.scheduledFor };
    if (task.contentBrief && process.env.MONDAY_CONTENT_BRIEF_COLUMN_ID) {
      columnValues[process.env.MONDAY_CONTENT_BRIEF_COLUMN_ID] = task.contentBrief;
    }
    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: createItemMutation,
        variables: {
          boardId,
          groupId: body.groupId || process.env.MONDAY_DEFAULT_GROUP_ID,
          itemName: task.title,
          columnValues: JSON.stringify(columnValues),
        },
      }),
    });
    const result = await response.json() as { errors?: unknown; data?: { create_item?: { id: string; name: string } } };
    if (!response.ok || result.errors || !result.data?.create_item) {
      return NextResponse.json(
        { error: "Monday rejected the task", created: created.length, details: result.errors ?? result },
        { status: 502 },
      );
    }
    created.push(result.data.create_item);
  }
  return NextResponse.json({ created: created.length, items: created });
}
