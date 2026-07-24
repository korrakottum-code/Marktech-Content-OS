import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { buildMechanismSlots, cleanIdeas, dedupeIdeas, enforceOfferPricing, ensurePriceMentions } from "@/lib/planning.js";

type ProductBrief = { id?: string; product?: string; goal?: string; customNeed?: string; price?: string; priceUnit?: string };
type ExistingIdea = { title?: string; hook?: string; product?: string; pillar?: string; category?: string; mechanism?: string };
type ContentCategory = "โปรโมชั่น / Offer" | "รีวิว / Proof" | "ความรู้ / FAQ" | "แบรนด์ / ไลฟ์สไตล์";
type PlanningGoal = "sales" | "trust" | "balanced" | "trend";
type Slot = { slotId: string; mechanism: string; mechanismId: string; category: ContentCategory; funnel: string; angle?: string; audienceContext?: string };

function responseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  return payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
}

async function askJson(apiKey: string, developer: string, user: unknown, maxOutputTokens: number) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(55_000),
    body: JSON.stringify({
      model: process.env.OPENAI_CONTENT_MODEL ?? "gpt-5.6-terra",
      input: [
        { role: "developer", content: [{ type: "input_text", text: developer }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(user) }] },
      ],
      reasoning: { effort: "medium" },
      max_output_tokens: maxOutputTokens,
      text: { format: { type: "json_object" } },
    }),
  });
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI rejected the generation");
  return JSON.parse(responseText(payload)) as Record<string, unknown>;
}

function cleanSkeleton(value: unknown, slots: Slot[]) {
  const source = Array.isArray(value) ? value : [];
  const byId = new Map(source.filter((item): item is { slotId?: string; angle?: string; audienceContext?: string } => Boolean(item) && typeof item === "object")
    .map((item) => [String(item.slotId ?? ""), item]));
  return slots.map((slot, index) => {
    const generated = byId.get(slot.slotId);
    return {
      ...slot,
      angle: String(generated?.angle ?? `มุมตัดสินใจที่ ${index + 1}`).slice(0, 180),
      audienceContext: String(generated?.audienceContext ?? "กลุ่มเป้าหมายที่สัมพันธ์กับโจทย์นี้").slice(0, 160),
    };
  });
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as {
    client?: string; planMonth?: string; theme?: string; quantity?: number; briefs?: ProductBrief[]; industry?: string;
    reusePolicy?: "avoid" | "adapt"; categories?: ContentCategory[]; mode?: "initial" | "additional";
    focusBrief?: ProductBrief; additionalDirection?: string; existingIdeas?: ExistingIdea[];
    planningGoal?: PlanningGoal; freshContext?: string;
  } | null;
  if (!input?.client || !input.planMonth || !Array.isArray(input.briefs) || input.briefs.length === 0) {
    return NextResponse.json({ error: "Missing planning brief" }, { status: 400 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI is not configured", nextStep: "เพิ่ม OPENAI_API_KEY เป็น secret ฝั่งเซิร์ฟเวอร์ก่อน" }, { status: 503 });

  const allowedCategories = (input.categories ?? []).filter((category): category is ContentCategory => ["โปรโมชั่น / Offer", "รีวิว / Proof", "ความรู้ / FAQ", "แบรนด์ / ไลฟ์สไตล์"].includes(category));
  const requestedCount = Math.max(1, Math.min(20, Math.round(input.quantity ?? 8)));
  // The first pass is always a complete option pool. Selecting fewer items is
  // the planner's decision; constraining generation too early causes sameness.
  const target = input.mode === "additional" ? requestedCount : 36;
  const hasVerifiedOffer = input.briefs.some((brief) => brief.price?.trim() && brief.priceUnit?.trim());
  const planningGoal: PlanningGoal = ["sales", "trust", "balanced", "trend"].includes(input.planningGoal ?? "") ? input.planningGoal as PlanningGoal : "sales";
  const slots = buildMechanismSlots(target, planningGoal, allowedCategories, hasVerifiedOffer) as Slot[];
  const focusedProduct = input.focusBrief?.product?.trim();

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
  const existingText = (input.existingIdeas ?? []).slice(0, 60)
    .map((idea) => [idea.title, idea.hook, idea.product, idea.pillar, idea.category, idea.mechanism].filter(Boolean).join(" | "))
    .filter(Boolean).join("\n");
  const brief = {
    client: input.client, planMonth: input.planMonth, monthlyConcept: input.theme || "ยังไม่ได้ระบุ",
    industry: input.industry || "ไม่ระบุ", planningGoal, freshContext: String(input.freshContext ?? "").slice(0, 1500),
    productsAndNeeds: input.briefs.map(({ id: _id, ...item }) => item),
    focusedAddition: input.focusBrief ? { product: input.focusBrief.product ?? "", goal: input.focusBrief.goal ?? "", customNeed: input.focusBrief.customNeed ?? "" } : null,
  };

  const skeletonInstructions = `
คุณคือ Content Strategy Architect ของ performance media agency
งานนี้ใช้ได้กับทุกอุตสาหกรรม: ห้ามตั้งสมมติฐานว่าเป็นคลินิก เว้นแต่ brief จะบอกไว้

ขั้นนี้ห้ามเขียน title, hook, caption หรือไอเดียเต็ม ให้สร้าง “โครงความต่าง” เท่านั้น
จาก brief ให้สร้าง angle pool 18–24 มุมที่ต่างกันจริง (อาจเป็น desire, objection, context, proof need, decision trigger, cultural moment หรือ use case) แล้วเติม angle และ audienceContext ให้ทุก slot ที่กำหนดมา
ห้ามใช้มุมอารมณ์เดียวกันเกิน 2 slot; ห้ามวนคำหรือฉาก เช่น กลัว, ไม่มั่นใจ, งบ, วันสำคัญ หากไม่ได้มีเหตุเฉพาะจาก brief
context สดที่ผู้ใช้ให้มาใช้ได้เฉพาะเมื่อมีอยู่จริงใน brief; หากไม่มี ห้ามแต่งว่าเป็นเทรนด์หรือข่าวปัจจุบัน
slot เป็นกติกาตายตัว: ห้ามเปลี่ยน slotId, mechanism, category หรือ funnel และต้องคืนครบทุก slotId หนึ่งครั้ง
ตอบ JSON เท่านั้น: {"anglePool":[""],"skeleton":[{"slotId":"","angle":"","audienceContext":""}]}
`;

  try {
    const skeletonResult = await askJson(apiKey, skeletonInstructions, { brief, slots }, 6200);
    const skeleton = cleanSkeleton(skeletonResult.skeleton, slots);
    const contentInstructions = `
คุณคือ Senior Performance Content Strategist ภาษาไทย
ขั้นนี้เขียนไอเดียเต็มตาม skeleton ที่กำหนดเท่านั้น หนึ่ง slot = หนึ่งไอเดีย และต้องคืน slotId เดิมครบทุกตัว
กลไก (mechanism) ต่างกันต้องเล่าเรื่องต่างกันจริง: Value/Offer = ดีล/ความคุ้มค่าที่พิสูจน์ได้, Social Proof = หลักฐาน/เคส/ตัวเลขจริง, Authority/Education = ผู้เชี่ยวชาญหรือกลไก, Narrative/Scenario = ฉากชีวิตหรือ use case, Interactive = คนมีส่วนร่วม, Direct Conversion = ทำให้ตัดสินใจ/จอง/ซื้อ, Culture/Trend = บริบทสดที่ brief ยืนยันเท่านั้น, Behind-the-scenes = กระบวนการหรือเบื้องหลัง
ห้ามทำทุกกลไกเป็น FAQ หรือ fear-based copy. ห้ามเริ่ม title/hook ด้วยคำหรือโครงซ้ำกัน; ห้ามใช้ความกลัว งบ วันสำคัญ ไม่มั่นใจ ซ้ำเกิน 2 ครั้งทั้งชุด เว้นแต่ skeleton ระบุเหตุเฉพาะต่างกันชัดเจน
Offer ใช้ได้เมื่อ brief มีราคา+หน่วยจริงเท่านั้น และต้องใส่ราคา+หน่วยเดิมใน priceLabel; ไม่แต่งราคาเอง
title ไม่เกิน 55 ตัวอักษรไทย, hook 1–5 คำและไม่เกิน 24 ตัวอักษรไทย, reason เป็นเหตุผลเชิง performance 1–2 ประโยค, visualDirection ต้องบอกภาพที่ทำจริงได้
ก่อนส่งตรวจตัวเอง: title/hook ของแต่ละ slot ต้องไม่สลับใช้แทนกันได้ และต้องสะท้อน mechanism + angle ของ slot นั้น
ตอบ JSON เท่านั้น: {"ideas":[{"slotId":"","product":"","title":"","hook":"","priceLabel":"","reason":"","adminAngle":"","format":"วิดีโอ|ภาพ|อัลบั้ม","pillar":"","category":"","mechanism":"","funnel":"","angle":"","visualDirection":"","adaptation":""}]}
`;
    const batchSize = 9;
    const batches = Array.from({ length: Math.ceil(skeleton.length / batchSize) }, (_, index) => skeleton.slice(index * batchSize, (index + 1) * batchSize));
    const generateForSlots = async (batch: Slot[], avoidText = existingText || "ไม่มี") => {
      const result = await askJson(apiKey, contentInstructions, {
        brief, batch, historicalContent: priorText || "ไม่มี", currentIdeasToAvoid: avoidText,
        reusePolicy: input.reusePolicy === "adapt" ? "Copy-to-Adapt ได้เมื่อเปลี่ยน context, audience, offer หรือ mechanism ให้ชัด" : "สร้างมุมใหม่เป็นหลัก",
        additionalDirection: String(input.additionalDirection ?? "").slice(0, 300),
        focusedProduct: focusedProduct || null,
      }, 3600);
      const slotsById = new Map(batch.map((slot) => [slot.slotId, slot]));
      return cleanIdeas(result.ideas).map((idea, index) => {
        const slot = slotsById.get(idea.slotId) ?? batch[index];
        return slot ? { ...idea, slotId: slot.slotId, mechanism: slot.mechanism, funnel: slot.funnel, angle: slot.angle, category: slot.category } : idea;
      });
    };
    const results = await Promise.all(batches.map((batch) => generateForSlots(batch)));
    let distinctIdeas = dedupeIdeas(results.flat());
    // Similarity checks are deliberately strict. When they reject a slot,
    // ask only for that slot again with every accepted idea as a blacklist.
    for (let attempt = 0; attempt < 2 && distinctIdeas.length < target; attempt += 1) {
      const acceptedSlots = new Set(distinctIdeas.map((idea) => idea.slotId));
      const missingSlots = skeleton.filter((slot) => !acceptedSlots.has(slot.slotId));
      if (!missingSlots.length) break;
      const avoidText = [...(existingText ? [existingText] : []), ...distinctIdeas.map((idea) => `${idea.title} | ${idea.hook} | ${idea.angle ?? ""}`)].join("\n");
      distinctIdeas = dedupeIdeas([...distinctIdeas, ...await generateForSlots(missingSlots, avoidText)]);
    }
    const minimumPriceMentions = input.mode === "initial" ? Math.min(3, Math.max(1, Math.floor(target / 4))) : 1;
    const ideas = enforceOfferPricing(ensurePriceMentions(distinctIdeas, input.briefs, minimumPriceMentions), input.briefs)
      .map((idea, index) => ({ ...idea, id: `IDEA-${String(index + 1).padStart(2, "0")}` }));
    const minimumUsableIdeas = input.mode === "additional" ? Math.max(1, Math.floor(target * 0.7)) : target;
    if (ideas.length < minimumUsableIdeas) throw new Error("AI returned too few distinct ideas");
    return NextResponse.json({ ideas: ideas.slice(0, target), skeleton: skeleton.map(({ slotId, mechanism, category, funnel, angle }) => ({ slotId, mechanism, category, funnel, angle })) });
  } catch (error) {
    return NextResponse.json({ error: "AI generation failed", nextStep: error instanceof Error ? error.message : "ลองกดสร้างอีกครั้ง หรือปรับโจทย์ให้เฉพาะเจาะจงขึ้น" }, { status: 502 });
  }
}
