import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

type HistoryItem = { id?: string; title?: string; hook?: string; pillar?: string; format?: string; product?: string; reason?: string };

function fingerprint(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}

export async function POST(request: Request) {
  if (!env.DB) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { client?: string; planMonth?: string; serviceScope?: "content" | "ads_only"; items?: HistoryItem[] } | null;
  if (!body?.client || !body.planMonth || !body.items?.length) return NextResponse.json({ error: "Missing approved plan data" }, { status: 400 });

  const clientCode = fingerprint(body.client).toUpperCase();
  await env.DB.prepare(
    `INSERT INTO clients (client_code, name, service_scope, contract_status)
     VALUES (?1, ?2, 'content', 'active')
     ON CONFLICT(client_code) DO UPDATE SET name = excluded.name, service_scope = excluded.service_scope, updated_at = CURRENT_TIMESTAMP`,
  ).bind(clientCode, body.client, body.serviceScope ?? "content").run();
  const client = await env.DB.prepare("SELECT id FROM clients WHERE client_code = ?1").bind(clientCode).first<{ id: number }>();
  if (!client) return NextResponse.json({ error: "Unable to save client history" }, { status: 500 });

  for (const item of body.items) {
    if (!item.title) continue;
    const contentId = `${clientCode}-${body.planMonth.replace("-", "")}-${fingerprint(item.title)}`;
    await env.DB.prepare(
      `INSERT INTO content_items (content_id, client_id, title, status, source_type, format, program, pillar, hook, rationale, duplicate_fingerprint)
       VALUES (?1, ?2, ?3, 'approved', 'webapp', ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(content_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
    ).bind(contentId, client.id, item.title, item.format ?? null, item.product ?? null, item.pillar ?? null, item.hook ?? null, item.reason ?? null, fingerprint(`${body.client}|${item.title}|${item.hook ?? ""}`)).run();
  }
  return NextResponse.json({ saved: body.items.length });
}
