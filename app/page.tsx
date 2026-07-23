"use client";

import { useMemo, useState } from "react";

type Format = "วิดีโอ" | "ภาพ" | "อัลบั้ม";
type Idea = {
  id: string;
  title: string;
  hook: string;
  format: Format;
  pillar: string;
  selected: boolean;
  date?: string;
};

const contentClients = ["NV", "Root Privé", "Fill-D", "Be Bright", "A&B Clinic", "Sherlyn", "Facial Studio", "Luxe Aesthetics"];
const clientOptions = [...contentClients, "Essoul (Ads-only)", "Meseoul (Ads-only)", "De'Vana (Ads-only)", "Boseong (Ads-only)"];
const blockedDates = new Map([
  ["2026-07-27", "Fill-D · ร้อยไหม เคสรีวิว"],
  ["2026-07-28", "วันหยุดนักขัตฤกษ์"],
  ["2026-07-30", "Root Privé · Volnewmer 100 Shot"],
  ["2026-07-31", "NV · Therafill 1cc"],
]);
const groupOptions = ["New Brief", "Creative /พี่โฮม", "Creative /เอิน", "Team Approving", "Client Approving", "Post"];
const ideaSeeds = [
  ["Pain point", "คนที่เห็นคลิปนี้น่าจะกำลังเจอปัญหานี้อยู่"],
  ["Before deciding", "ก่อนตัดสินใจ อยากให้เช็กข้อนี้ก่อน"],
  ["Myth busting", "ความเชื่อที่ทำให้หลายคนตัดสินใจช้าเกินไป"],
  ["Compare", "ไม่ใช่ทุกเคสต้องเลือกทางเดียวกัน"],
  ["Proof", "ให้เคสจริงช่วยตอบคำถามแทนคำโฆษณา"],
  ["Expert", "หมออธิบายสั้น ๆ ว่าอะไรคือจุดที่ต้องดู"],
  ["Objection", "กลัวเจ็บ กลัวไม่ธรรมชาติ หรือกลัวไม่คุ้ม"],
  ["Routine", "สัญญาณเล็ก ๆ ในชีวิตประจำวันที่บอกว่าควรเริ่มดูแล"],
  ["Offer bridge", "เริ่มจากปัญหา แล้วค่อยพาไปดูโปรที่เหมาะ"],
  ["Aftercare", "ทำแล้วต้องดูแลอย่างไรให้ผลลัพธ์ดูดี"],
  ["FAQ", "คำถามที่แอดมินเจอบ่อยที่สุดก่อนลูกค้าจอง"],
  ["Social proof", "คนที่ลังเลแบบเดียวกัน ตัดสินใจจากอะไร"],
] as const;

function thaiDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`));
}

function createIdeas(program: string, concern: string): Idea[] {
  return Array.from({ length: 36 }, (_, index) => {
    const [pillar, hook] = ideaSeeds[index % ideaSeeds.length];
    const variation = Math.floor(index / ideaSeeds.length) + 1;
    const format: Format = index % 3 === 0 ? "วิดีโอ" : index % 3 === 1 ? "ภาพ" : "อัลบั้ม";
    return {
      id: `IDEA-${String(index + 1).padStart(2, "0")}`,
      title: `${program}: ${pillar === "Pain point" ? `${concern} แบบไหนที่ไม่ควรปล่อยไว้` : `${pillar} สำหรับคนที่กำลังคิดเรื่อง ${program}`} · มุมที่ ${variation}`,
      hook,
      format,
      pillar,
      selected: index < 12,
    };
  });
}

function nextAvailableDates(amount: number) {
  const dates: string[] = [];
  const cursor = new Date("2026-07-24T00:00:00");
  while (dates.length < amount) {
    const iso = cursor.toISOString().slice(0, 10);
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6 && !blockedDates.has(iso)) dates.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export default function Home() {
  const [client, setClient] = useState("NV");
  const [program, setProgram] = useState("Botox");
  const [concern, setConcern] = useState("ริ้วรอย");
  const [quantity, setQuantity] = useState(12);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [step, setStep] = useState(1);
  const [group, setGroup] = useState("New Brief");
  const [showConfirm, setShowConfirm] = useState(false);
  const [notice, setNotice] = useState("เริ่มจากกรอกโจทย์ครั้งเดียว แล้วระบบจะพาไปจนถึงการส่งงาน");
  const adsOnly = !contentClients.includes(client);

  const selectedIdeas = useMemo(() => ideas.filter((idea) => idea.selected), [ideas]);
  const scheduledIdeas = useMemo(() => selectedIdeas.filter((idea) => idea.date), [selectedIdeas]);

  function generateIdeas() {
    setIdeas(createIdeas(program, concern));
    setStep(2);
    setNotice("สร้างชุดไอเดีย 36 ชิ้นแล้ว — เลือกเฉพาะชิ้นที่ควรเข้าแผนเดือนนี้");
  }

  function toggleIdea(id: string) {
    setIdeas((current) => current.map((idea) => idea.id === id ? { ...idea, selected: !idea.selected } : idea));
  }

  function selectRecommended() {
    setIdeas((current) => current.map((idea, index) => ({ ...idea, selected: index < quantity })));
    setNotice(`เลือก ${quantity} ไอเดียที่หลากหลายและเหมาะกับการปิดนัดให้แล้ว — คุณกดแก้รายชิ้นได้`);
  }

  function makeProposal() {
    if (selectedIdeas.length === 0) return setNotice("เลือกอย่างน้อย 1 ไอเดียก่อนทำข้อเสนอ");
    setStep(3);
    setNotice(`สรุปแผน ${selectedIdeas.length} ชิ้นเป็นข้อเสนอสำหรับ ${client} แล้ว`);
  }

  function approveProposal() {
    setStep(4);
    setNotice("แผนผ่านลูกค้าแล้ว — ขั้นต่อไปคือจัดวันลงที่ไม่ชนงานและไม่ชนวันหยุด");
  }

  function schedulePlan() {
    const dates = nextAvailableDates(selectedIdeas.length);
    let position = 0;
    setIdeas((current) => current.map((idea) => idea.selected ? { ...idea, date: dates[position++] } : idea));
    setStep(5);
    setNotice(`จัดวันลงครบ ${selectedIdeas.length} ชิ้นแล้ว ระบบข้ามวันหยุดและวันที่มีงานใน Monday อยู่แล้ว`);
  }

  function openMondayConfirmation() {
    if (adsOnly) return setNotice("ลูกค้ารายนี้เป็น Ads-only: จบที่เอกสารแนะนำคอนเทนท์ ไม่สร้างงานใน Monday");
    if (scheduledIdeas.length !== selectedIdeas.length) return setNotice("จัดวันลงให้ครบทุกชิ้นก่อนส่ง Monday");
    setShowConfirm(true);
  }

  function confirmMonday() {
    setShowConfirm(false);
    setNotice("เว็บแอปยังไม่ได้รับสิทธิ์เชื่อม Monday ฝั่งเซิร์ฟเวอร์ จึงยังไม่ส่งงานจริงและไม่สร้างงานซ้ำ — ปลายทางที่เลือกถูกบันทึกไว้ให้ตรวจแล้ว");
  }

  const stages = ["ตั้งโจทย์", "คัดชุดไอเดีย", "สรุปเสนอ", "อนุมัติแผน", "จัดวันและส่ง Monday"];

  return <main className="planner-shell">
    <header className="planner-header">
      <a className="brand" href="#top" aria-label="Marktech Content OS home"><span className="brand-mark">m</span><span><strong>marktech</strong><small>content planning OS</small></span></a>
      <div className="header-copy"><strong>วางแผนคอนเทนท์รายเดือน</strong><span>ทำครั้งเดียว จบถึงทีมผลิต</span></div>
      <button className="button button-secondary" onClick={() => { setIdeas([]); setStep(1); setNotice("เริ่มแผนใหม่ได้เลย"); }} type="button">+ เริ่มแผนใหม่</button>
    </header>

    <div className="planner-main" id="top">
      <section className="hero">
        <p className="eyebrow">MARKTECH CONTENT OS · WORKFLOW</p>
        <h1>จากโจทย์เดียว<br/>ไปถึงงานใน Monday</h1>
        <p>ไม่ต้องนั่งยืนยันไอเดียทีละชิ้น ระบบสร้างตัวเลือกให้คัด → รวมเป็นข้อเสนอ → วางวันลง → ให้ตรวจปลายทางก่อนส่ง</p>
      </section>

      <ol className="journey" aria-label="ขั้นตอนการวางแผน">
        {stages.map((name, index) => <li className={step > index + 1 ? "done" : step === index + 1 ? "current" : ""} key={name}><span>{step > index + 1 ? "✓" : index + 1}</span><strong>{name}</strong></li>)}
      </ol>

      <div className="notice" role="status"><span>สถานะ</span>{notice}</div>

      <section className="flow-card brief-card">
        <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 1</p><h2>บอกโจทย์ครั้งเดียว</h2><p>ระบบจะใช้โจทย์นี้สร้างไอเดียหลายมุมให้คัด ไม่ใช่โยนไอเดียเดี่ยวมาให้กด</p></div><span className="step-chip">AI สร้าง · Planner คัด</span></div>
        <div className="brief-fields">
          <label>ลูกค้า<select value={client} onChange={(event) => setClient(event.target.value)}>{clientOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label>Program<select value={program} onChange={(event) => setProgram(event.target.value)}><option>Botox</option><option>Filler</option><option>HIFU</option><option>Ultraformer</option><option>Pico</option><option>Package / Offer</option></select></label>
          <label>Concern<input value={concern} onChange={(event) => setConcern(event.target.value)} /></label>
          <label>อยากได้กี่ชิ้นในแผน<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}><option value={8}>8 ชิ้น</option><option value={10}>10 ชิ้น</option><option value={12}>12 ชิ้น</option><option value={16}>16 ชิ้น</option></select></label>
        </div>
        {adsOnly && <p className="scope-note"><strong>Ads-only</strong> รายนี้จะได้ข้อเสนอ/คำแนะนำคอนเทนท์ครบ แต่จะไม่ถูกส่งเป็น task ใน Monday</p>}
        <button className="button button-primary" onClick={generateIdeas} type="button">แตกไอเดีย 36 ชิ้นให้คัด <span>→</span></button>
      </section>

      {ideas.length > 0 && <section className="flow-card ideas-card">
        <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 2</p><h2>คัดชุดไอเดีย ไม่ต้องตัดสินใจทีละชิ้น</h2><p>เลือก {selectedIdeas.length} / {quantity} ชิ้น · ระบบคละมุมเล่า รูปแบบ และจุดที่ช่วยต่อบทสนทนาของแอดมิน</p></div><button className="button button-secondary" onClick={selectRecommended} type="button">เลือก {quantity} ชิ้นที่แนะนำ</button></div>
        <div className="idea-grid">
          {ideas.map((idea) => <button aria-pressed={idea.selected} className={idea.selected ? "idea-tile selected" : "idea-tile"} key={idea.id} onClick={() => toggleIdea(idea.id)} type="button">
            <span className="idea-check">{idea.selected ? "✓" : "+"}</span><small>{idea.id} · {idea.format}</small><strong>{idea.title}</strong><p>{idea.hook}</p><em>{idea.pillar}</em>
          </button>)}
        </div>
        <div className="sticky-action"><div><strong>{selectedIdeas.length} ไอเดีย</strong><span>พร้อมรวมเป็นแผนสำหรับลูกค้า</span></div><button className="button button-primary" onClick={makeProposal} type="button">สรุปเป็นแผนและสไลด์ <span>→</span></button></div>
      </section>}

      {step >= 3 && <section className="flow-card proposal-card">
        <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 3 · เอกสารเสนอ</p><h2>สรุปเพื่อให้ลูกค้าตัดสินใจทั้งแผน</h2><p>นี่คือหน้าสรุปที่จะใช้เป็นโครงสไลด์: ไม่ให้ลูกค้าตรวจแบบงานกระจัดกระจาย</p></div><span className="step-chip">{selectedIdeas.length} ชิ้น · {client}</span></div>
        <div className="proposal-summary">
          <article><span>เป้าหมายหลัก</span><strong>สร้างบทสนทนาที่พาไปสู่การนัด</strong><p>ใช้ {program} ผ่าน concern “{concern}” โดยเริ่มจากความเข้าใจ ไม่ขายโปรทันที</p></article>
          <article><span>โครงคอนเทนท์</span><strong>Educate 40% · Proof 35% · Convert 25%</strong><p>มีทั้งวิดีโอ ภาพ และอัลบั้ม เพื่อไม่ให้ฟีดจำเจและใช้ยิงแอดได้หลายมุม</p></article>
          <article><span>สิ่งที่แอดมินใช้ต่อ</span><strong>Hook + เหตุผล + จุดถามกลับ</strong><p>ทุกชิ้นถูกวางให้ทีมแอดมินตอบต่อและชวนจองได้ ไม่ได้เอาแค่ยอด reach</p></article>
        </div>
        <div className="proposal-list">{selectedIdeas.map((idea, index) => <div key={idea.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{idea.title}</strong><small>{idea.format} · {idea.pillar}</small></div>)}</div>
        <div className="approval-bar"><div><strong>ลูกค้าตรวจแผนนี้แล้วหรือยัง?</strong><span>ถ้ายังไม่ผ่าน ให้ย้อนกลับไปคัด/ปรับชุดไอเดียก่อนล็อกวันลง</span></div><div><button className="button button-secondary" onClick={() => { setStep(2); setNotice("กลับไปปรับชุดไอเดียได้เลย — ข้อเสนอยังไม่ถูกล็อก"); }} type="button">กลับไปปรับ</button><button className="button button-primary" onClick={approveProposal} type="button">ผ่านทั้งแผน → จัดวันลง</button></div></div>
      </section>}

      {step >= 4 && <section className="flow-card schedule-card">
        <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 4</p><h2>จัดวันลงให้ไม่ชนงานอื่น</h2><p>ระบบจะข้ามเสาร์-อาทิตย์ วันหยุด และวันที่มีงานบน Monday อยู่แล้ว จากนั้นให้ Planner ตรวจอีกครั้ง</p></div><button className="button button-primary" onClick={schedulePlan} type="button">จัดวันลงอัตโนมัติ</button></div>
        <div className="calendar-legend"><span className="busy">งานใน Monday</span><span className="holiday">วันหยุด</span><span className="free">วันว่างที่ใช้ได้</span></div>
        <div className="schedule-grid">
          {["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"].map((date) => {
            const assigned = scheduledIdeas.find((idea) => idea.date === date);
            const blocked = blockedDates.get(date);
            const weekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());
            return <div className={assigned ? "schedule-day assigned" : blocked ? blocked.includes("วันหยุด") ? "schedule-day holiday" : "schedule-day busy" : weekend ? "schedule-day weekend" : "schedule-day"} key={date}><time>{thaiDate(date)}</time><span>{assigned ? assigned.id : blocked ?? (weekend ? "วันหยุดสุดสัปดาห์" : "ว่าง")}</span></div>;
          })}
        </div>
        {step === 5 && <div className="schedule-result"><strong>ตรวจแล้ว: {scheduledIdeas.length} ชิ้นมีวันลงครบ</strong><span>ไม่ชน {Array.from(blockedDates.values()).filter((value) => !value.includes("วันหยุด")).length} งานเดิม และข้ามวันหยุด 1 วัน</span></div>}
      </section>}

      {step >= 5 && <section className="flow-card monday-card">
        <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 5 · ส่งงาน</p><h2>เลือกปลายทาง Monday แล้วค่อยยืนยัน</h2><p>ก่อนส่ง ระบบแสดงให้เห็นชัดว่าอะไรจะถูกสร้าง ที่บอร์ดไหน และกลุ่มไหน</p></div><span className={adsOnly ? "step-chip muted" : "step-chip"}>{adsOnly ? "Ads-only" : "พร้อมตรวจ"}</span></div>
        <div className="monday-destination">
          <label>Board<select disabled={adsOnly}><option>Marktech : Content (Jul 2026)</option></select></label>
          <label>Group ปลายทาง<select disabled={adsOnly} onChange={(event) => setGroup(event.target.value)} value={group}>{groupOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <div><span>จำนวนที่จะสร้าง</span><strong>{selectedIdeas.length} งาน</strong><small>มีวันที่ลงครบทุกชิ้น</small></div>
        </div>
        <div className="monday-actions"><div><strong>{adsOnly ? "จบงานที่ข้อเสนอคอนเทนท์" : `ปลายทาง: ${group}`}</strong><span>{adsOnly ? "ส่งเป็นเอกสารแนะนำให้ลูกค้านำไปทำเอง" : "ยังไม่มีงานถูกสร้างจนกว่าจะกดยืนยันในหน้าถัดไป"}</span></div><button className="button button-primary" onClick={openMondayConfirmation} type="button">{adsOnly ? "ยืนยันข้อเสนอ Ads-only" : `ตรวจ ${selectedIdeas.length} งานก่อนส่ง →`}</button></div>
      </section>}
    </div>

    {showConfirm && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><section className="confirm-modal"><p className="eyebrow">ก่อนส่งจริง</p><h2 id="confirm-title">ยืนยันสร้าง {selectedIdeas.length} งานใน Monday</h2><p>Board: <strong>Marktech : Content (Jul 2026)</strong> · Group: <strong>{group}</strong></p><div className="confirm-list">{selectedIdeas.map((idea) => <div key={idea.id}><span>{idea.id}</span><strong>{idea.title}</strong><time>{idea.date ? thaiDate(idea.date) : "ยังไม่มีวัน"}</time></div>)}</div><div className="modal-actions"><button className="button button-secondary" onClick={() => setShowConfirm(false)} type="button">กลับไปแก้</button><button className="button button-primary" onClick={confirmMonday} type="button">ยืนยันส่ง {selectedIdeas.length} งาน</button></div></section></div>}
  </main>;
}
