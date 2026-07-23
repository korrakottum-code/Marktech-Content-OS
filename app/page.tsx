"use client";

import { useMemo, useState } from "react";

type IdeaStatus = "Needs review" | "Confirmed" | "Queued";

type ContentIdea = {
  id: string;
  client: string;
  title: string;
  program: string;
  concern: string;
  format: string;
  pillar: string;
  hook: string;
  rationale: string;
  scheduledFor: string;
  status: IdeaStatus;
  pattern: "New angle" | "Copy-to-adapt" | "Retest";
};

const mondayItems = [
  {
    client: "NV",
    name: "NV JUL19 / therafill 1cc 15,900.-",
    format: "ภาพ",
    stage: "Client approving",
    date: "31 Jul",
  },
  {
    client: "Root Privé",
    name: "Root JUL11 / Volnewmer 100 Shot",
    format: "วิดีโอ",
    stage: "Waiting for material",
    date: "30 Jul",
  },
  {
    client: "Fill-D",
    name: "Fill-D JUL11 / ร้อยไหม เคสรีวิว",
    format: "วิดีโอ",
    stage: "Waiting for material",
    date: "27 Jul",
  },
];

const initialIdeas: ContentIdea[] = [
  {
    id: "CNT-NV-2607-021",
    client: "NV",
    title: "3 จุดที่ทำให้หน้าดูเหนื่อย ทั้งที่นอนพอ",
    program: "Botox",
    concern: "ริ้วรอย",
    format: "วิดีโอ",
    pillar: "Concern education",
    hook: "หน้าดูเหนื่อย ไม่ได้แปลว่าแก่",
    rationale:
      "ใช้ Pain Point ริ้วรอยในภาษาชีวิตประจำวัน แล้วพาเข้าสู่ Botox แบบไม่ขายตรงเกินไป",
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
    pillar: "Decision guide",
    hook: "ไม่ใช่ทุกความหย่อน ต้องใช้เครื่องเดียวกัน",
    rationale:
      "เปลี่ยนจาก Offer-led เป็น Decision-led เพื่อช่วยให้แอดมินใช้เป็นบทสนทนาต่อได้",
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
    pillar: "Social proof",
    hook: "คนที่กลัวเข็มที่สุด ยังตัดสินใจทำได้อย่างไร",
    rationale:
      "ต่อยอดจากวิดีโอรีวิวที่กำลังรอ Material และวาง CTA เพื่อให้แอดมินรับช่วงปิดนัด",
    scheduledFor: "2026-07-30",
    status: "Confirmed",
    pattern: "Retest",
  },
];

const navItems = [
  ["⌂", "Command Center"],
  ["✦", "Idea Studio"],
  ["▦", "Content Memory"],
  ["↗", "Monday Sync"],
  ["!", "Mapping Queue"],
];

function statusClass(status: IdeaStatus) {
  if (status === "Confirmed") return "status status-confirmed";
  if (status === "Queued") return "status status-queued";
  return "status status-review";
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("Command Center");
  const [ideas, setIdeas] = useState(initialIdeas);
  const [client, setClient] = useState("NV");
  const [program, setProgram] = useState("Botox");
  const [format, setFormat] = useState("วิดีโอ");
  const [scheduledFor, setScheduledFor] = useState("2026-07-31");
  const [role, setRole] = useState<"Planner" | "PM">("Planner");
  const [notice, setNotice] = useState(
    "Prototype mode — Monday ยังเป็น read-only จนกว่าจะตั้ง Secret สำหรับ Push",
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
      pillar: "Decision guide",
      hook: "ตัดสินใจจากปัญหาจริง ไม่ใช่จากโปรอย่างเดียว",
      rationale:
        "Draft นี้ตั้งใจสร้างเป็นข้อมูลช่วยตัดสินใจ เพื่อให้แอดมินต่อบทสนทนาและพาไปสู่การนัดได้ง่ายขึ้น",
      scheduledFor,
      status: "Needs review",
      pattern: "New angle",
    };
    setIdeas((current) => [nextIdea, ...current]);
    setNotice(`สร้าง Draft ใหม่สำหรับ ${client} แล้ว — ตรวจและ Confirm ก่อนส่ง Monday`);
  }

  function confirmIdea(id: string) {
    const selectedIdea = ideas.find((idea) => idea.id === id);
    if (!selectedIdea?.scheduledFor) {
      setNotice("ต้องระบุวันที่ลงก่อนส่งรายการเข้า Monday Push Queue");
      return;
    }
    setIdeas((current) =>
      current.map((idea) =>
        idea.id === id ? { ...idea, status: "Queued" } : idea,
      ),
    );
    setNotice(
      `${role} ย้ายเข้า Push Queue แล้ว — เมื่อเชื่อม Monday Secret ระบบจะสร้าง Task ตาม Board Mapping ที่ตั้งไว้`,
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span>
            <strong>marktech</strong>
            <small>CONTENT OS</small>
          </span>
        </div>

        <nav aria-label="Primary navigation">
          {navItems.map(([icon, label]) => (
            <button
              className={activeNav === label ? "nav-item active" : "nav-item"}
              key={label}
              onClick={() => setActiveNav(label)}
              type="button"
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="eyebrow">MONDAY CONNECTION</span>
          <strong>Read-only import ready</strong>
          <p>Push จะเปิดเมื่อใส่ Monday API Secret และเลือก Board Mapping</p>
          <div className="connection-row">
            <i /> Connector audited
          </div>
        </div>

        <div className="user-card">
          <span className="avatar">KS</span>
          <span>
            <strong>Korrakot</strong>
            <small>Workspace admin</small>
          </span>
          <button aria-label="Settings" type="button">
            ⋯
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeNav}</p>
            <h1>Content that learns what sells.</h1>
          </div>
          <div className="topbar-actions">
            <label className="role-select">
              <span>Role</span>
              <select onChange={(event) => setRole(event.target.value as "Planner" | "PM")} value={role}>
                <option>Planner</option>
                <option>PM</option>
              </select>
            </label>
            <button className="ghost-button" type="button">
              <span className="dot" /> Last audit: 23 Jul
            </button>
            <button className="primary-button" onClick={generateDraft} type="button">
              <span>＋</span> Generate draft
            </button>
          </div>
        </header>

        <div className="notice" role="status">
          <span>✦</span>
          {notice}
        </div>

        <section className="metrics" aria-label="Operational overview">
          <article>
            <span className="metric-label">Content clients in Monday</span>
            <strong>8 + Ads-only</strong>
            <small>Content production and Ads-only clients in one view</small>
          </article>
          <article>
            <span className="metric-label">Ideas needing human review</span>
            <strong>{ideas.filter((idea) => idea.status === "Needs review").length}</strong>
            <small>AI suggests; people decide</small>
          </article>
          <article>
            <span className="metric-label">Ready for Monday push</span>
            <strong>{queueCount}</strong>
            <small>Never creates a task without confirmation</small>
          </article>
          <article className="metric-alert">
            <span className="metric-label">Mapping issues</span>
            <strong>2</strong>
            <small>Need a human rule before attribution</small>
          </article>
        </section>

        <section className="flow-card">
          <div>
            <p className="eyebrow">THE OPERATING LOOP</p>
            <h2>Plan once. Reuse what works. Keep the human gate.</h2>
          </div>
          <div className="flow-track" aria-label="Workflow">
            <span>Monday import</span>
            <b>→</b>
            <span>Content memory</span>
            <b>→</b>
            <span>Idea review</span>
            <b>→</b>
            <span className="flow-final">Confirm &amp; create task</span>
          </div>
        </section>

        <div className="main-grid">
          <section className="panel idea-studio">
            <div className="panel-header">
              <div>
                <p className="eyebrow">IDEA STUDIO</p>
                <h2>Compose the next test</h2>
              </div>
              <span className="pill">No historical backfill</span>
            </div>

            <div className="composer-grid">
              <label>
                Client
                <select onChange={(event) => setClient(event.target.value)} value={client}>
                  <option>NV</option>
                  <option>Root Privé</option>
                  <option>Fill-D</option>
                  <option>Be Bright</option>
                  <option>A&amp;B Clinic</option>
                  <option>Sherlyn</option>
                  <option>Facial Studio</option>
                  <option>Luxe Aesthetics</option>
                  <option>Essoul (Ads-only)</option>
                  <option>Meseoul (Ads-only)</option>
                  <option>De&apos;Vana (Ads-only)</option>
                  <option>Boseong (Ads-only)</option>
                  <option>2Praw (Ads-only)</option>
                  <option>The Phat (Ads-only)</option>
                </select>
              </label>
              <label>
                Program
                <select onChange={(event) => setProgram(event.target.value)} value={program}>
                  <option>Botox</option>
                  <option>Filler</option>
                  <option>HIFU</option>
                  <option>Ultraformer</option>
                  <option>Pico</option>
                  <option>Package / Offer</option>
                </select>
              </label>
              <label>
                Format
                <select onChange={(event) => setFormat(event.target.value)} value={format}>
                  <option>วิดีโอ</option>
                  <option>ภาพ</option>
                  <option>อัลบั้ม</option>
                </select>
              </label>
              <label>
                วันที่ลง <em>*</em>
                <input
                  min="2026-07-23"
                  onChange={(event) => setScheduledFor(event.target.value)}
                  type="date"
                  value={scheduledFor}
                />
              </label>
            </div>

            <div className="strategy-row">
              <button className="strategy active" type="button">
                <span>↗</span>
                <strong>Copy-to-adapt</strong>
                <small>Reuse a winning pattern for a new program or audience</small>
              </button>
              <button className="strategy" type="button">
                <span>◌</span>
                <strong>New angle</strong>
                <small>Explore a new hook without duplicating an old idea</small>
              </button>
              <button className="strategy" type="button">
                <span>↻</span>
                <strong>Retest</strong>
                <small>Bring back a proven concept with a new execution</small>
              </button>
            </div>

            <button className="full-button" onClick={generateDraft} type="button">
              Generate reviewable draft <span>→</span>
            </button>
          </section>

          <section className="panel monday-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">MONDAY IMPORT</p>
                <h2>What the production team is seeing</h2>
              </div>
              <button className="text-button" type="button">
                Sync settings
              </button>
            </div>
            <div className="monday-list">
              {mondayItems.map((item) => (
                <article className="monday-item" key={item.name}>
                  <span className="client-badge">{item.client.slice(0, 2)}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.format} · {item.stage}</small>
                  </div>
                  <time>{item.date}</time>
                </article>
              ))}
            </div>
            <div className="import-note">
              <span>✓</span>
              Monday stays the production workspace. This app stores the memory,
              taxonomy and mapping around it.
            </div>
          </section>
        </div>

        <section className="panel idea-library">
          <div className="panel-header">
            <div>
              <p className="eyebrow">REVIEW QUEUE</p>
              <h2>Ideas that are safe to judge, adapt or send forward</h2>
            </div>
            <div className="legend">
              <span><i className="legend-dot mint" /> Confirmed</span>
              <span><i className="legend-dot amber" /> Needs review</span>
              <span><i className="legend-dot blue" /> Queued</span>
            </div>
          </div>

          <div className="ideas">
            {ideas.map((idea) => (
              <article className="idea-card" key={idea.id}>
                <div className="idea-card-head">
                  <span className="content-id">{idea.id}</span>
                  <span className={statusClass(idea.status)}>{idea.status}</span>
                </div>
                <h3>{idea.title}</h3>
                <div className="tags">
                  <span>{idea.client}</span>
                  <span>{idea.program}</span>
                  <span>{idea.concern}</span>
                  <span>{idea.format}</span>
                </div>
                <p className="idea-hook">“{idea.hook}”</p>
                <p className="idea-rationale">{idea.rationale}</p>
                <p className="planned-date">
                  ลงวันที่ {new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(new Date(`${idea.scheduledFor}T00:00:00`))}
                </p>
                <footer>
                  <span className="pattern">{idea.pattern}</span>
                  {idea.status === "Needs review" ? (
                    <button onClick={() => confirmIdea(idea.id)} type="button">
                      Confirm → Queue
                    </button>
                  ) : idea.status === "Confirmed" ? (
                    <button onClick={() => confirmIdea(idea.id)} type="button">
                      Queue for Monday
                    </button>
                  ) : (
                    <span className="queued-label">Ready for secure push</span>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </section>

        <section className="mapping-grid">
          <article className="panel mapping-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">MAPPING QUEUE</p>
                <h2>Never guess when the system does not know.</h2>
              </div>
              <span className="mapping-count">2 open</span>
            </div>
            <div className="mapping-row">
              <span className="warning-icon">!</span>
              <div>
                <strong>NV โปรสาขาสกล</strong>
                <small>Missing client and format in the imported task</small>
              </div>
              <button type="button">Map now</button>
            </div>
            <div className="mapping-row">
              <span className="warning-icon">!</span>
              <div>
                <strong>all / 6,666</strong>
                <small>Needs a Package/Offer mapping; do not classify as Program</small>
              </div>
              <button type="button">Add package</button>
            </div>
          </article>

          <article className="panel rules-panel">
            <p className="eyebrow">DEFAULT RULES</p>
            <h2>Marktech taxonomy is ready to learn.</h2>
            <dl>
              <div><dt>Service Group</dt><dd>Injectable → Botox, Filler</dd></div>
              <div><dt>Default Concern Rule</dt><dd>ริ้วรอย → Botox</dd></div>
              <div><dt>Bundle Rule</dt><dd>all → Package / Needs review</dd></div>
            </dl>
          </article>
        </section>
      </section>
    </main>
  );
}
