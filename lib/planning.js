export const contentCategories = ["โปรโมชั่น / Offer", "รีวิว / Proof", "ความรู้ / FAQ", "แบรนด์ / ไลฟ์สไตล์"];

export function cleanIdeas(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((idea) => Boolean(idea) && typeof idea === "object")
    .map((idea, index) => ({
      id: `IDEA-${String(index + 1).padStart(2, "0")}`,
      product: String(idea.product ?? "ไม่ระบุโปรดักต์").slice(0, 80),
      title: String(idea.title ?? "").slice(0, 72),
      hook: String(idea.hook ?? "").slice(0, 42),
      reason: String(idea.reason ?? "").slice(0, 500),
      adminAngle: String(idea.adminAngle ?? "").slice(0, 240),
      format: ["วิดีโอ", "ภาพ", "อัลบั้ม"].includes(idea.format) ? idea.format : "ภาพ",
      pillar: String(idea.pillar ?? "Content idea").slice(0, 80),
      category: contentCategories.includes(idea.category) ? idea.category : "โปรโมชั่น / Offer",
      priceLabel: String(idea.priceLabel ?? "").slice(0, 80),
      visualDirection: String(idea.visualDirection || "ภาพโปรโมชันที่มีพื้นที่วางข้อความ").slice(0, 240),
      adaptation: String(idea.adaptation || "สร้างมุมใหม่จากโจทย์เดือนนี้").slice(0, 220),
    }))
    .filter((idea) => idea.title && idea.hook && idea.reason);
}

export function dedupeIdeas(ideas) {
  const exactTitles = new Set();
  return ideas.filter((idea) => {
    const titleKey = `${idea.product}|${idea.title}`.replace(/\s+/g, "").toLowerCase();
    if (exactTitles.has(titleKey)) return false;
    exactTitles.add(titleKey);
    return true;
  });
}

export function ensurePriceMentions(ideas, briefs, minimumPerPricedProduct) {
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

export function enforceOfferPricing(ideas, briefs) {
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
    if (!price || !unit) return { ...idea, category: "ความรู้ / FAQ" };
    const priceLabel = `${price} ${unit}`;
    return {
      ...idea,
      priceLabel,
      visualDirection: `งาน Offer ต้องวาง ${priceLabel} แบบ ${priceLayouts[index % priceLayouts.length]} | ${idea.visualDirection}`.slice(0, 240),
    };
  });
}

function isoFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => isoFromDate(new Date(year, monthNumber - 1, index + 1)));
}

export function balancedDates(ideas, month, existingWork = []) {
  const allDates = daysInMonth(month);
  const existing = existingWork.filter((work) => work.date.startsWith(month));
  const assignments = new Map();
  for (const date of allDates) assignments.set(date, { total: 0, formats: { วิดีโอ: 0, ภาพ: 0, อัลบั้ม: 0 } });
  for (const work of existing) {
    const slot = assignments.get(work.date);
    if (slot) { slot.total += 1; slot.formats[work.format] += 1; }
  }

  const result = new Map();
  ideas.forEach((idea, index) => {
    const idealIndex = Math.round(((index + 0.5) * allDates.length) / ideas.length) - 1;
    const candidate = allDates
      .map((date, dateIndex) => ({ date, dateIndex, slot: assignments.get(date) }))
      .sort((a, b) => {
        const scoreA = a.slot.total * 12 + a.slot.formats[idea.format] * 7 + Math.abs(a.dateIndex - idealIndex) * 0.75;
        const scoreB = b.slot.total * 12 + b.slot.formats[idea.format] * 7 + Math.abs(b.dateIndex - idealIndex) * 0.75;
        return scoreA - scoreB || a.dateIndex - b.dateIndex;
      })[0];
    result.set(idea.id, candidate.date);
    candidate.slot.total += 1;
    candidate.slot.formats[idea.format] += 1;
  });
  return result;
}
