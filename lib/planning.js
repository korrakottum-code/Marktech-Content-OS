export const contentCategories = ["โปรโมชั่น / Offer", "รีวิว / Proof", "ความรู้ / FAQ", "แบรนด์ / ไลฟ์สไตล์"];

// Mechanism is deliberately industry-agnostic. The AI receives a slot from
// this list before it writes copy, so it cannot fill an entire plan with the
// easiest pattern (usually fear-led FAQs).
export const contentMechanisms = [
  { id: "value_offer", label: "Value / Offer", category: "โปรโมชั่น / Offer", weight: { sales: 7, trust: 2, balanced: 4, trend: 3 } },
  { id: "social_proof", label: "Social Proof", category: "รีวิว / Proof", weight: { sales: 5, trust: 7, balanced: 5, trend: 3 } },
  { id: "authority_education", label: "Authority / Education", category: "ความรู้ / FAQ", weight: { sales: 3, trust: 7, balanced: 5, trend: 3 } },
  { id: "narrative_scenario", label: "Narrative / Scenario", category: "แบรนด์ / ไลฟ์สไตล์", weight: { sales: 4, trust: 5, balanced: 5, trend: 4 } },
  { id: "interactive", label: "Interactive / Participatory", category: "แบรนด์ / ไลฟ์สไตล์", weight: { sales: 3, trust: 4, balanced: 4, trend: 5 } },
  { id: "direct_conversion", label: "Direct Conversion", category: "โปรโมชั่น / Offer", weight: { sales: 6, trust: 2, balanced: 3, trend: 3 } },
  { id: "culture_trend", label: "Culture / Trend", category: "แบรนด์ / ไลฟ์สไตล์", weight: { sales: 2, trust: 2, balanced: 3, trend: 8 } },
  { id: "behind_process", label: "Behind-the-scenes / Process", category: "แบรนด์ / ไลฟ์สไตล์", weight: { sales: 2, trust: 6, balanced: 3, trend: 3 } },
];

export function buildMechanismSlots(total, objective = "sales", allowedCategories = [], hasVerifiedOffer = false) {
  const allowed = contentMechanisms.filter((mechanism) => {
    if (!hasVerifiedOffer && mechanism.category === "โปรโมชั่น / Offer") return false;
    return !allowedCategories.length || allowedCategories.includes(mechanism.category);
  });
  const mechanisms = allowed.length ? allowed : contentMechanisms.filter((mechanism) => mechanism.category !== "โปรโมชั่น / Offer");
  const goal = ["sales", "trust", "balanced", "trend"].includes(objective) ? objective : "sales";
  const weightTotal = mechanisms.reduce((sum, mechanism) => sum + mechanism.weight[goal], 0);
  const quotas = mechanisms.map((mechanism) => ({
    mechanism,
    raw: (total * mechanism.weight[goal]) / weightTotal,
    count: Math.floor((total * mechanism.weight[goal]) / weightTotal),
  }));
  let remainder = total - quotas.reduce((sum, quota) => sum + quota.count, 0);
  quotas.sort((a, b) => (b.raw - b.count) - (a.raw - a.count) || b.mechanism.weight[goal] - a.mechanism.weight[goal]);
  for (let index = 0; remainder > 0; index = (index + 1) % quotas.length, remainder -= 1) quotas[index].count += 1;

  const funnels = goal === "sales"
    ? ["conversion", "consideration", "conversion", "awareness"]
    : goal === "trust"
      ? ["awareness", "consideration", "awareness", "conversion"]
      : ["awareness", "consideration", "conversion"];
  return quotas.flatMap(({ mechanism }) => {
    const quota = quotas.find((item) => item.mechanism.id === mechanism.id)?.count ?? 0;
    return Array.from({ length: quota }, (_, index) => ({
      slotId: `SLOT-${mechanism.id}-${String(index + 1).padStart(2, "0")}`,
      mechanism: mechanism.label,
      mechanismId: mechanism.id,
      category: mechanism.category,
      funnel: funnels[index % funnels.length],
    }));
  });
}

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
      slotId: String(idea.slotId ?? "").slice(0, 100),
      mechanism: String(idea.mechanism ?? "").slice(0, 80),
      funnel: String(idea.funnel ?? "").slice(0, 30),
      angle: String(idea.angle ?? "").slice(0, 180),
    }))
    .filter((idea) => idea.title && idea.hook && idea.reason);
}

export function dedupeIdeas(ideas) {
  const accepted = [];
  return ideas.filter((idea) => {
    const candidate = `${idea.title} ${idea.hook}`;
    const isDuplicate = accepted.some((existing) => {
      if (existing.product?.trim().toLowerCase() !== idea.product?.trim().toLowerCase()) return false;
      const left = normalizedText(`${existing.title} ${existing.hook}`);
      const right = normalizedText(candidate);
      if (left === right || normalizedText(existing.hook) === normalizedText(idea.hook)) return true;
      return textSimilarity(left, right) >= 0.62 || sameOpening(left, right);
    });
    if (isDuplicate) return false;
    accepted.push(idea);
    return true;
  });
}

function normalizedText(value) {
  return String(value ?? "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function sameOpening(left, right) {
  const length = Math.min(left.length, right.length, 18);
  return length >= 10 && left.slice(0, length) === right.slice(0, length);
}

function textSimilarity(left, right) {
  const grams = (value) => {
    const result = new Set();
    for (let index = 0; index < Math.max(0, value.length - 2); index += 1) result.add(value.slice(index, index + 3));
    return result;
  };
  const leftGrams = grams(left);
  const rightGrams = grams(right);
  if (!leftGrams.size || !rightGrams.size) return 0;
  let common = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) common += 1;
  return common / (leftGrams.size + rightGrams.size - common);
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
