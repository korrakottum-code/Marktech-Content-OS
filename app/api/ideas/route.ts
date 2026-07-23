import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";

type ProductBrief = { id?: string; product?: string; goal?: string; customNeed?: string };
type GeneratedIdea = {
  id?: string;
  product: string;
  title: string;
  hook: string;
  reason: string;
  adminAngle: string;
  format: "วิดีโอ" | "ภาพ" | "อัลบั้ม";
  pillar: string;
  category: "โปรโมชั่น / Offer" | "รีวิว / Proof" | "ความรู้ / FAQ" | "แบรนด์ / ไลฟ์สไตล์";
  visualDirection: string;
  adaptation: string;
};

function cleanIdeas(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((idea): idea is GeneratedIdea => Boolean(idea) && typeof idea === "object")
    .map((idea, index) => ({
      id: `IDEA-${String(index + 1).padStart(2, "0")}`,
      product: String(idea.product ?? "ไม่ระบุโปรดักต์").slice(0, 80),
      title: String(idea.title ?? "").slice(0, 180),
      hook: String(idea.hook ?? "").slice(0, 180),
      reason: String(idea.reason ?? "").slice(0, 280),
      adminAngle: String(idea.adminAngle ?? "").slice(0, 240),
      format: ["วิดีโอ", "ภาพ", "อัลบั้ม"].includes(idea.format) ? idea.format : "ภาพ",
      pillar: String(idea.pillar ?? "Content idea").slice(0, 80),
      category: ["โปรโมชั่น / Offer", "รีวิว / Proof", "ความรู้ / FAQ", "แบรนด์ / ไลฟ์สไตล์"].includes(idea.category) ? idea.category : "โปรโมชั่น / Offer",
      visualDirection: String(idea.visualDirection || "ภาพโปรโมชันที่มีพื้นที่วางข้อความ").slice(0, 240),
      adaptation: String(idea.adaptation || "สร้างมุมใหม่จากโจทย์เดือนนี้").slice(0, 220),
    }))
    .filter((idea) => idea.title && idea.hook && idea.reason && idea.adminAngle);
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as {
    client?: string;
    planMonth?: string;
    theme?: string;
    quantity?: number;
    briefs?: ProductBrief[];
    industry?: string;
    reusePolicy?: "avoid" | "adapt";
    promotionMix?: number;
  } | null;
  if (!input?.client || !input.planMonth || !Array.isArray(input.briefs) || input.briefs.length === 0) {
    return NextResponse.json({ error: "Missing planning brief" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI is not configured",
        nextStep: "ยังไม่ได้เชื่อม AI กับเว็บแอปนี้ — เพิ่ม OPENAI_API_KEY เป็น secret ฝั่งเซิร์ฟเวอร์ แล้วกดให้ AI คิดใหม่ได้ทันที",
      },
      { status: 503 },
    );
  }

  const target = 36;
  const promotionMix = Math.max(30, Math.min(75, Math.round(input.promotionMix ?? 50)));
  let priorContent: { results: { title: string; hook: string | null; pillar: string | null }[] } = { results: [] };
  try {
    priorContent = env.DB ? await env.DB.prepare(
    `SELECT content_items.title, content_items.hook, content_items.pillar
       FROM content_items JOIN clients ON clients.id = content_items.client_id
       WHERE clients.name = ?1 AND content_items.status IN ('approved', 'sent_to_monday')
       ORDER BY content_items.created_at DESC LIMIT 80`,
    ).bind(input.client).all<{ title: string; hook: string | null; pillar: string | null }>() : { results: [] };
  } catch { priorContent = { results: [] }; }
  const priorText = priorContent.results.map((item) => `${item.title}${item.hook ? ` | ${item.hook}` : ""}`).join("\n");
  const instructions = `
คุณคือ Senior Content Strategist ของ performance media agency ในไทย

อุตสาหกรรมของลูกค้าคือ ${input.industry || "คลินิกความงาม"}. ปรับภาษา มุมเล่า และคำเตือนให้เหมาะกับอุตสาหกรรมนั้น; อย่าตั้งสมมติฐานว่าเป็นคลินิกหากไม่ได้ระบุว่าเป็นคลินิก
เป้าหมาย: สร้างไอเดียคอนเทนท์ที่ช่วยให้คนเข้าใจ เกิดความเชื่อใจ และพาไปสู่การทักแชต/นัด/ซื้อ ไม่ใช่คอนเทนท์เพื่อยอด reach อย่างเดียว
สร้าง IDEA_COUNT ไอเดีย โดยประมาณ ${promotionMix}% ต้องเป็น category "โปรโมชั่น / Offer" ที่ขายได้จริง: ราคา/สิทธิพิเศษ/แพ็กเกจ/ช่วงเวลา/ของแถม/โปรคู่/ข้อเสนอให้ทัก ไม่ใช่แค่คำว่าโปรโมชันลอย ๆ
ส่วนที่เหลือจึงค่อยกระจายเป็น "รีวิว / Proof", "ความรู้ / FAQ", "แบรนด์ / ไลฟ์สไตล์" โดย "ความรู้ / FAQ" ห้ามเกิน 20% เว้นแต่ brief บังคับ
หัวข้อทุกอันต้องเป็นภาษาที่ลูกค้าเห็นแล้วเข้าใจทันทีว่าโพสต์ขายอะไร ห้ามใช้หัวข้อกว้างหรือประหลาด เช่น "เปลี่ยนมุมมอง" หรือ "เปิดโลกใหม่"
คละ format วิดีโอ ภาพ อัลบั้มตามความเหมาะสมกับชิ้นงาน ไม่ต้องบังคับสัดส่วนเท่ากัน
ถ้ามีหลายโปรดักต์ ต้องกระจายตามน้ำหนักของ brief และยังมีคอนเทนท์ภาพรวมของแบรนด์ได้เมื่อเหมาะสม
ทุกไอเดียต้องมี title, hook, reason, adminAngle ที่นำไปใช้จริงได้ และอยู่ในภาษาไทย

ประวัติคอนเทนท์ที่ทีมเคยอนุมัติสำหรับลูกค้ารายนี้:
${priorText || "ยังไม่มีประวัติ"}
นโยบายความซ้ำ: ${input.reusePolicy === "adapt" ? "ใช้หลัก Copy-to-Adapt: ถ้า hook หรือโครงจากประวัติยังดี ให้ต่อยอดได้ โดยระบุใน adaptation ว่าหยิบอะไรมาและเปลี่ยน product, offer, กลุ่มคน หรือบริบทเดือนไหนอย่างไร; ห้ามแค่เปลี่ยนคำ" : "สร้างมุมใหม่เป็นหลัก แต่ไม่ต้องถือว่าทุกความคล้ายเป็นความผิด"}

ตอบเป็น JSON เท่านั้น ตามรูปแบบ {"ideas":[{"product":"","title":"","hook":"","reason":"","adminAngle":"","format":"วิดีโอ|ภาพ|อัลบั้ม","pillar":"","category":"โปรโมชั่น / Offer|รีวิว / Proof|ความรู้ / FAQ|แบรนด์ / ไลฟ์สไตล์","visualDirection":"","adaptation":""}]}
`;
  const brief = {
    client: input.client,
    planMonth: input.planMonth,
    monthlyConcept: input.theme || "ยังไม่ได้ระบุ",
    industry: input.industry || "คลินิกความงาม",
    contentTarget: input.quantity,
    promotionMix,
    productsAndNeeds: input.briefs.map(({ id: _id, ...item }) => item),
  };

  try {
    const batchSize = 10;
    const batches = Array.from({ length: Math.ceil(target / batchSize) }, (_, index) => Math.min(batchSize, target - index * batchSize));
    const results = await Promise.all(batches.map(async (count, batchIndex) => {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model: process.env.OPENAI_CONTENT_MODEL ?? "gpt-5.6-terra",
          input: [{ role: "developer", content: [{ type: "input_text", text: instructions.replace("IDEA_COUNT", String(count)) + `\nชุดที่ ${batchIndex + 1}: เลือกมุมและ Hook ที่ไม่ซ้ำกับชุดอื่น` }] }, { role: "user", content: [{ type: "input_text", text: JSON.stringify(brief) }] }],
          reasoning: { effort: "low" },
          max_output_tokens: 4200,
          text: { format: { type: "json_object" } },
        }),
      });
      const payload = await response.json() as { output_text?: string; error?: { message?: string }; output?: Array<{ content?: Array<{ text?: string }> }> };
      if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI rejected the generation");
      const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("");
      const parsed = JSON.parse(text) as { ideas?: unknown };
      return cleanIdeas(parsed.ideas);
    }));
    const ideas = results.flat().map((idea, index) => ({ ...idea, id: `IDEA-${String(index + 1).padStart(2, "0")}` }));
    if (ideas.length < 24) throw new Error("AI returned too few usable ideas");
    return NextResponse.json({ ideas: ideas.slice(0, target) });
  } catch (error) {
    return NextResponse.json({ error: "AI generation failed", nextStep: error instanceof Error ? error.message : "ลองกดสร้างอีกครั้ง หรือปรับโจทย์ให้เฉพาะเจาะจงขึ้น" }, { status: 502 });
  }
}
