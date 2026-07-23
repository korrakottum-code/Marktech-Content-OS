"use client";

import { useMemo, useState } from "react";

type IdeaStatus = "Needs review" | "Confirmed" | "Queued";
type Pattern = "New angle" | "Copy-to-adapt" | "Retest";

type ContentIdea = {
  id: string;
  client: string;
  title: string;
  program: string;
  concern: string;
  format: string;
  hook: string;
  rationale: string;
  scheduledFor: string;
  status: IdeaStatus;
  pattern: Pattern;
};

const navItems = ["วันนี้", "สร้างไอเดีย", "คลังที่เคยทำ", "ตั้งค่าการเชื่อมต่อ"];

const mondayItems = [
  { client: "NV", name: "Therafill 1cc 15,900.-", stage: "รอลูกค้าตรวจ", date: "31 ก.ค." },
  { client: "Root Privé", name: "Volnewmer 100 Shot", stage: "รอ material", date: "30 ก.ค." },
  { client: "Fill-D", name: "ร้อยไหม เคสรีวิว", stage: "รอ material", date: "27 ก.ค." },
];

const initialIdeas: ContentIdea[] = [
  {
    id: "CNT-NV-2607-021",
    client: "NV",
    title: "3 จุดที่ทำให้หน้าดูเหนื่อย ทั้งที่นอนพอ",
    program: "Botox",
    concern: "ริ้วรอย",
    format: "วิดีโอ",
    hook: "หน้าดูเหนื่อย ไม่ได้แปลว่าแก่",
    rationale: "เริ่มจาก pain point ในชีวิตจริง แล้วพาไปสู่ Botox แบบไม่ขายตรงเกินไป",
    scheduledFor: "2026-07-31",
    status: "Needs review",
    pattern: "Copy-to-adapt",
  },
  {
    id: "CNT-ROOT-2607-012",
    client: "Root Privé",
    title: "ยกกระชับแบบไหน เหมาะกับความหย่อนระดับไหน",
    program: "Ultraformer",
    concern: "หน้าหย่อน",
    format: "อัลบั้ม",
    hook: "ไม่ใช่ทุกความหย่อน ต้องใช้เครื่องเดียวกัน",
    rationale: "ช่วยให้แอดมินต่อบทสนทนาและพาคนสนใจไปสู่การนัดได้ง่ายขึ้น",
    scheduledFor: "2026-08-01",
    status: "Needs review",
    pattern: "New angle",
  },
  {
    id: "CNT-FILLD-2607-013",
    client: "Fill-D",
    title: "กลัวเจ็บจนไม่กล้าร้อยไหม? ดูเคสนี้ก่อน",
    program: "ร้อยไหม",
    concern: "กลัวเจ็บ",
    format: "วิดีโอ",
    hook: "คนที่กลัวเข็มที่สุด ยังตัดสินใจทำได้อย่างไร",
    rationale: "ต่อยอดจากรีวิวที่กำลังรอ Material พร้อม CTA ให้แอดมินรับช่วงปิดนัด",
    scheduledFor: "2026-07-30",
    status: "Confirmed",
    pattern: "Retest",
  },
];

function formatThaiDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function patternLabel(pattern: Pattern) {
  return pattern === "Copy-to-adapt"
    ? "ต่อยอดสิ่งที่เวิร์ก"
    : pattern === "New angle"
      ? "หา angle ใหม่"
      : "ทดสอบซ้ำ";
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("วันนี้");
  const [ideas, setIdeas] = useState(initialIdeas);
  const [client, setClient] = useState("NV");
  const [program, setProgram] = useState("Botox");
  const [format, setFormat] = useState("วิดีโอ");
  const [scheduledFor, setScheduledFor] = useState("2026-07-31");
  const [pattern, setPattern] = useState<Pattern>("Copy-to-adapt");
  const [role, setRole] = useState<"Planner" | "PM">("Planner");
  const [notice, setNotice] = useState("วันนี้มี 2 ไอเดียที่ต้องตัดสินใจก่อนทีมเริ่มผลิต");

  const reviewCount = useMemo(
    () => ideas.filter((idea) => idea.status === "Needs review").length,
    [ideas],
  );
  const queueCount = useMemo(
    () => ideas.filter((idea) => idea.status === "Queued").length,
    [ideas],
  );

  function generateDraft() {
    const nextIdea: ContentIdea = {
      id: `CNT-${client.replace(/[^A-Za-z]/g, "").toUpperCase() || "CL"}-2607-${String(ideas.length + 1).padStart(3, "0")}`,
      client,
      title:
        program === "Botox"
          ? "ริ้วรอยแบบไหนที่ Botox ช่วยได้ และแบบไหนต้องดูอย่างอื่นร่วมกัน"
          : `${program} ไม่ได้เหมาะกับทุกคน: เช็ก 3 สัญญาณก่อนตัดสินใจ`,
      program,
      concern: program === "Botox" ? "ริ้วรอย" : "ต้องการคำแนะนำ",
      format,
      hook: "ตัดสินใจจากปัญหาจริง ไม่ใช่จากโปรอย่างเดียว",
      rationale: "ไอเดียนี้วางให้คนดูเข้าใจและให้แอดมินมีจุดเริ่มต้นเพื่อพาไปสู่การนัด",
      scheduledFor,
      status: "Needs review",
      pattern,
    };
    setIdeas((current) => [nextIdea, ...current]);
    setNotice(`สร้างร่างไอเดียสำหรับ ${client} แล้ว — อยู่ในรายการ “รอตัดสินใจ” ด้านล่าง`);
  }

  function confirmIdea(id: string) {
    const selected = ideas.find((idea) => idea.id === id);
    if (!selected?.scheduledFor) {
      setNotice("กรุณาระบุวันที่ลงก่อนส่งต่อเข้า Monday");
      return;
    }
    setIdeas((current) =>
      current.map((idea) => (idea.id === id ? { ...idea, status: "Queued" } : idea)),
    );
    setNotice(`${role} ยืนยันแล้ว — ${selected.title} อยู่ในคิวส่งเข้า Monday`);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="Marktech Content OS home">
          <span className="brand-mark">m</span>
          <span><strong>marktech</strong><small>ระบบวางคอนเทนท์</small></span>
        </a>
        <nav className="top-nav" aria-label="เมนูหลัก">
          {navItems.map((item) => (
            <button
              className={activeNav === item ? "nav-button is-active" : "nav-button"}
              key={item}
              onClick={() => setActiveNav(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
        <label className="role-control">
          <span>กำลังทำงานเป็น</span>
          <select value={role} onChange={(event) => setRole(event.target.value as "Planner" | "PM")}> 
            <option>Planner</option><option>PM</option>
          </select>
        </label>
      </header>

      <div className="app-main" id="top">
        <section className="welcome-row">
          <div>
            <p className="kicker">{activeNav} · พุธ 23 กรกฎาคม</p>
            <h1>เลือกไอเดียที่ควรทำต่อ</h1>
            <p className="lead">เริ่มจากงานที่ต้องตัดสินใจวันนี้ แล้วระบบจะจำสิ่งที่เวิร์กไว้ให้เดือนถัดไป</p>
          </div>
          <div className="welcome-actions">
            <button className="button button-secondary" onClick={() => setNotice("เลื่อนลงเพื่อดูไอเดียที่รอตัดสินใจ") } type="button">ดูรายการรอตัดสินใจ <span>↓</span></button>
            <button className="button button-primary" onClick={generateDraft} type="button">+ สร้างร่างไอเดีย</button>
          </div>
        </section>

        <div className="notice" role="status"><span>วันนี้</span>{notice}</div>

        <section className="priority-grid" aria-label="งานสำคัญวันนี้">
          <article className="priority-card priority-main">
            <span className="card-label">ต้องทำก่อน</span>
            <strong>{reviewCount} ไอเดียรอการตัดสินใจ</strong>
            <p>ยืนยันแล้วจึงจะเข้าคิวสร้างงานใน Monday</p>
            <button className="inline-action" onClick={() => setNotice("เลื่อนลงเพื่อดูไอเดียที่รอตัดสินใจ") } type="button">ตรวจไอเดีย <span>→</span></button>
          </article>
          <article className="priority-card">
            <span className="card-label">พร้อมส่ง Monday</span>
            <strong>{queueCount}</strong>
            <p>มีวันที่ลงครบและรอการเชื่อมต่อแบบปลอดภัย</p>
          </article>
          <article className="priority-card">
            <span className="card-label">ต้องตั้งกฎเพิ่ม</span>
            <strong>2 รายการ</strong>
            <p>ระบบจะไม่เดา เมื่อยังไม่รู้ว่าจะจัดเข้ากลุ่มไหน</p>
          </article>
        </section>

        <section className="work-grid">
          <section className="card composer-card">
            <div className="section-heading">
              <div><p className="kicker">1. ตั้งโจทย์</p><h2>สร้างไอเดียที่นำไปใช้ได้</h2></div>
              <span className="soft-tag">AI ช่วยร่าง · คนเป็นคนเลือก</span>
            </div>
            <div className="field-grid">
              <label>ลูกค้า<select value={client} onChange={(event) => setClient(event.target.value)}>
                <option>NV</option><option>Root Privé</option><option>Fill-D</option><option>Be Bright</option><option>A&amp;B Clinic</option><option>Sherlyn</option><option>Facial Studio</option><option>Luxe Aesthetics</option><option>Essoul (Ads-only)</option><option>Meseoul (Ads-only)</option><option>De&apos;Vana (Ads-only)</option><option>Boseong (Ads-only)</option><option>2Praw (Ads-only)</option><option>The Phat (Ads-only)</option>
              </select></label>
              <label>โปรแกรม<select value={program} onChange={(event) => setProgram(event.target.value)}>
                <option>Botox</option><option>Filler</option><option>HIFU</option><option>Ultraformer</option><option>Pico</option><option>Package / Offer</option>
              </select></label>
              <label>รูปแบบ<select value={format} onChange={(event) => setFormat(event.target.value)}><option>วิดีโอ</option><option>ภาพ</option><option>อัลบั้ม</option></select></label>
              <label>วันที่ลง <em>*</em><input min="2026-07-23" onChange={(event) => setScheduledFor(event.target.value)} type="date" value={scheduledFor} /></label>
            </div>
            <fieldset className="pattern-picker">
              <legend>ใช้แนวทางไหน</legend>
              <div>
                {([
                  ["Copy-to-adapt", "ต่อยอดสิ่งที่เวิร์ก", "ใช้โครงหรือ hook เดิมกับโปรแกรมใหม่"],
                  ["New angle", "หา angle ใหม่", "สร้างมุมพูดใหม่ที่ยังไม่ซ้ำคลัง"],
                  ["Retest", "ทดสอบซ้ำ", "นำ concept ที่ดีมาปรับ execution"],
                ] as [Pattern, string, string][]).map(([value, label, detail]) => (
                  <button className={pattern === value ? "pattern-option selected" : "pattern-option"} key={value} onClick={() => setPattern(value)} type="button">
                    <strong>{label}</strong><small>{detail}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="button button-primary full-width" onClick={generateDraft} type="button">สร้างร่างไอเดียเพื่อให้ตรวจ <span>→</span></button>
          </section>

          <aside className="card production-card">
            <div className="section-heading"><div><p className="kicker">งานผลิตจาก Monday</p><h2>สิ่งที่ทีมกำลังรอ</h2></div><button className="link-button" onClick={() => setNotice("การดึงงานจาก Monday พร้อมเปิดใช้เมื่อเพิ่ม Secret") } type="button">การเชื่อมต่อ</button></div>
            <div className="monday-list">
              {mondayItems.map((item) => <article className="monday-item" key={item.name}>
                <span className="client-badge">{item.client.slice(0, 2)}</span>
                <div><strong>{item.client}</strong><p>{item.name}</p><small>{item.stage}</small></div><time>{item.date}</time>
              </article>)}
            </div>
            <div className="production-note"><strong>หลักการทำงาน</strong><p>Monday เป็นที่ทำงานของทีมผลิต ส่วนที่นี่เป็นที่เก็บความจำของคอนเทนท์และผลลัพธ์</p></div>
          </aside>
        </section>

        <section className="review-section" id="review">
          <div className="section-heading"><div><p className="kicker">2. ตัดสินใจ</p><h2>รายการที่ต้องให้คนเลือก</h2><p className="section-sub">อ่านเหตุผลและกดปุ่มด้านล่างเมื่อพร้อมส่งต่อ</p></div><span className="count-badge">{reviewCount} รอตรวจ</span></div>
          <div className="idea-list">
            {ideas.map((idea) => <article className="idea-card" key={idea.id}>
              <div className="idea-card-main">
                <div className="idea-meta"><span className={`status status-${idea.status.toLowerCase().replace(" ", "-")}`}>{idea.status === "Needs review" ? "รอตัดสินใจ" : idea.status === "Confirmed" ? "ยืนยันแล้ว" : "เข้าคิวแล้ว"}</span><span>{idea.id}</span><span>ลง {formatThaiDate(idea.scheduledFor)}</span></div>
                <h3>{idea.title}</h3>
                <div className="tag-row"><span>{idea.client}</span><span>{idea.program}</span><span>{idea.concern}</span><span>{idea.format}</span><span>{patternLabel(idea.pattern)}</span></div>
                <p className="hook">“{idea.hook}”</p><p className="rationale">{idea.rationale}</p>
              </div>
              <div className="idea-card-action">
                {idea.status === "Queued" ? <><span className="queue-label">พร้อมส่งเข้า Monday</span><small>วันที่ลง: {formatThaiDate(idea.scheduledFor)}</small></> : <>
                  <small>ตรวจโดย {role}</small><button className="button button-primary" onClick={() => confirmIdea(idea.id)} type="button">{idea.status === "Confirmed" ? "เข้าคิว Monday" : "ยืนยันไอเดีย"} <span>→</span></button>
                </>}
              </div>
            </article>)}
          </div>
        </section>

        <section className="bottom-grid">
          <section className="card mapping-card"><div className="section-heading"><div><p className="kicker">ต้องกำหนดกฎ</p><h2>ระบบพบข้อมูลที่ไม่แน่ใจ</h2></div><span className="count-badge warn">2 รายการ</span></div>
            <div className="mapping-row"><div><strong>NV โปรสาขาสกล</strong><p>ยังไม่มี Client และรูปแบบในข้อมูลที่ import</p></div><button className="button button-secondary" onClick={() => setNotice("เปิดหน้าตั้งกฎสำหรับ NV โปรสาขาสกล") } type="button">จัดกลุ่ม</button></div>
            <div className="mapping-row"><div><strong>all / 6,666</strong><p>ควรบันทึกเป็น Package / Offer ไม่ใช่ Program</p></div><button className="button button-secondary" onClick={() => setNotice("เปิดหน้าสร้าง Package / Offer mapping") } type="button">เพิ่มกฎ</button></div>
          </section>
          <aside className="card taxonomy-card"><p className="kicker">กฎที่ใช้อยู่</p><h2>Taxonomy ของ Marktech</h2><dl><div><dt>Service Group</dt><dd>Injectable → Botox, Filler</dd></div><div><dt>Concern เริ่มต้น</dt><dd>ริ้วรอย → Botox</dd></div><div><dt>Package</dt><dd>all → รอตั้งกฎให้ชัด</dd></div></dl></aside>
        </section>
      </div>
    </main>
  );
}
