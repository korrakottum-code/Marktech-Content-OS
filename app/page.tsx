"use client";

import { useMemo, useState } from "react";

type Format = "วิดีโอ" | "ภาพ" | "อัลบั้ม";
type ProductBrief = { id: string; product: string; goal: string; customNeed: string };
type Idea = {
  id: string;
  product: string;
  title: string;
  hook: string;
  reason: string;
  adminAngle: string;
  format: Format;
  pillar: string;
  selected: boolean;
  date?: string;
};
type Slide = { id: string; kind: "cover" | "strategy" | "content" | "custom"; title: string; body: string };
type ExistingWork = { date: string; format: Format; title: string };

const contentClients = ["NV", "Root Privé", "Fill-D", "Be Bright", "A&B Clinic", "Sherlyn", "Facial Studio", "Luxe Aesthetics"];
const clientOptions = [...contentClients, "Essoul (Ads-only)", "Meseoul (Ads-only)", "De'Vana (Ads-only)", "Boseong (Ads-only)"];
const productOptions = ["Botox", "Filler", "HIFU", "Ultraformer", "Pico", "ร้อยไหม", "วิตามิน", "Package / Offer", "ไม่ระบุโปรดักต์"];
const groupOptions = [
  { label: "New Brief", id: "new_group29179" },
  { label: "Creative /พี่โฮม", id: "new_group__1" },
  { label: "Creative /เอิน", id: "group_mm0em08x" },
  { label: "Team Approving", id: "new_group92743__1" },
  { label: "Client Approving", id: "new_group38334__1" },
  { label: "Post", id: "new_group48537__1" },
];

// This is only the small workload seed used until the deployed Monday calendar
// credential is configured. The scheduling algorithm itself always balances
// workload count plus format count, including the newly planned items.
const existingWork: ExistingWork[] = [
  { date: "2026-07-27", format: "อัลบั้ม", title: "Fill-D · ร้อยไหม เคสรีวิว" },
  { date: "2026-07-30", format: "วิดีโอ", title: "Root Privé · Volnewmer 100 Shot" },
  { date: "2026-07-31", format: "ภาพ", title: "NV · Therafill 1cc" },
];

function monthNow() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function localDateFromIso(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function thaiDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(localDateFromIso(date));
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => isoFromDate(new Date(year, monthNumber - 1, index + 1)));
}

function scrollToId(id: string) {
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
}

function titleForMonday(client: string, month: string, number: number, idea: Idea) {
  const monthLabel = month.replace("-", "");
  return `${client} | ${monthLabel} | ${String(number).padStart(2, "0")} | ${idea.product} | ${idea.title}`;
}

function buildSlides(client: string, month: string, theme: string, ideas: Idea[]) {
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(localDateFromIso(`${month}-01`));
  return [
    { id: "slide-cover", kind: "cover" as const, title: `Content Plan · ${client}`, body: `${monthLabel}\nคอนเซ็ปต์ประจำเดือน: ${theme || "สร้างบทสนทนาที่พาไปสู่การนัด"}` },
    { id: "slide-strategy", kind: "strategy" as const, title: "แนวคิดและบทบาทของแผน", body: "ใช้คอนเทนท์หลายมุมเพื่อพาคนจากปัญหา → ความเข้าใจ → ความมั่นใจ → การทักแชต\n\nทุกชิ้นต้องมี Hook ที่ชัด เหตุผลรองรับ และคำถามที่แอดมินใช้ตอบต่อได้" },
    ...ideas.map((idea, index) => ({
      id: `slide-${idea.id}`,
      kind: "content" as const,
      title: `${String(index + 1).padStart(2, "0")} · ${idea.title}`,
      body: `รูปแบบ: ${idea.format}\nมุมเล่า: ${idea.pillar}\n\nHook: ${idea.hook}\n\nเหตุผลที่ควรทำ: ${idea.reason}\n\nแอดมินต่อบทสนทนา: ${idea.adminAngle}`,
    })),
  ];
}

function balancedDates(ideas: Idea[], month: string) {
  const allDates = daysInMonth(month);
  const existing = existingWork.filter((work) => work.date.startsWith(month));
  const assignments = new Map<string, { total: number; formats: Record<Format, number> }>();
  for (const date of allDates) assignments.set(date, { total: 0, formats: { วิดีโอ: 0, ภาพ: 0, อัลบั้ม: 0 } });
  for (const work of existing) {
    const slot = assignments.get(work.date);
    if (slot) { slot.total += 1; slot.formats[work.format] += 1; }
  }

  const result = new Map<string, string>();
  ideas.forEach((idea, index) => {
    const idealIndex = Math.round(((index + 0.5) * allDates.length) / ideas.length) - 1;
    const candidates = allDates
      .map((date, dateIndex) => ({ date, dateIndex, slot: assignments.get(date)! }))
      .sort((a, b) => {
        const scoreA = a.slot.total * 12 + a.slot.formats[idea.format] * 7 + Math.abs(a.dateIndex - idealIndex) * 0.75;
        const scoreB = b.slot.total * 12 + b.slot.formats[idea.format] * 7 + Math.abs(b.dateIndex - idealIndex) * 0.75;
        return scoreA - scoreB || a.dateIndex - b.dateIndex;
      })[0];
    result.set(idea.id, candidates.date);
    candidates.slot.total += 1;
    candidates.slot.formats[idea.format] += 1;
  });
  return result;
}

export default function Home() {
  const [client, setClient] = useState("NV");
  const [planMonth, setPlanMonth] = useState(monthNow);
  const [theme, setTheme] = useState("เพิ่มบทสนทนาที่มีโอกาสนัด และมีคอนเทนท์ที่ใช้ยิงแอดต่อได้");
  const [quantity, setQuantity] = useState(12);
  const [briefs, setBriefs] = useState<ProductBrief[]>([{ id: "brief-1", product: "Botox", goal: "แก้ concern ริ้วรอยและทำให้กล้าทัก", customNeed: "" }]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [step, setStep] = useState(1);
  const [groupId, setGroupId] = useState(groupOptions[0].id);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState("ตั้งเดือน เป้าหมาย และหัวข้อที่อยากสื่อ แล้วให้ AI แตกหลายทางเลือกในครั้งเดียว");
  const adsOnly = !contentClients.includes(client);

  const selectedIdeas = useMemo(() => ideas.filter((idea) => idea.selected), [ideas]);
  const scheduledIdeas = useMemo(() => selectedIdeas.filter((idea) => idea.date), [selectedIdeas]);
  const activeGroup = groupOptions.find((group) => group.id === groupId) ?? groupOptions[0];
  const monthDates = useMemo(() => daysInMonth(planMonth), [planMonth]);
  const monthExisting = useMemo(() => existingWork.filter((work) => work.date.startsWith(planMonth)), [planMonth]);

  function updateBrief(id: string, field: keyof Omit<ProductBrief, "id">, value: string) {
    setBriefs((current) => current.map((brief) => brief.id === id ? { ...brief, [field]: value } : brief));
  }

  function addBrief() {
    setBriefs((current) => [...current, { id: `brief-${Date.now()}`, product: "ไม่ระบุโปรดักต์", goal: "", customNeed: "" }]);
  }

  function removeBrief(id: string) {
    setBriefs((current) => current.length === 1 ? current : current.filter((brief) => brief.id !== id));
  }

  async function generateIdeas() {
    const usableBriefs = briefs.filter((brief) => brief.product !== "ไม่ระบุโปรดักต์" || brief.goal || brief.customNeed);
    if (!usableBriefs.length) return setNotice("เพิ่มอย่างน้อย 1 โปรดักต์ หรือพิมพ์เรื่องที่อยากสื่อก่อนให้ AI คิด");
    setIsGenerating(true);
    setNotice("AI กำลังแตกแนวคิดหลายมุมจากโจทย์เดือนนี้…");
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client, planMonth, theme, quantity, briefs: usableBriefs }),
      });
      const payload = await response.json() as { ideas?: Omit<Idea, "selected" | "date">[]; error?: string; nextStep?: string };
      if (!response.ok || !payload.ideas) throw new Error(payload.nextStep ?? payload.error ?? "AI ยังสร้างไอเดียไม่ได้");
      setIdeas(payload.ideas.map((idea, index) => ({ ...idea, id: idea.id || `IDEA-${String(index + 1).padStart(2, "0")}`, selected: index < quantity })));
      setSlides([]);
      setStep(2);
      setNotice(`AI สร้าง ${payload.ideas.length} ไอเดียแล้ว — ระบบเลือก ${quantity} ชิ้นแรกที่คละรูปแบบไว้ให้ คุณคัดหรือปรับเพิ่มได้`);
      scrollToId("idea-selection");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ยังเชื่อม AI ไม่สำเร็จ");
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleIdea(id: string) {
    setIdeas((current) => current.map((idea) => idea.id === id ? { ...idea, selected: !idea.selected } : idea));
  }

  function selectRecommended() {
    setIdeas((current) => current.map((idea, index) => ({ ...idea, selected: index < quantity })));
    setNotice(`เลือก ${quantity} ชิ้นที่ AI จัดให้คละโปรดักต์ มุมเล่า และรูปแบบแล้ว`);
  }

  function makeProposal() {
    if (!selectedIdeas.length) return setNotice("เลือกอย่างน้อย 1 ไอเดียก่อนสร้างข้อเสนอ");
    setSlides(buildSlides(client, planMonth, theme, selectedIdeas));
    setStep(3);
    setNotice(`สร้างสไลด์คอนเซ็ปต์เดือนนี้และคำอธิบาย ${selectedIdeas.length} คอนเทนท์แล้ว — แก้ข้อความรายหน้าได้เลย`);
    scrollToId("proposal-slides");
  }

  function updateSlide(id: string, field: "title" | "body", value: string) {
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, [field]: value } : slide));
  }

  function approveProposal() {
    setStep(4);
    setNotice("ผ่านทั้งแผนแล้ว — ขั้นต่อไปคือกระจายวันลงตลอดทั้งเดือน โดยดูจำนวนงานและประเภทงานในแต่ละวัน");
    scrollToId("month-calendar");
  }

  function schedulePlan() {
    const dates = balancedDates(selectedIdeas, planMonth);
    setIdeas((current) => current.map((idea) => idea.selected ? { ...idea, date: dates.get(idea.id) } : idea));
    setStep(5);
    setNotice(`จัดวันลง ${selectedIdeas.length} ชิ้นครบทั้งเดือนแล้ว — ระบบกระจายตามจำนวนงานและประเภทงาน ไม่ได้ตัดวันหยุดออก`);
    scrollToId("monday-destination");
  }

  function openMondayConfirmation() {
    if (adsOnly) return setNotice("ลูกค้ารายนี้เป็น Ads-only: จบที่ข้อเสนอและสไลด์ ไม่สร้างงานใน Monday");
    if (scheduledIdeas.length !== selectedIdeas.length) return setNotice("จัดวันลงให้ครบทุกชิ้นก่อนส่ง Monday");
    setShowConfirm(true);
  }

  async function confirmMonday() {
    try {
      const response = await fetch("/api/monday/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          tasks: selectedIdeas.map((idea, index) => ({
            contentId: idea.id,
            title: titleForMonday(client, planMonth, index + 1, idea),
            client,
            format: idea.format,
            scheduledFor: idea.date,
          })),
        }),
      });
      const payload = await response.json() as { created?: number; error?: string; nextStep?: string };
      if (!response.ok) throw new Error(payload.nextStep ?? payload.error ?? "ส่ง Monday ไม่สำเร็จ");
      setNotice(`สร้าง ${payload.created ?? selectedIdeas.length} งานใน ${activeGroup.label} เรียบร้อยแล้ว`);
      setShowConfirm(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ส่ง Monday ไม่สำเร็จ");
    }
  }

  const stages = ["ตั้งโจทย์", "คัดชุดไอเดีย", "ทำสไลด์", "อนุมัติแผน", "จัดวันและส่ง Monday"];

  return <main className="planner-shell" id="top">
    <header className="planner-header">
      <a className="brand" href="#top" aria-label="Marktech Content OS home"><span className="brand-mark">m</span><span><strong>marktech</strong><small>content planning OS</small></span></a>
      <div className="header-copy"><strong>วางแผนคอนเทนท์รายเดือน</strong><span>AI คิด → ทีมคัด → ลูกค้าอนุมัติ → ส่งทีมผลิต</span></div>
      <button className="button button-secondary" onClick={() => { setIdeas([]); setSlides([]); setStep(1); setNotice("เริ่มแผนใหม่ได้เลย"); scrollToId("brief"); }} type="button">+ เริ่มแผนใหม่</button>
    </header>

    <section className="hero">
      <p className="eyebrow">MARKTECH CONTENT OS · MONTHLY PLANNING</p>
      <h1>สั่งโจทย์ครั้งเดียว<br />ให้ AI คิดทั้งเดือน</h1>
      <p>หลายโปรดักต์ก็ได้ ไม่มีโปรดักต์ก็ได้ แล้วคัดเป็นแผนที่พร้อมนำเสนอและส่งทีมผลิต</p>
      <ol className="journey" aria-label="ขั้นตอนการวางแผน">{stages.map((stage, index) => <li className={step > index + 1 ? "done" : step === index + 1 ? "active" : ""} key={stage}><span>{step > index + 1 ? "✓" : index + 1}</span><strong>{stage}</strong></li>)}</ol>
    </section>

    <div className="notice" role="status"><strong>สถานะ</strong><span>{notice}</span></div>

    <section className="flow-card" id="brief">
      <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 1</p><h2>ตั้งโจทย์ของเดือน</h2><p>เลือกลูกค้า เดือน และเรื่องที่อยากผลักดันในเดือนนี้ จะมีหลายโปรดักต์หรือเป็นเรื่องกว้าง ๆ ก็ได้</p></div><span className="pill">AI สร้าง · Planner คัด</span></div>
      <div className="brief-grid">
        <label>ลูกค้า<select value={client} onChange={(event) => setClient(event.target.value)}>{clientOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>เดือนที่ต้องการแพลน<input aria-label="เดือนที่ต้องการแพลน" type="month" value={planMonth} onChange={(event) => setPlanMonth(event.target.value)} /></label>
        <label className="span-two">คอนเซ็ปต์หรือเป้าหมายหลักของเดือน<textarea value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="เช่น เดือนนี้ต้องการให้คนเข้าใจว่า Botox ไม่ได้ทำให้หน้าตึง และพาไปสู่การนัด" /></label>
        <label>อยากได้กี่ชิ้นในแผน<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{[8, 10, 12, 16, 20].map((number) => <option value={number} key={number}>{number} ชิ้น</option>)}</select></label>
      </div>
      <div className="product-briefs"><div className="section-label"><div><strong>โปรดักต์ / เรื่องที่อยากสื่อ</strong><span>เพิ่มได้หลายแถว และใช้ “ไม่ระบุโปรดักต์” สำหรับเรื่องแบรนด์ โปร หรือคอนเทนท์ทั่วไป</span></div><button className="text-button" type="button" onClick={addBrief}>+ เพิ่มเรื่อง</button></div>
        {briefs.map((brief, index) => <div className="product-row" key={brief.id}><strong className="row-number">{index + 1}</strong><label>โปรดักต์<select aria-label={`โปรดักต์ ${index + 1}`} value={brief.product} onChange={(event) => updateBrief(brief.id, "product", event.target.value)}>{productOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>อยากให้สื่ออะไร<input value={brief.goal} onChange={(event) => updateBrief(brief.id, "goal", event.target.value)} placeholder="เช่น ชวนคนที่ลังเลให้ทัก" /></label><label>เงื่อนไข / ความต้องการเพิ่ม<input value={brief.customNeed} onChange={(event) => updateBrief(brief.id, "customNeed", event.target.value)} placeholder="เช่น ใช้หมอพูด, มีโปร 2.2" /></label><button className="icon-button" type="button" aria-label={`ลบเรื่องที่ ${index + 1}`} disabled={briefs.length === 1} onClick={() => removeBrief(brief.id)}>×</button></div>)}</div>
      <div className="action-row"><button className="button button-primary" type="button" onClick={generateIdeas} disabled={isGenerating}>{isGenerating ? "AI กำลังคิด…" : "ให้ AI แตกไอเดีย 36 ชิ้น →"}</button><span>ได้หลายทางเลือกในครั้งเดียว ไม่ใช่ไอเดียตายตัว</span></div>
    </section>

    {step >= 2 && <section className="flow-card" id="idea-selection">
      <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 2</p><h2>คัดชุดไอเดียสำหรับแผนนี้</h2><p>AI คิดมาให้หลายมุม เลือกเป็นชุด ไม่ต้องตัดสินใจและสร้างทีละงาน</p></div><button className="button button-secondary" onClick={selectRecommended} type="button">เลือก {quantity} ชิ้นที่แนะนำ</button></div>
      <div className="selection-summary"><strong>เลือก {selectedIdeas.length} / {ideas.length} ชิ้น</strong><span>คละโปรดักต์ รูปแบบ และมุมเล่าเพื่อให้ทั้ง feed และ ads ไม่จำเจ</span></div>
      <div className="idea-grid">{ideas.map((idea) => <button className={`idea-tile ${idea.selected ? "selected" : ""}`} onClick={() => toggleIdea(idea.id)} aria-pressed={idea.selected} type="button" key={idea.id}><span>{idea.selected ? "✓" : "+"} {idea.id} · {idea.format}</span><strong>{idea.title}</strong><p>{idea.hook}</p><em>{idea.product} · {idea.pillar}</em></button>)}</div>
      <div className="sticky-action"><span><strong>{selectedIdeas.length} ไอเดีย</strong> พร้อมรวมเป็นข้อเสนอ</span><button className="button button-primary" onClick={makeProposal} type="button">ทำสไลด์เสนอแผน →</button></div>
    </section>}

    {step >= 3 && <section className="flow-card" id="proposal-slides">
      <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 3 · สไลด์เสนอ</p><h2>สไลด์คอนเซ็ปต์เดือนนี้</h2><p>แก้ข้อความและเพิ่มบริบทในแต่ละหน้าได้ก่อนนำเสนอ ไม่ใช่แค่รายการหัวข้อคอนเทนท์</p></div><button className="button button-secondary" type="button" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button></div>
      <div className="slides-editor">{slides.map((slide, index) => <article className={`proposal-slide ${slide.kind}`} key={slide.id}><span>SLIDE {String(index + 1).padStart(2, "0")}</span><textarea aria-label={`หัวข้อสไลด์ ${index + 1}`} className="slide-title" value={slide.title} onChange={(event) => updateSlide(slide.id, "title", event.target.value)} /><textarea aria-label={`เนื้อหาสไลด์ ${index + 1}`} className="slide-body" value={slide.body} onChange={(event) => updateSlide(slide.id, "body", event.target.value)} /></article>)}</div>
      <div className="slide-tools"><button className="text-button" type="button" onClick={() => setSlides((current) => [...current, { id: `custom-${Date.now()}`, kind: "custom", title: "หัวข้อสไลด์เพิ่มเติม", body: "พิมพ์ข้อความที่ต้องการนำเสนอ" }])}>+ เพิ่มสไลด์</button><span>แก้ทุกหน้าจากช่องข้อความโดยตรง แล้วใช้ปุ่มพิมพ์เป็น PDF สำหรับส่งลูกค้า</span></div>
      <div className="approval-panel"><div><strong>ลูกค้าตรวจแผนนี้แล้วหรือยัง?</strong><span>ถ้ายังไม่ผ่าน กลับไปคัดไอเดียหรือแก้สไลด์ก่อนล็อกวันลง</span></div><div><button className="button button-secondary" onClick={() => { setStep(2); scrollToId("idea-selection"); }} type="button">กลับไปปรับ</button><button className="button button-primary" onClick={approveProposal} type="button">ผ่านทั้งแผน → จัดวันลง</button></div></div>
    </section>}

    {step >= 4 && <section className="flow-card" id="month-calendar">
      <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 4</p><h2>วางวันลงตลอดทั้งเดือน</h2><p>ลงได้ทุกวัน ระบบดูว่าวันไหนมีงานกี่ชิ้นและเป็นรูปแบบอะไร เพื่อไม่ให้กระจุกในวันเดียวหรือชนรูปแบบเดิม</p></div><button className="button button-primary" onClick={schedulePlan} type="button">กระจายวันลงอัตโนมัติ</button></div>
      <div className="calendar-summary"><strong>{new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(localDateFromIso(`${planMonth}-01`))}</strong><span>งานเดิมในเดือนนี้ {monthExisting.length} ชิ้น · ระบบพิจารณาจำนวนงานรวม + จำนวนงานแต่ละประเภทต่อวัน</span></div>
      <div className="calendar-grid">{monthDates.map((date) => { const oldItems = monthExisting.filter((item) => item.date === date); const newItems = scheduledIdeas.filter((idea) => idea.date === date); return <article className={`calendar-day ${newItems.length ? "planned" : ""}`} key={date}><time>{localDateFromIso(date).getDate()}</time><span className="calendar-load">{oldItems.length + newItems.length ? `${oldItems.length + newItems.length} งาน` : "ว่าง"}</span>{oldItems.map((item) => <small className="existing" key={item.title}>{item.format} · {item.title}</small>)}{newItems.map((item) => <small className="planned-item" key={item.id}>{item.format} · {item.id}</small>)}</article>; })}</div>
      {step === 5 && <div className="schedule-result"><strong>ตรวจแล้ว: {scheduledIdeas.length} ชิ้นมีวันลงครบ</strong><span>กระจายทั้งเดือน {planMonth} โดยไม่ตัดวันหยุดหรือสุดสัปดาห์</span></div>}
    </section>}

    {step === 5 && <section className="flow-card" id="monday-destination">
      <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 5 · ส่งงาน</p><h2>เลือกปลายทาง Monday แล้วค่อยยืนยัน</h2><p>ระบบจะตั้งชื่อให้ตาม ลูกค้า · เดือน · ลำดับชิ้นในเดือน · โปรดักต์ · หัวข้อคอนเทนท์</p></div><span className="pill">พร้อมตรวจ</span></div>
      {adsOnly ? <div className="ads-only"><strong>ลูกค้ารายนี้เป็น Ads-only</strong><span>จบที่สไลด์และคำแนะนำคอนเทนท์ จึงไม่มีการสร้างงานเข้า Monday</span></div> : <><div className="destination-grid"><label>Board<select aria-label="Board" disabled><option>Marktech : Content (Jul 2026)</option></select></label><label>Group ปลายทาง<select aria-label="Group ปลายทาง" value={groupId} onChange={(event) => setGroupId(event.target.value)}>{groupOptions.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label><div><span>จำนวนที่จะสร้าง</span><strong>{selectedIdeas.length} งาน</strong><small>มีวันที่ลงครบทุกชิ้น</small></div></div><div className="monday-preview"><strong>ตัวอย่างชื่อที่จะสร้าง</strong>{selectedIdeas.slice(0, 3).map((idea, index) => <span key={idea.id}>{titleForMonday(client, planMonth, index + 1, idea)}</span>)}{selectedIdeas.length > 3 && <small>…และอีก {selectedIdeas.length - 3} งาน</small>}</div><div className="action-row"><button className="button button-primary" onClick={openMondayConfirmation} type="button">ตรวจ {selectedIdeas.length} งานก่อนส่ง →</button><span>ยังไม่มีงานถูกสร้างจนกว่าจะยืนยันในหน้าถัดไป</span></div></>}
    </section>}

    {showConfirm && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><section className="confirm-modal"><p className="eyebrow">ก่อนส่งจริง</p><h2 id="confirm-title">ยืนยันสร้าง {selectedIdeas.length} งานใน Monday</h2><p>Board: <strong>Marktech : Content (Jul 2026)</strong> · Group: <strong>{activeGroup.label}</strong></p><div className="confirm-list">{selectedIdeas.map((idea, index) => <div key={idea.id}><span>{idea.id}</span><strong>{titleForMonday(client, planMonth, index + 1, idea)}</strong><time>{idea.date ? thaiDate(idea.date) : "ยังไม่มีวัน"}</time></div>)}</div><div className="modal-actions"><button className="button button-secondary" onClick={() => setShowConfirm(false)} type="button">กลับไปแก้</button><button className="button button-primary" onClick={confirmMonday} type="button">ยืนยันส่ง {selectedIdeas.length} งาน</button></div></section></div>}
  </main>;
}
