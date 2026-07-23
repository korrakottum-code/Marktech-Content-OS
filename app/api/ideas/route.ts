import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";

type ProductBrief = { id?: string; product?: string; goal?: string; customNeed?: string; price?: string; priceUnit?: string };
type ExistingIdea = { title?: string; hook?: string; product?: string; pillar?: string; category?: string };
type ContentCategory = "โปรโมชั่น / Offer" | "รีวิว / Proof" | "ความรู้ / FAQ" | "แบรนด์ / ไลฟ์สไตล์";
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
  priceLabel?: string;
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
      title: String(idea.title ?? "").slice(0, 72),
      hook: String(idea.hook ?? "").slice(0, 42),
      reason: String(idea.reason ?? "").slice(0, 500),
      adminAngle: String(idea.adminAngle ?? "").slice(0, 240),
      format: ["วิดีโอ", "ภาพ", "อัลบั้ม"].includes(idea.format) ? idea.format : "ภาพ",
      pillar: String(idea.pillar ?? "Content idea").slice(0, 80),
      category: ["โปรโมชั่น / Offer", "รีวิว / Proof", "ความรู้ / FAQ", "แบรนด์ / ไลฟ์สไตล์"].includes(idea.category) ? idea.category : "โปรโมชั่น / Offer",
      priceLabel: String(idea.priceLabel ?? "").slice(0, 80),
      visualDirection: String(idea.visualDirection || "ภาพโปรโมชันที่มีพื้นที่วางข้อความ").slice(0, 240),
      adaptation: String(idea.adaptation || "สร้างมุมใหม่จากโจทย์เดือนนี้").slice(0, 220),
    }))
    .filter((idea) => idea.title && idea.hook && idea.reason);
}

function dedupeIdeas(ideas: ReturnType<typeof cleanIdeas>) {
  const exactTitles = new Set<string>();
  return ideas.filter((idea) => {
    const titleKey = `${idea.product}|${idea.title}`.replace(/\s+/g, "").toLowerCase();
    if (exactTitles.has(titleKey)) return false;
    exactTitles.add(titleKey);
    return true;
  });
}

function ensurePriceMentions(ideas: ReturnType<typeof cleanIdeas>, briefs: ProductBrief[], minimumPerPricedProduct: number) {
  const result = [...ideas];
  for (const brief of briefs) {
    const product = brief.product?.trim();
    const price = brief.price?.trim();
    const unit = brief.priceUnit?.trim();
    if (!product || !price || !unit) continue;
    const priceLabel = `${price} ${unit}`;
    const candidates = result
      .map((idea, index) => ({ idea, index }))
      .filter(({ idea }) => idea.product.trim().toLowerCase() === product.toLowerCase());
    let mentions = candidates.filter(({ idea }) => `${idea.title} ${idea.hook} ${idea.priceLabel ?? ""}`.includes(price)).length;
    for (const { idea, index } of candidates) {
      if (mentions >= minimumPerPricedProduct) break;
      if (`${idea.title} ${idea.hook} ${idea.priceLabel ?? ""}`.includes(price)) continue;
      result[index] = { ...idea, priceLabel };
      mentions += 1;
    }
  }
  return result;
}

function enforceOfferPricing(ideas: ReturnType<typeof cleanIdeas>, briefs: ProductBrief[]) {
  const priceLayouts = [
    "ป้ายราคาใหญ่ด้านบนขวา",
    "ราคาเป็น hero กลางภาพ",
    "แถบราคาเต็มความกว้างด้านล่าง",
    "price card เปรียบเทียบด้านข้าง",
    "sticker ราคาเด่นคู่กับ CTA",
  ];
  return ideas.map((idea, index) => {
    if (idea.category !== "โปรโมชั่น / Offer") return idea;
    const brief = briefs.find((item) => item.product?.trim().toLowerCase() === idea.product.trim().toLowerCase());
    const price = brief?.price?.trim();
    const unit = brief?.priceUnit?.trim();
    if (!price || !unit) return { ...idea, category: "ความรู้ / FAQ" as const };
    const priceLabel = `${price} ${unit}`;
    return {
      ...idea,
      priceLabel,
      visualDirection: `งาน Offer ต้องวาง ${priceLabel} แบบ ${priceLayouts[index % priceLayouts.length]} | ${idea.visualDirection}`.slice(0, 240),
    };
  });
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
    categories?: ContentCategory[];
    mode?: "initial" | "additional";
    focusBrief?: ProductBrief;
    additionalDirection?: string;
    existingIdeas?: ExistingIdea[];
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

  // Keep the option pool useful but reviewable. The planner can always add
  // their own ideas, so a fixed wall of 36 options is unnecessary.
  const requestedCount = Math.max(1, Math.min(20, Math.round(input.quantity ?? 8)));
  const target = input.mode === "additional"
    ? requestedCount
    : Math.min(20, Math.max(requestedCount, Math.ceil(requestedCount * 1.5)));
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
  const existingText = (input.existingIdeas ?? [])
    .slice(0, 60)
    .map((idea) => [idea.title, idea.hook, idea.product, idea.pillar, idea.category].filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n");
  const allowedCategories = (input.categories ?? []).filter((category): category is ContentCategory => ["โปรโมชั่น / Offer", "รีวิว / Proof", "ความรู้ / FAQ", "แบรนด์ / ไลฟ์สไตล์"].includes(category));
  const focusedProduct = input.focusBrief?.product?.trim();
  const priceRule = input.mode === "initial"
    ? "หาก brief ของโปรดักต์ใดมีราคาและหน่วย นั่นคือข้อเสนอจริง: ต้องมีไอเดียที่ใช้ราคาอย่างน้อย 2 มุมเมื่อจำนวนไอเดียมากพอ (หรืออย่างน้อย 1 มุมเมื่อขอไอเดียน้อย) โดยใส่ราคาและหน่วยตาม brief ใน priceLabel อย่างถูกต้อง ห้ามปล่อยให้ราคาที่ให้มาเงียบหายไป"
    : focusedProduct
      ? `นี่คือการเติมไอเดียเฉพาะ ${focusedProduct}: ห้ามดึงชื่อ ราคา หรือข้อเสนอของโปรดักต์อื่นใน brief เดิมมาใช้เด็ดขาด หาก ${focusedProduct} ไม่มีราคา ห้ามแต่งหรือย้ายราคาเดิมมาใช้`
      : "สำหรับการเติมไอเดีย ให้ใช้ราคาเฉพาะเมื่อสัมพันธ์กับโปรดักต์ในไอเดียนั้นโดยตรง ห้ามย้ายราคาไปใช้กับเรื่องอื่น";
  const instructions = `
คุณคือ Senior Content Strategist ของ performance media agency ในไทย

อุตสาหกรรมของลูกค้าคือ ${input.industry || "คลินิกความงาม"}. ปรับภาษา มุมเล่า และคำเตือนให้เหมาะกับอุตสาหกรรมนั้น; อย่าตั้งสมมติฐานว่าเป็นคลินิกหากไม่ได้ระบุว่าเป็นคลินิก
เป้าหมาย: สร้างไอเดียคอนเทนท์ที่ช่วยให้คนเข้าใจ เกิดความเชื่อใจ และพาไปสู่การทักแชต/นัด/ซื้อ ไม่ใช่คอนเทนท์เพื่อยอด reach อย่างเดียว
ทุกไอเดียต้องเริ่มจาก "ปัญหาที่คนกำลังเจอจริง" ไม่ใช่เริ่มจากชื่อบริการหรือสรรพคุณ: ระบุช่วงเวลาที่เขารู้สึกติดขัด ความกังวลที่ไม่กล้าพูด ความเข้าใจผิด หรือราคาที่ต้องชั่งใจ แล้วขยี้ผลกระทบอย่างมี empathy ก่อนพาไปสู่คำตอบหรือทางเลือกที่ชัดเจน
Hook ต้องทำให้คนอ่านรู้สึกว่า "นี่พูดถึงฉัน" ด้วยสถานการณ์หรือคำถามเฉพาะเจาะจง ห้ามใช้ opening ที่กว้างและจืด เช่น "รู้หรือไม่", "มาทำความรู้จัก", "เปลี่ยนตัวเอง", "สวยขึ้นได้" หรือสรุปว่าดีโดยไม่แตะ pain point
อย่าเว่อร์หรือสร้างความกลัวเกินจริง: ใช้ pain ที่ตรวจสอบได้และอยู่ในบริบทของลูกค้า จากนั้นบอกสิ่งที่โพสต์จะช่วยให้ตัดสินใจได้ดีขึ้น
สร้าง IDEA_COUNT ไอเดีย โดยเลือกสัดส่วนของ "โปรโมชั่น / Offer", "รีวิว / Proof", "ความรู้ / FAQ" และ "แบรนด์ / ไลฟ์สไตล์" จากโจทย์จริงเท่านั้น ไม่ต้องยัดโปรโมชันเมื่อไม่ได้มีข้อเสนอหรือความจำเป็นทางธุรกิจ
ประเภทที่ผู้ใช้อนุญาตให้สร้าง: ${allowedCategories.length ? allowedCategories.join(", ") : "ไม่จำกัด — ให้เลือกตามโจทย์"}. ${allowedCategories.length ? "ห้ามใช้ category อื่นนอกเหนือจากรายการนี้" : ""}
หากใช้ category "โปรโมชั่น / Offer" ต้องเป็นข้อเสนอที่ขายได้จริงและต้องแสดง “ราคา + หน่วย” ของโปรดักต์นั้น 100% ใน priceLabel เสมอ; ถ้า brief นั้นไม่มีราคา+หน่วย ห้ามจัดไอเดียนั้นเป็น Promotion / Offer เด็ดขาด
หากมีราคา/หน่วยจริง และจำนวนไอเดียมากพอ ให้ใช้ราคาเดิมได้ 2–3 ไอเดีย แต่ทุกไอเดียต้องเป็น “มุมตัดสินใจ” คนละแบบอย่างชัดเจน เช่น ราคาเริ่มต้น, ใครเหมาะ, สิ่งที่รวมในราคา, เวลาที่เหมาะจะเริ่ม, หรือเปรียบเทียบค่าใช้จ่าย. ห้ามสลับคำรอบราคาเดิมหรือใช้คำถามซ้ำกัน
ถ้า brief ระบุราคาและหน่วย ให้ใช้ได้เฉพาะกับโปรดักต์นั้นและคงตัวเลขตาม brief; ถ้าไม่ระบุราคา ห้ามแต่งราคาเอง
title ต้องสั้น กระชับ และอ่านจบในแวบเดียว: ไม่เกิน 10 คำหรือ 55 ตัวอักษรไทยโดยประมาณ แต่ต้อง “ขยี้ pain” ให้เห็นฉาก ความเสียหาย หรือความรู้สึกที่คนกำลังเจอจริงก่อนบอกทางออก เช่น "รักแร้ดำ จนไม่กล้ายกแขน", "โกนซ้ำจนแสบทุกเช้า", "กลัวเริ่มเลเซอร์แล้วไม่เห็นผล" ห้ามใช้หัวข้อจืด ๆ ที่เพียงบอก benefit เช่น "เลี่ยงขนคุดรอยดำ" หรือ "เริ่มเลเซอร์ได้เลย" และห้ามยัดราคา หน่วย หรือ CTA ลง title
hook คือ “หมัดเด็ด” สำหรับยิงแอด: เป็นวลีสั้น 1–3 คำเท่านั้น, ไม่เกิน 24 ตัวอักษร, ต้องต่อความหมายกับ title โดยตรงและขยี้ผลกระทบ/แรงตัดสินใจของ pain นั้น เช่น title "แต่งหน้าแล้วแก้มยังบวม" → hook "หน้าดูใหญ่กว่าจริง", title "โกนซ้ำจนแสบทุกเช้า" → hook "คัน แสบ ดำ". ห้ามเป็นคำลอย ๆ ที่ไม่รู้ว่าหมายถึงอะไร เช่น "กลับแล้วกังวล", "อยากเจองาน", "ได้เพิ่มอีก 1 ครั้ง"; ห้ามใช้ราคาใน hook เพราะราคาอยู่ใน priceLabel
priceLabel ใช้เฉพาะ Offer และต้องเป็นข้อความราคาสั้น ๆ เช่น "699 บาท / 10 cc" หรือ "เริ่ม 1,999 บาท" เท่านั้น ไม่ต้องใส่ซ้ำใน title/hook. ส่วน title, hook และ priceLabel จะถูกวางคนละตำแหน่งบนชิ้นงานโฆษณา
ก่อนส่งไอเดีย ให้ตรวจตัวเอง: ถ้าหัวข้อหรือ hook นำไปใช้กับโปรดักต์ไหนก็ได้ แปลว่ายังจืดเกินไป ต้องเขียนใหม่ให้เฉพาะกับปัญหาและเหตุผลที่คนตัดสินใจเรื่องนั้น
รายละเอียด pain point และเหตุผลทั้งหมดให้เก็บไว้ใน reason ไม่ใช่ยัดไว้ใน title หรือ hook
reason ต้องเป็นข้อความสมบูรณ์ 1–2 ประโยค สั้นแต่จบใจความ (ไม่เกินประมาณ 260 ตัวอักษรไทย) ห้ามตัดจบกลางประโยคหรือทิ้งวลีค้างไว้
คละ format วิดีโอ ภาพ อัลบั้มตามความเหมาะสมกับชิ้นงาน ไม่ต้องบังคับสัดส่วนเท่ากัน
ถ้ามีหลายโปรดักต์ ต้องกระจายตามน้ำหนักของ brief และยังมีคอนเทนท์ภาพรวมของแบรนด์ได้เมื่อเหมาะสม
ทุกไอเดียต้องมี title, hook, reason ที่นำไปใช้จริงได้ และอยู่ในภาษาไทย
${priceRule}

ประวัติคอนเทนท์ที่ทีมเคยอนุมัติสำหรับลูกค้ารายนี้:
${priorText || "ยังไม่มีประวัติ"}
ไอเดียในชุดที่ผู้ใช้กำลังคัดอยู่ (ห้ามสร้างชื่อเรื่อง Hook หรือมุมเล่าที่ซ้ำหรือใกล้กัน):
${existingText || "ยังไม่มีไอเดียในชุดปัจจุบัน"}
ถ้ามีไอเดียในชุดปัจจุบัน ให้สร้าง "ช่องว่างใหม่" ที่ต่างออกไปอย่างชัดเจน: เปลี่ยนคำถามหลัก กลุ่มคน สถานการณ์ตัดสินใจ หรือคุณค่าที่อธิบาย ไม่ใช่แค่เรียบเรียงหัวข้อเดิมใหม่ ห้ามใช้ราคาเดียวกันหรือผลลัพธ์เดิมเป็นแกนของหัวข้อซ้ำ เว้นแต่กำลังตอบคำถามคนละเรื่องโดยชัดเจน เช่น การเตรียมตัว, ความปลอดภัย, ระยะเวลาผลลัพธ์, ความเหมาะสม, หรือการดูแลหลังทำ
คำสั่งเฉพาะสำหรับการเติมไอเดีย: ${input.focusBrief ? `สร้างทุกไอเดียให้กับเรื่องนี้เท่านั้น: ${JSON.stringify({ product: input.focusBrief.product ?? "", goal: input.focusBrief.goal ?? "", customNeed: input.focusBrief.customNeed ?? "", price: input.focusBrief.price ?? "", priceUnit: input.focusBrief.priceUnit ?? "" })}` : "ไม่มี — เลือกเรื่องที่เหมาะกับ brief ได้"}
มุมหรือปัญหาที่ผู้ใช้ต้องการให้เติม: ${String(input.additionalDirection ?? "").slice(0, 300) || "ไม่มี — เลือก pain point ที่ยังขาดจากชุดปัจจุบัน"}
นโยบายความซ้ำ: ${input.reusePolicy === "adapt" ? "ใช้หลัก Copy-to-Adapt: ถ้า hook หรือโครงจากประวัติยังดี ให้ต่อยอดได้ โดยระบุใน adaptation ว่าหยิบอะไรมาและเปลี่ยน product, offer, กลุ่มคน หรือบริบทเดือนไหนอย่างไร; ห้ามแค่เปลี่ยนคำ" : "สร้างมุมใหม่เป็นหลัก แต่ไม่ต้องถือว่าทุกความคล้ายเป็นความผิด"}

ตอบเป็น JSON เท่านั้น ตามรูปแบบ {"ideas":[{"product":"","title":"","hook":"","priceLabel":"ราคา + หน่วย (เฉพาะ Offer)","reason":"","adminAngle":"","format":"วิดีโอ|ภาพ|อัลบั้ม","pillar":"","category":"โปรโมชั่น / Offer|รีวิว / Proof|ความรู้ / FAQ|แบรนด์ / ไลฟ์สไตล์","visualDirection":"","adaptation":""}]}
`;
  const brief = {
    client: input.client,
    planMonth: input.planMonth,
    monthlyConcept: input.theme || "ยังไม่ได้ระบุ",
    industry: input.industry || "คลินิกความงาม",
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
      return dedupeIdeas(cleanIdeas(parsed.ideas).filter((idea) => !allowedCategories.length || allowedCategories.includes(idea.category)));
    }));
    const minimumPriceMentions = input.mode === "initial" ? Math.min(3, Math.max(1, Math.floor(target / 4))) : 1;
    const ideas = enforceOfferPricing(ensurePriceMentions(results.flat(), input.briefs, minimumPriceMentions), input.briefs).map((idea, index) => ({ ...idea, id: `IDEA-${String(index + 1).padStart(2, "0")}` }));
    const minimumUsableIdeas = input.mode === "additional"
      ? target
      : Math.min(target, Math.max(1, Math.floor(target * 0.7)));
    if (ideas.length < minimumUsableIdeas) throw new Error("AI returned too few usable ideas");
    return NextResponse.json({ ideas: ideas.slice(0, target) });
  } catch (error) {
    return NextResponse.json({ error: "AI generation failed", nextStep: error instanceof Error ? error.message : "ลองกดสร้างอีกครั้ง หรือปรับโจทย์ให้เฉพาะเจาะจงขึ้น" }, { status: 502 });
  }
}
