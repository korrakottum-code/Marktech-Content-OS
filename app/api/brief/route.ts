import { NextResponse } from "next/server";

type ContentCategory = "โปรโมชั่น / Offer" | "รีวิว / Proof" | "ความรู้ / FAQ" | "แบรนด์ / ไลฟ์สไตล์";
type PlanningGoal = "sales" | "trust" | "balanced" | "trend";

function responseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  return payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { command?: string; client?: string; planMonth?: string; quantity?: number; industry?: string } | null;
  const command = input?.command?.trim();
  if (!command) return NextResponse.json({ error: "Missing command" }, { status: 400 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI is not configured", nextStep: "เพิ่ม OPENAI_API_KEY เป็น secret ฝั่งเซิร์ฟเวอร์ก่อน" }, { status: 503 });

  const instructions = `
คุณเป็น Brief Planner ของ performance media agency ภาษาไทย
แปลงคำสั่งภาษาธรรมชาติของทีมเป็นข้อมูลโครงสร้างสำหรับสร้าง content plan โดยใช้ได้ทุกอุตสาหกรรม
ไม่แต่งราคา, หน่วย, โปร, ตัวเลข, claim, trend หรือข้อมูลจริงที่ผู้ใช้ไม่ได้ระบุเด็ดขาด
หากราคา/หน่วยไม่ชัด ให้คืนเป็นสตริงว่าง ไม่เดา
แยก “painFocus” ให้ชัด: คนกลุ่มไหนกำลังลังเล/ติดขัดอะไร/ต้องตัดสินใจอะไร ไม่ใช่แค่ชื่อโปร
หากคำสั่งระบุหลายสินค้า/หลายเรื่อง ให้แยก briefs หลายรายการ
requestedCategories ให้ส่งมาเฉพาะเมื่อผู้ใช้ระบุความต้องการชัด เช่น เน้นโปร, อยากได้รีวิว; ถ้าไม่ได้กำหนดคืน []
planningGoal เลือก sales, trust, balanced หรือ trend โดยใช้ sales เป็นค่าเริ่มต้น
quantity ต้องเป็นเลข 1–36 เฉพาะเมื่อผู้ใช้บอกจำนวนชัดเจน มิฉะนั้นใช้ quantityDefault
client/industry ใช้จากคำสั่งเมื่อระบุชัด มิฉะนั้นเก็บค่า default เดิม
summary เขียน 1 ประโยคภาษาไทยสรุปสิ่งที่เข้าใจ และบอกข้อมูลสำคัญที่ยังไม่ได้ระบุโดยไม่ถามคำถาม
ตอบ JSON เท่านั้นในโครงนี้:
{
 "planName":"", "client":"", "industry":"", "theme":"", "planningGoal":"sales", "freshContext":"", "quantity":8,
 "requestedCategories":[],
 "briefs":[{"product":"", "goal":"", "painFocus":"", "customNeed":"", "price":"", "priceUnit":""}],
 "summary":""
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: process.env.OPENAI_CONTENT_MODEL ?? "gpt-5.6-terra",
        input: [
          { role: "developer", content: [{ type: "input_text", text: instructions }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify({ command, defaults: { client: input?.client ?? "", planMonth: input?.planMonth ?? "", quantityDefault: input?.quantity ?? 12, industry: input?.industry ?? "" } }) }] },
        ],
        reasoning: { effort: "medium" },
        max_output_tokens: 2200,
        text: { format: { type: "json_object" } },
      }),
    });
    const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI rejected the brief");
    const parsed = JSON.parse(responseText(payload)) as Record<string, unknown>;
    const categories = Array.isArray(parsed.requestedCategories) ? parsed.requestedCategories.filter((item): item is ContentCategory => ["โปรโมชั่น / Offer", "รีวิว / Proof", "ความรู้ / FAQ", "แบรนด์ / ไลฟ์สไตล์"].includes(String(item))) : [];
    const planningGoal: PlanningGoal = ["sales", "trust", "balanced", "trend"].includes(String(parsed.planningGoal)) ? parsed.planningGoal as PlanningGoal : "sales";
    const briefs = Array.isArray(parsed.briefs) ? parsed.briefs.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").map((brief) => ({
      product: String(brief.product ?? "").slice(0, 120), goal: String(brief.goal ?? "").slice(0, 300), painFocus: String(brief.painFocus ?? "").slice(0, 500),
      customNeed: String(brief.customNeed ?? "").slice(0, 500), price: String(brief.price ?? "").slice(0, 80), priceUnit: String(brief.priceUnit ?? "").slice(0, 80),
    })).filter((brief) => brief.product || brief.goal || brief.painFocus) : [];
    return NextResponse.json({ brief: {
      planName: String(parsed.planName ?? "").slice(0, 160), client: String(parsed.client ?? input?.client ?? "").slice(0, 120), industry: String(parsed.industry ?? input?.industry ?? "").slice(0, 160),
      theme: String(parsed.theme ?? "").slice(0, 600), planningGoal, freshContext: String(parsed.freshContext ?? "").slice(0, 1200),
      quantity: Math.max(1, Math.min(36, Math.round(Number(parsed.quantity) || input?.quantity || 12))), requestedCategories: categories, briefs,
      summary: String(parsed.summary ?? "AI แยกโจทย์ให้แล้ว").slice(0, 500),
    } });
  } catch (error) {
    return NextResponse.json({ error: "AI brief parsing failed", nextStep: error instanceof Error ? error.message : "ลองส่งโจทย์อีกครั้ง" }, { status: 502 });
  }
}
