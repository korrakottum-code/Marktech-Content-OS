import { NextResponse } from "next/server";

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

  const target = Math.max(30, Math.min(40, Math.round((input.quantity ?? 12) * 2.5)));
  const instructions = `
คุณคือ Senior Content Strategist ของ performance media agency สำหรับคลินิกความงามในไทย

เป้าหมาย: สร้างไอเดียคอนเทนท์ที่ช่วยให้คนเข้าใจ เกิดความเชื่อใจ และพาไปสู่การทักแชต/นัด ไม่ใช่คอนเทนท์เพื่อยอด reach อย่างเดียว
ต้องคิดใหม่จาก brief นี้ ห้ามใช้ไอเดียซ้ำถ้อยคำหรือโครงเดิมมากเกินไป
สร้าง IDEA_COUNT ไอเดีย คละ format วิดีโอ ภาพ อัลบั้ม และคละ funnel/pillar เช่น pain point, educate, proof, objection, compare, FAQ, offer bridge, social proof
ถ้ามีหลายโปรดักต์ ต้องกระจายตามน้ำหนักของ brief และยังมีคอนเทนท์ภาพรวมของแบรนด์ได้เมื่อเหมาะสม
ทุกไอเดียต้องมี title, hook, reason, adminAngle ที่นำไปใช้จริงได้ และอยู่ในภาษาไทย

ตอบเป็น JSON เท่านั้น ตามรูปแบบ {"ideas":[{"product":"","title":"","hook":"","reason":"","adminAngle":"","format":"วิดีโอ|ภาพ|อัลบั้ม","pillar":""}]}
`;
  const brief = {
    client: input.client,
    planMonth: input.planMonth,
    monthlyConcept: input.theme || "ยังไม่ได้ระบุ",
    contentTarget: input.quantity,
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
