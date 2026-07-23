import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

type MetaAction = { action_type?: string; value?: string };
type MetaInsight = {
  ad_id?: string;
  ad_name?: string;
  date_start?: string;
  spend?: string;
  actions?: MetaAction[];
};

const sumActions = (actions: MetaAction[] | undefined, match: RegExp) =>
  (actions ?? []).reduce(
    (total, action) =>
      match.test(action.action_type ?? "")
        ? total + Number(action.value ?? 0)
        : total,
    0,
  );

function isoDate(value: string | null, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback.toISOString().slice(0, 10);
  return value;
}

/**
 * Imports new, ad-level Meta results only. It deliberately does not attempt a
 * historical content backfill: a record becomes eligible for matching once the
 * team gives its content a Content ID and maps the Meta ad in the app.
 */
export async function POST(request: Request) {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const version = process.env.META_GRAPH_API_VERSION;
  const accountIds = (process.env.META_AD_ACCOUNT_IDS ?? "")
    .split(",")
    .map((id) => id.trim().replace(/^act_/, ""))
    .filter(Boolean);

  if (!token || !version || accountIds.length === 0) {
    return NextResponse.json(
      {
        error: "Meta sync is not configured yet",
        nextStep:
          "Add META_SYSTEM_USER_TOKEN, META_GRAPH_API_VERSION and META_AD_ACCOUNT_IDS as private server-side secrets. Do not put tokens in the browser or source code.",
      },
      { status: 503 },
    );
  }

  if (!env.DB) {
    return NextResponse.json(
      { error: "Database binding DB is unavailable" },
      { status: 503 },
    );
  }

  const input = (await request.json().catch(() => ({}))) as {
    since?: string;
    until?: string;
  };
  const today = new Date();
  const since = isoDate(input.since ?? null, today);
  const until = isoDate(input.until ?? null, today);
  const syncedAt = new Date().toISOString();
  let saved = 0;
  const accountResults: { accountId: string; rows: number }[] = [];

  for (const accountId of accountIds) {
    const url = new URL(`https://graph.facebook.com/${version}/act_${accountId}/insights`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("level", "ad");
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("fields", "ad_id,ad_name,date_start,spend,actions");
    url.searchParams.set("time_range", JSON.stringify({ since, until }));

    const response = await fetch(url);
    const payload = (await response.json()) as { data?: MetaInsight[]; error?: unknown };
    if (!response.ok || payload.error) {
      return NextResponse.json(
        { error: "Meta rejected the insight request", accountId, details: payload.error ?? payload },
        { status: 502 },
      );
    }

    await env.DB.prepare(
      `INSERT INTO meta_ad_accounts (meta_account_id, account_name, delivery_status, last_synced_at)
       VALUES (?1, ?2, 'unknown', ?3)
       ON CONFLICT(meta_account_id) DO UPDATE SET
         last_synced_at = excluded.last_synced_at`,
    )
      .bind(accountId, `Meta ${accountId}`, syncedAt)
      .run();

    const account = await env.DB.prepare(
      "SELECT id FROM meta_ad_accounts WHERE meta_account_id = ?1",
    )
      .bind(accountId)
      .first<{ id: number }>();

    for (const row of payload.data ?? []) {
      if (!row.ad_id || !account) continue;
      const actions = row.actions ?? [];
      const inboxCount = sumActions(actions, /messaging.*conversation|conversation.*started/i);
      const leadCount = sumActions(actions, /(^|[._])lead/i);
      const spendMinor = Math.round(Number(row.spend ?? 0) * 100);

      await env.DB.prepare(
        "DELETE FROM performance_snapshots WHERE meta_ad_id = ?1 AND snapshot_date = ?2",
      )
        .bind(row.ad_id, row.date_start ?? since)
        .run();

      await env.DB.prepare(
        `INSERT INTO performance_snapshots
          (meta_ad_account_id, meta_ad_id, snapshot_date, spend, inbox_count, lead_count, source_payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
        .bind(
          account.id,
          row.ad_id,
          row.date_start ?? since,
          spendMinor,
          inboxCount,
          leadCount,
          JSON.stringify(row),
        )
        .run();
      saved += 1;
    }
    accountResults.push({ accountId, rows: (payload.data ?? []).length });
  }

  return NextResponse.json({ since, until, saved, accounts: accountResults });
}
