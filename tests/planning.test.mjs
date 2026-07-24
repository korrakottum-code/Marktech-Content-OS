import assert from "node:assert/strict";
import test from "node:test";
import {
  balancedDates,
  buildMechanismSlots,
  cleanIdeas,
  dedupeIdeas,
  enforceOfferPricing,
  ensurePriceMentions,
} from "../lib/planning.js";

const pricedFiller = { product: "Filler", price: "699", priceUnit: "บาท / 10 cc" };

function idea(overrides = {}) {
  return {
    product: "Filler",
    title: "แก้มตอบจนหน้าดูโทรม",
    hook: "เงาดูลึก",
    reason: "อธิบาย pain point ที่ทำให้คนตัดสินใจได้ชัดขึ้น",
    adminAngle: "",
    format: "ภาพ",
    pillar: "ลดความกังวล",
    category: "โปรโมชั่น / Offer",
    visualDirection: "ภาพโปรโมชัน",
    adaptation: "มุมใหม่",
    ...overrides,
  };
}

test("cleans malformed AI output and removes duplicate product-title pairs", () => {
  const cleaned = cleanIdeas([
    idea(),
    idea({ hook: "คนละ hook" }),
    idea({ product: "Botox", title: "", reason: "ไม่ควรผ่าน" }),
  ]);

  assert.equal(cleaned.length, 2);
  assert.equal(dedupeIdeas(cleaned).length, 1);
  assert.equal(dedupeIdeas(cleaned)[0].title, "แก้มตอบจนหน้าดูโทรม");
});

test("adds price labels to enough ideas without polluting headline or hook", () => {
  const ideas = [idea(), idea({ title: "แต่งหน้าแล้วแก้มยังบวม", hook: "หน้าดูใหญ่" })];
  const result = ensurePriceMentions(ideas, [pricedFiller], 2);

  assert.deepEqual(result.map((item) => item.priceLabel), ["699 บาท / 10 cc", "699 บาท / 10 cc"]);
  assert.equal(result.some((item) => `${item.title} ${item.hook}`.includes("699")), false);
});

test("requires a matching price and unit for Offer ideas", () => {
  const priced = enforceOfferPricing([idea()], [pricedFiller])[0];
  const missingPrice = enforceOfferPricing([idea()], [{ product: "Filler", price: "", priceUnit: "" }])[0];

  assert.equal(priced.category, "โปรโมชั่น / Offer");
  assert.equal(priced.priceLabel, "699 บาท / 10 cc");
  assert.match(priced.visualDirection, /699 บาท \/ 10 cc/);
  assert.equal(missingPrice.category, "ความรู้ / FAQ");
});

test("builds a fixed, universal mechanism skeleton before copy is written", () => {
  const slots = buildMechanismSlots(36, "sales", [], true);
  const mechanisms = new Set(slots.map((slot) => slot.mechanismId));

  assert.equal(slots.length, 36);
  assert.ok(mechanisms.size >= 6);
  assert.ok(slots.some((slot) => slot.mechanismId === "value_offer"));
  assert.ok(slots.some((slot) => slot.funnel === "conversion"));
});

test("does not force a promotion slot when the brief has no verified offer", () => {
  const slots = buildMechanismSlots(20, "sales", [], false);
  assert.equal(slots.some((slot) => slot.category === "โปรโมชั่น / Offer"), false);
});

test("filters near-duplicate headline structures, not just exact text", () => {
  const result = dedupeIdeas([
    idea({ title: "กลัวงบบานปลายจนไม่กล้าจอง", hook: "คุมงบไม่อยู่" }),
    idea({ title: "กลัวงบบานปลายจนไม่กล้าตัดสินใจ", hook: "คุมงบไม่อยู่" }),
    idea({ title: "ผลลัพธ์จริงหลังทำครบ 30 วัน", hook: "เห็นความต่าง" }),
  ]);
  assert.equal(result.length, 2);
});

test("balances schedule assignments and keeps every item inside its requested month", () => {
  const ideas = [
    { id: "1", format: "ภาพ" },
    { id: "2", format: "วิดีโอ" },
    { id: "3", format: "อัลบั้ม" },
    { id: "4", format: "ภาพ" },
    { id: "5", format: "วิดีโอ" },
  ];
  const result = balancedDates(ideas, "2026-02", [{ date: "2026-02-01", format: "ภาพ" }]);
  const dates = [...result.values()];

  assert.equal(result.size, ideas.length);
  assert.ok(dates.every((date) => date.startsWith("2026-02-")));
  assert.equal(new Set(dates).size, ideas.length);
});
