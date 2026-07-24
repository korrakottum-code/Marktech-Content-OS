import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

type PlanPayload = Record<string, unknown> & {
  client?: string;
  planMonth?: string;
  planName?: string;
  brandReferenceImage?: string | null;
  slides?: Array<Record<string, unknown>>;
};

type PlanRow = {
  id: string;
  title: string;
  client_name: string;
  plan_month: string;
  status: string;
  payload: string;
  created_at: string;
  updated_at: string;
};

let planSchemaReady: Promise<void> | undefined;

function ensurePlanSchema() {
  if (!env.DB) throw new Error("Database is not configured");
  planSchemaReady ??= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS plan_drafts (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      client_name text NOT NULL,
      plan_month text NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      payload text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS plan_drafts_updated_idx ON plan_drafts (updated_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS plan_drafts_client_month_idx ON plan_drafts (client_name, plan_month)"),
  ]).then(() => undefined);
  return planSchemaReady;
}

function safePlanTitle(payload: PlanPayload) {
  const customName = typeof payload.planName === "string" ? payload.planName.trim() : "";
  if (customName) return customName.slice(0, 120);
  const client = typeof payload.client === "string" && payload.client.trim() ? payload.client.trim() : "ลูกค้าใหม่";
  const month = typeof payload.planMonth === "string" && payload.planMonth ? payload.planMonth : "ยังไม่กำหนดเดือน";
  return `${client} · แผน ${month}`;
}

function extensionFor(contentType: string) {
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

async function storeDataImage(id: string, name: string, source: unknown) {
  if (typeof source !== "string" || !source.startsWith("data:image/")) return source;
  if (!env.PLAN_ASSETS) throw new Error("พื้นที่เก็บภาพของแผนยังไม่พร้อม");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s.exec(source);
  if (!match) throw new Error("ไฟล์ภาพของร่างแผนไม่รองรับ");
  const [, contentType, encoded] = match;
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const key = `plans/${id}/${name}-${stableHash(source)}.${extensionFor(contentType)}`;
  await env.PLAN_ASSETS.put(key, bytes, { httpMetadata: { contentType } });
  return `/api/plan-assets?key=${encodeURIComponent(key)}`;
}

async function persistImages(id: string, original: PlanPayload) {
  const payload = structuredClone(original);
  payload.brandReferenceImage = await storeDataImage(id, "brand-reference", payload.brandReferenceImage);
  if (Array.isArray(payload.slides)) {
    payload.slides = await Promise.all(payload.slides.map(async (slide, index) => ({
      ...slide,
      image: await storeDataImage(id, `slide-${index + 1}-artwork`, slide.image),
      referenceImage: await storeDataImage(id, `slide-${index + 1}-reference`, slide.referenceImage),
    })));
  }
  return payload;
}

function planResponse(row: PlanRow, includePayload = false) {
  const base = {
    id: row.id,
    title: row.title,
    client: row.client_name,
    planMonth: row.plan_month,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (!includePayload) return base;
  try {
    return { ...base, payload: JSON.parse(row.payload) };
  } catch {
    return { ...base, payload: null };
  }
}

export async function GET(request: Request) {
  if (!env.DB) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  await ensurePlanSchema();
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const row = await env.DB.prepare(
      "SELECT id, title, client_name, plan_month, status, payload, created_at, updated_at FROM plan_drafts WHERE id = ?1",
    ).bind(id).first<PlanRow>();
    if (!row) return NextResponse.json({ error: "ไม่พบร่างแผนนี้" }, { status: 404 });
    return NextResponse.json({ plan: planResponse(row, true) });
  }
  const result = await env.DB.prepare(
    "SELECT id, title, client_name, plan_month, status, payload, created_at, updated_at FROM plan_drafts ORDER BY updated_at DESC LIMIT 40",
  ).all<PlanRow>();
  return NextResponse.json({ plans: result.results.map((row) => planResponse(row)) });
}

export async function POST(request: Request) {
  if (!env.DB) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  await ensurePlanSchema();
  const body = await request.json().catch(() => null) as { id?: string; status?: string; payload?: PlanPayload } | null;
  if (!body?.payload || typeof body.payload !== "object") return NextResponse.json({ error: "ข้อมูลร่างแผนไม่ครบ" }, { status: 400 });
  const id = body.id?.trim() || crypto.randomUUID();
  const payload = await persistImages(id, body.payload);
  const title = safePlanTitle(payload);
  const client = typeof payload.client === "string" && payload.client.trim() ? payload.client.trim() : "ลูกค้าใหม่";
  const month = typeof payload.planMonth === "string" && payload.planMonth ? payload.planMonth : "";
  const status = body.status === "approved" || body.status === "sent_to_monday" || body.status === "completed" ? body.status : "draft";
  await env.DB.prepare(
    `INSERT INTO plan_drafts (id, title, client_name, plan_month, status, payload)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, client_name = excluded.client_name, plan_month = excluded.plan_month,
       status = excluded.status, payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
  ).bind(id, title, client, month, status, JSON.stringify(payload)).run();
  const row = await env.DB.prepare(
    "SELECT id, title, client_name, plan_month, status, payload, created_at, updated_at FROM plan_drafts WHERE id = ?1",
  ).bind(id).first<PlanRow>();
  return NextResponse.json({ plan: row ? planResponse(row, true) : { id, title, payload } });
}

export async function DELETE(request: Request) {
  if (!env.DB) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  await ensurePlanSchema();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุร่างแผนที่ต้องการลบ" }, { status: 400 });
  await env.DB.prepare("DELETE FROM plan_drafts WHERE id = ?1").bind(id).run();
  return NextResponse.json({ deleted: id });
}
