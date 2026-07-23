import { NextResponse } from "next/server";

type CreateMondayTaskRequest = {
  contentId: string;
  title: string;
  client: string;
  format: string;
  scheduledFor?: string;
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
  const body = (await request.json()) as Partial<CreateMondayTaskRequest>;
  if (!body.contentId || !body.title || !body.client || !body.format) {
    return NextResponse.json(
      { error: "contentId, title, client and format are required" },
      { status: 400 },
    );
  }

  const token = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_CONTENT_BOARD_ID;
  if (!token || !boardId) {
    return NextResponse.json(
      {
        error: "Monday push is not configured yet",
        nextStep:
          "Set MONDAY_API_TOKEN and MONDAY_CONTENT_BOARD_ID as server-side secrets, then add the board column mapping.",
      },
      { status: 503 },
    );
  }

  const columnValues: Record<string, unknown> = {
    dropdown14: body.client,
    dropdown9: body.format,
  };
  if (body.scheduledFor) columnValues.date6 = { date: body.scheduledFor };

  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: createItemMutation,
      variables: {
        boardId,
        groupId: process.env.MONDAY_DEFAULT_GROUP_ID,
        itemName: `[${body.contentId}] ${body.title}`,
        columnValues: JSON.stringify(columnValues),
      },
    }),
  });

  const result = await response.json();
  if (!response.ok || result.errors) {
    return NextResponse.json(
      { error: "Monday rejected the task", details: result.errors ?? result },
      { status: 502 },
    );
  }

  return NextResponse.json({ item: result.data.create_item });
}
