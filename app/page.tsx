"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PptxGenJS from "pptxgenjs";
import { balancedDates } from "@/lib/planning.js";

type Format = "วิดีโอ" | "ภาพ" | "อัลบั้ม";
type PlanningGoal = "sales" | "trust" | "balanced" | "trend";
type ProductBrief = { id: string; product: string; goal: string; painFocus: string; customNeed: string; price: string; priceUnit: string };
type Idea = {
  id: string;
  product: string;
  title: string;
  hook: string;
  reason: string;
  adminAngle: string;
  format: Format;
  pillar: string;
  category: "โปรโมชั่น / Offer" | "รีวิว / Proof" | "ความรู้ / FAQ" | "แบรนด์ / ไลฟ์สไตล์";
  mechanism?: string;
  funnel?: string;
  angle?: string;
  priceLabel?: string;
  visualDirection: string;
  adaptation: string;
  selected: boolean;
  date?: string;
};
type Slide = { id: string; kind: "cover" | "summary" | "strategy" | "content" | "custom"; title: string; body: string; ideaId?: string; category?: Idea["category"]; product?: string; visualDirection?: string; postHeadline?: string; postOffer?: string; postCta?: string; image?: string; referenceImage?: string; referenceName?: string; referenceStatus?: string; imageError?: string; imageLoading?: boolean };
type ExistingWork = { date: string; format: Format; title: string };
type BoardGroup = { label: string; id: string };
type BoardOption = { id: string; name: string; groups: BoardGroup[] };
type PlanStatus = "draft" | "approved" | "sent_to_monday" | "completed";
type SavedPlan = { id: string; title: string; client: string; planMonth: string; status: PlanStatus; updatedAt: string };
type DraftPayload = {
  planName: string; client: string; serviceScope: "content" | "ads_only"; industry: string; reusePolicy: "avoid" | "adapt";
  requestedCategories: Idea["category"][]; planMonth: string; theme: string; planningGoal: PlanningGoal; freshContext: string; brandMood: string; brandReferenceImage: string | null;
  brandReferenceName: string; brandReferenceStatus: string; quantity: number; briefs: ProductBrief[]; oneCommand: string; briefSummary: string; advancedBriefOpen: boolean; ideas: Idea[]; slides: Slide[];
  step: number; groupId: string; boardId: string; boards: BoardOption[]; planStatus: PlanStatus;
};
type EditableIdeaField = "product" | "title" | "hook" | "priceLabel" | "reason" | "pillar" | "visualDirection" | "adaptation";
type ParsedBrief = {
  planName?: string; client?: string; industry?: string; theme?: string; planningGoal?: PlanningGoal; freshContext?: string;
  quantity?: number; requestedCategories?: Idea["category"][]; briefs?: Omit<ProductBrief, "id">[]; summary?: string;
};

function suggestionCount(quantity: number) {
  return Math.min(36, Math.max(1, quantity));
}

const contentClients = ["NV", "Root Privé", "Fill-D", "Be Bright", "A&B Clinic", "Sherlyn", "Facial Studio", "Luxe Aesthetics"];
const clientOptions = [...contentClients, "Essoul (Ads-only)", "Meseoul (Ads-only)", "De'Vana (Ads-only)", "Boseong (Ads-only)"];
const productOptions = ["Botox", "Filler", "HIFU", "Ultraformer", "Pico", "ร้อยไหม", "วิตามิน", "Package / Offer", "ไม่ระบุโปรดักต์"];
const categoryChoices: Idea["category"][] = ["โปรโมชั่น / Offer", "รีวิว / Proof", "ความรู้ / FAQ", "แบรนด์ / ไลฟ์สไตล์"];
const groupOptions: BoardGroup[] = [
  { label: "New Brief", id: "new_group29179" },
  { label: "Creative /พี่โฮม", id: "new_group__1" },
  { label: "Creative /เอิน", id: "group_mm0em08x" },
  { label: "Team Approving", id: "new_group92743__1" },
  { label: "Client Approving", id: "new_group38334__1" },
  { label: "Post", id: "new_group48537__1" },
];
const initialBoards: BoardOption[] = [{ id: "5029244984", name: "Marktech : Content (Jul 2026)", groups: groupOptions }];

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

function adVariant(category?: Idea["category"]) {
  if (category === "โปรโมชั่น / Offer") return "offer";
  if (category === "รีวิว / Proof") return "proof";
  if (category === "ความรู้ / FAQ") return "education";
  return "brand";
}

function fitSlideTextarea(element: HTMLTextAreaElement) {
  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
}

function buildSlides(client: string, month: string, theme: string, ideas: Idea[]) {
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(localDateFromIso(`${month}-01`));
  const categories = ideas.reduce<Record<string, number>>((summary, idea) => ({ ...summary, [idea.category]: (summary[idea.category] ?? 0) + 1 }), {});
  const summary = Object.entries(categories).map(([category, count]) => `${category} ${count} ชิ้น`).join(" · ");
  return [
    { id: "slide-cover", kind: "cover" as const, title: `Content Plan · ${client}`, body: `${monthLabel}\nคอนเซ็ปต์ประจำเดือน: ${theme || "สร้างบทสนทนาที่มีโอกาสนัด"}` },
    { id: "slide-summary", kind: "summary" as const, title: `สรุปแผน ${ideas.length} คอนเทนท์`, body: `สัดส่วน: ${summary}\n\n${ideas.map((idea, index) => `${String(index + 1).padStart(2, "0")}. ${idea.category} · ${idea.product} · ${idea.title}\n   เนื้อหา: ${idea.hook}`).join("\n")}` },
    { id: "slide-strategy", kind: "strategy" as const, title: "แนวคิดและบทบาทของแผน", body: "ครึ่งหนึ่งของแผนเน้นข้อเสนอที่ตัดสินใจได้จริง อีกครึ่งใช้รีวิว ความรู้ และภาพลักษณ์เพื่อช่วยปิดข้อกังวลก่อนทักแชต\n\nทุกชิ้นมี Hook, เหตุผล, CTA และตัวอย่างภาพโพสต์ Facebook ที่ทีมผลิตนำไปต่อได้" },
    ...ideas.map((idea, index) => ({
      id: `slide-${idea.id}`,
      kind: "content" as const,
      ideaId: idea.id,
      category: idea.category,
      product: idea.product,
      visualDirection: idea.visualDirection,
      title: `${String(index + 1).padStart(2, "0")} · ${idea.title}`,
      body: `ประเภท: ${idea.category} · รูปแบบ: ${idea.format}\nมุมเล่า: ${idea.pillar}\n\nHook\n${idea.hook}\n\nเหตุผลที่ควรทำ\n${idea.reason}\n\nVisual direction\n${idea.visualDirection}`,
      postHeadline: idea.title,
      postOffer: idea.category === "โปรโมชั่น / Offer" ? (idea.priceLabel || idea.hook) : idea.product,
      postCta: "ทักแชตเพื่อรับรายละเอียด",
    })),
  ];
}

export default function Home() {
  const [planName, setPlanName] = useState("");
  const [client, setClient] = useState("NV");
  const [serviceScope, setServiceScope] = useState<"content" | "ads_only">("content");
  const [industry, setIndustry] = useState("คลินิกความงาม");
  const [reusePolicy, setReusePolicy] = useState<"avoid" | "adapt">("adapt");
  const [requestedCategories, setRequestedCategories] = useState<Idea["category"][]>([]);
  const [planMonth, setPlanMonth] = useState(monthNow);
  const [theme, setTheme] = useState("เพิ่มบทสนทนาที่มีโอกาสนัด และมีคอนเทนท์ที่ใช้ยิงแอดต่อได้");
  const [planningGoal, setPlanningGoal] = useState<PlanningGoal>("sales");
  const [freshContext, setFreshContext] = useState("");
  const [brandMood, setBrandMood] = useState("");
  const [brandReferenceImage, setBrandReferenceImage] = useState<string | null>(null);
  const [brandReferenceName, setBrandReferenceName] = useState("");
  const [brandReferenceStatus, setBrandReferenceStatus] = useState("");
  const [quantity, setQuantity] = useState(12);
  const [briefs, setBriefs] = useState<ProductBrief[]>([{ id: "brief-1", product: "", goal: "", painFocus: "", customNeed: "", price: "", priceUnit: "" }]);
  const [oneCommand, setOneCommand] = useState("");
  const [briefSummary, setBriefSummary] = useState("");
  const [advancedBriefOpen, setAdvancedBriefOpen] = useState(false);
  const [isReadingBrief, setIsReadingBrief] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [step, setStep] = useState(1);
  const [groupId, setGroupId] = useState(groupOptions[0].id);
  const [boards, setBoards] = useState<BoardOption[]>(initialBoards);
  const [boardId, setBoardId] = useState(initialBoards[0].id);
  const [showBoardForm, setShowBoardForm] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardId, setNewBoardId] = useState("");
  const [newBoardGroupName, setNewBoardGroupName] = useState("");
  const [newBoardGroupId, setNewBoardGroupId] = useState("");
  const [ideaFormatFilter, setIdeaFormatFilter] = useState("ทั้งหมด");
  const [ideaProductFilter, setIdeaProductFilter] = useState("ทั้งหมด");
  const [ideaPillarFilter, setIdeaPillarFilter] = useState("ทั้งหมด");
  const [ideaCategoryFilter, setIdeaCategoryFilter] = useState("ทั้งหมด");
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [additionalIdeaCount, setAdditionalIdeaCount] = useState(3);
  const [additionalBriefId, setAdditionalBriefId] = useState("all");
  const [additionalCustomProduct, setAdditionalCustomProduct] = useState("");
  const [additionalDirection, setAdditionalDirection] = useState("");
  const [manualIdeaProduct, setManualIdeaProduct] = useState("ไม่ระบุโปรดักต์");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState("ตั้งเดือน เป้าหมาย และหัวข้อที่อยากสื่อ แล้วให้ AI แตกหลายทางเลือกในครั้งเดียว");
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus>("draft");
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showNewPlanConfirm, setShowNewPlanConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const lastSavedSnapshot = useRef("");
  const saveSequence = useRef(0);
  const adsOnly = serviceScope === "ads_only";

  const selectedIdeas = useMemo(() => ideas.filter((idea) => idea.selected), [ideas]);
  const scheduledIdeas = useMemo(() => selectedIdeas.filter((idea) => idea.date), [selectedIdeas]);
  const activeBoard = boards.find((board) => board.id === boardId) ?? boards[0];
  const activeGroup = activeBoard.groups.find((group) => group.id === groupId) ?? activeBoard.groups[0];
  const monthDates = useMemo(() => daysInMonth(planMonth), [planMonth]);
  const monthExisting = useMemo(() => existingWork.filter((work) => work.date.startsWith(planMonth)), [planMonth]);
  const visibleIdeas = useMemo(() => ideas.filter((idea) => (ideaFormatFilter === "ทั้งหมด" || idea.format === ideaFormatFilter) && (ideaProductFilter === "ทั้งหมด" || idea.product === ideaProductFilter) && (ideaPillarFilter === "ทั้งหมด" || idea.pillar === ideaPillarFilter) && (ideaCategoryFilter === "ทั้งหมด" || idea.category === ideaCategoryFilter)), [ideas, ideaFormatFilter, ideaProductFilter, ideaPillarFilter, ideaCategoryFilter]);
  const ideaProducts = useMemo(() => Array.from(new Set(ideas.map((idea) => idea.product))), [ideas]);
  const ideaPillars = useMemo(() => Array.from(new Set(ideas.map((idea) => idea.pillar))), [ideas]);
  const ideaCategories = useMemo(() => Array.from(new Set(ideas.map((idea) => idea.category))), [ideas]);
  const ideaPoolSize = suggestionCount(quantity);
  const reviewedBriefs = useMemo(() => briefs.filter((brief) => brief.product || brief.goal || brief.painFocus), [briefs]);

  const draftPayload = useMemo<DraftPayload>(() => ({
    planName, client, serviceScope, industry, reusePolicy, requestedCategories, planMonth, theme, planningGoal, freshContext, brandMood,
    brandReferenceImage, brandReferenceName, brandReferenceStatus, quantity, briefs, oneCommand, briefSummary, advancedBriefOpen, ideas, slides, step,
    groupId, boardId, boards, planStatus,
  }), [planName, client, serviceScope, industry, reusePolicy, requestedCategories, planMonth, theme, planningGoal, freshContext, brandMood, brandReferenceImage, brandReferenceName, brandReferenceStatus, quantity, briefs, oneCommand, briefSummary, advancedBriefOpen, ideas, slides, step, groupId, boardId, boards, planStatus]);
  const draftSnapshot = useMemo(() => JSON.stringify(draftPayload), [draftPayload]);
  const hasPlanWork = ideas.length > 0 || slides.length > 0 || Boolean(activePlanId) || Boolean(planName.trim());
  const draftPlans = useMemo(() => savedPlans.filter((savedPlan) => savedPlan.status !== "completed"), [savedPlans]);
  const completedPlans = useMemo(() => savedPlans.filter((savedPlan) => savedPlan.status === "completed"), [savedPlans]);

  function setAddressablePlan(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("plan", id);
    else url.searchParams.delete("plan");
    window.history.replaceState({}, "", url);
  }

  function applyDraftPayload(payload: DraftPayload) {
    setPlanName(typeof payload.planName === "string" ? payload.planName : "");
    setClient(typeof payload.client === "string" ? payload.client : "NV");
    setServiceScope(payload.serviceScope === "ads_only" ? "ads_only" : "content");
    setIndustry(typeof payload.industry === "string" ? payload.industry : "คลินิกความงาม");
    setReusePolicy(payload.reusePolicy === "avoid" ? "avoid" : "adapt");
    setRequestedCategories(Array.isArray(payload.requestedCategories) ? payload.requestedCategories : []);
    setPlanMonth(typeof payload.planMonth === "string" ? payload.planMonth : monthNow());
    setTheme(typeof payload.theme === "string" ? payload.theme : "");
    setPlanningGoal(payload.planningGoal === "trust" || payload.planningGoal === "balanced" || payload.planningGoal === "trend" ? payload.planningGoal : "sales");
    setFreshContext(typeof payload.freshContext === "string" ? payload.freshContext : "");
    setBrandMood(typeof payload.brandMood === "string" ? payload.brandMood : "");
    setBrandReferenceImage(typeof payload.brandReferenceImage === "string" ? payload.brandReferenceImage : null);
    setBrandReferenceName(typeof payload.brandReferenceName === "string" ? payload.brandReferenceName : "");
    setBrandReferenceStatus(typeof payload.brandReferenceStatus === "string" ? payload.brandReferenceStatus : "");
    setQuantity(typeof payload.quantity === "number" ? payload.quantity : 12);
    setBriefs(Array.isArray(payload.briefs) && payload.briefs.length ? payload.briefs.map((brief) => ({ ...brief, painFocus: typeof brief.painFocus === "string" ? brief.painFocus : "" })) : [{ id: "brief-1", product: "", goal: "", painFocus: "", customNeed: "", price: "", priceUnit: "" }]);
    setOneCommand(typeof payload.oneCommand === "string" ? payload.oneCommand : "");
    setBriefSummary(typeof payload.briefSummary === "string" ? payload.briefSummary : "");
    setAdvancedBriefOpen(Boolean(payload.advancedBriefOpen));
    setIdeas(Array.isArray(payload.ideas) ? payload.ideas : []);
    setSlides(Array.isArray(payload.slides) ? payload.slides : []);
    setStep(typeof payload.step === "number" ? payload.step : 1);
    setPlanStatus(payload.planStatus === "completed" || payload.planStatus === "sent_to_monday" || payload.planStatus === "approved" ? payload.planStatus : "draft");
    const usableBoards = Array.isArray(payload.boards) && payload.boards.length ? payload.boards : initialBoards;
    setBoards(usableBoards);
    setBoardId(typeof payload.boardId === "string" ? payload.boardId : usableBoards[0].id);
    setGroupId(typeof payload.groupId === "string" ? payload.groupId : usableBoards[0].groups[0]?.id ?? groupOptions[0].id);
  }

  async function refreshSavedPlans() {
    const response = await fetch("/api/plans");
    const data = await response.json().catch(() => null) as { plans?: SavedPlan[] } | null;
    if (response.ok && data?.plans) setSavedPlans(data.plans);
  }

  async function loadPlan(id: string) {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/plans?id=${encodeURIComponent(id)}`);
      const data = await response.json().catch(() => null) as { plan?: SavedPlan & { payload?: DraftPayload; updatedAt?: string }; error?: string } | null;
      if (!response.ok || !data?.plan?.payload) throw new Error(data?.error ?? "เปิดร่างแผนไม่สำเร็จ");
      applyDraftPayload(data.plan.payload);
      setActivePlanId(data.plan.id);
      setPlanStatus(data.plan.status === "completed" || data.plan.status === "sent_to_monday" || data.plan.status === "approved" ? data.plan.status : "draft");
      setAddressablePlan(data.plan.id);
      lastSavedSnapshot.current = JSON.stringify(data.plan.payload);
      setLastSavedAt(data.plan.updatedAt ?? "");
      setSaveState("saved");
      setShowDrafts(false);
      setNotice(`เปิดร่าง “${data.plan.title}” แล้ว — แก้ต่อได้ทันที และระบบจะบันทึกให้อัตโนมัติ`);
    } catch (error) {
      setSaveState("error");
      setNotice(error instanceof Error ? error.message : "เปิดร่างแผนไม่สำเร็จ");
    } finally {
      setDraftReady(true);
    }
  }

  async function saveDraft(mode: "auto" | "manual" = "auto", nextStatus: PlanStatus = planStatus) {
    if (!hasPlanWork && mode === "auto") return false;
    const snapshot = JSON.stringify({ ...draftPayload, planName: planName.trim(), planStatus: nextStatus });
    if (mode === "auto" && snapshot === lastSavedSnapshot.current) return true;
    const sequence = ++saveSequence.current;
    setSaveState("saving");
    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activePlanId ?? undefined, status: nextStatus, payload: JSON.parse(snapshot) }),
      });
      const data = await response.json().catch(() => null) as { plan?: SavedPlan & { payload?: DraftPayload; updatedAt?: string }; error?: string } | null;
      if (!response.ok || !data?.plan) throw new Error(data?.error ?? "บันทึกร่างแผนไม่สำเร็จ");
      setActivePlanId(data.plan.id);
      setPlanStatus(nextStatus);
      setAddressablePlan(data.plan.id);
      lastSavedSnapshot.current = snapshot;
      setLastSavedAt(data.plan.updatedAt ?? new Date().toISOString());
      if (data.plan.payload) {
        const stored = data.plan.payload;
        if (typeof stored.brandReferenceImage === "string" && brandReferenceImage?.startsWith("data:image")) setBrandReferenceImage(stored.brandReferenceImage);
        if (Array.isArray(stored.slides)) {
          setSlides((current) => current.map((slide, index) => {
            const persisted = stored.slides?.[index];
            if (!persisted) return slide;
            return {
              ...slide,
              image: slide.image?.startsWith("data:image") && typeof persisted.image === "string" ? persisted.image : slide.image,
              referenceImage: slide.referenceImage?.startsWith("data:image") && typeof persisted.referenceImage === "string" ? persisted.referenceImage : slide.referenceImage,
            };
          }));
        }
      }
      if (sequence === saveSequence.current) setSaveState("saved");
      void refreshSavedPlans();
      return true;
    } catch (error) {
      if (sequence === saveSequence.current) setSaveState("error");
      if (mode === "manual") setNotice(error instanceof Error ? error.message : "บันทึกร่างแผนไม่สำเร็จ");
      return false;
    }
  }

  async function deletePlan(id: string) {
    try {
      const response = await fetch(`/api/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("ลบร่างแผนไม่สำเร็จ");
      if (activePlanId === id) {
        setActivePlanId(null);
        setAddressablePlan(null);
        lastSavedSnapshot.current = "";
      }
      await refreshSavedPlans();
      setNotice("ลบร่างแผนแล้ว");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ลบร่างแผนไม่สำเร็จ");
    }
  }

  function resetPlan() {
    setPlanName("");
    setClient("NV");
    setServiceScope("content");
    setIndustry("คลินิกความงาม");
    setReusePolicy("adapt");
    setRequestedCategories([]);
    setPlanMonth(monthNow());
    setTheme("เพิ่มบทสนทนาที่มีโอกาสนัด และมีคอนเทนท์ที่ใช้ยิงแอดต่อได้");
    setPlanningGoal("sales");
    setFreshContext("");
    setBrandMood("");
    setBrandReferenceImage(null);
    setBrandReferenceName("");
    setBrandReferenceStatus("");
    setQuantity(12);
    setBriefs([{ id: "brief-1", product: "", goal: "", painFocus: "", customNeed: "", price: "", priceUnit: "" }]);
    setOneCommand("");
    setBriefSummary("");
    setAdvancedBriefOpen(false);
    setIdeas([]);
    setSlides([]);
    setStep(1);
    setActivePlanId(null);
    setPlanStatus("draft");
    setAddressablePlan(null);
    lastSavedSnapshot.current = "";
    setLastSavedAt("");
    setSaveState("idle");
    setShowNewPlanConfirm(false);
    setShowCompleteConfirm(false);
    setNotice("เริ่มแผนใหม่แล้ว — ร่างเดิมยังอยู่ในรายการงานร่าง");
    scrollToId("brief");
  }

  useEffect(() => {
    fetch("/api/monday/boards")
      .then((response) => response.ok ? response.json() : { boards: [] })
      .then((payload: { boards?: BoardOption[] }) => {
        if (!payload.boards?.length) return;
        setBoards((current) => {
          const byId = new Map(current.map((board) => [board.id, board]));
          payload.boards?.forEach((board) => {
            const known = byId.get(board.id);
            if (!known) return byId.set(board.id, board);
            const groups = new Map(known.groups.map((group) => [group.id, group]));
            board.groups.forEach((group) => groups.set(group.id, group));
            byId.set(board.id, { ...known, name: board.name || known.name, groups: Array.from(groups.values()) });
          });
          return Array.from(byId.values());
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("plan");
    void refreshSavedPlans();
    if (id) void loadPlan(id);
    else setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady || !hasPlanWork || draftSnapshot === lastSavedSnapshot.current) return;
    const timer = window.setTimeout(() => { void saveDraft(); }, 1200);
    return () => window.clearTimeout(timer);
  }, [draftReady, hasPlanWork, draftSnapshot]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLTextAreaElement>(".proposal-slide .slide-title, .proposal-slide .slide-body").forEach(fitSlideTextarea);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [slides]);

  function updateBrief(id: string, field: keyof Omit<ProductBrief, "id">, value: string) {
    setBriefs((current) => current.map((brief) => brief.id === id ? { ...brief, [field]: value } : brief));
  }

  function addBrief() {
    setBriefs((current) => [...current, { id: `brief-${Date.now()}`, product: "ไม่ระบุโปรดักต์", goal: "", painFocus: "", customNeed: "", price: "", priceUnit: "" }]);
  }

  function removeBrief(id: string) {
    setBriefs((current) => current.length === 1 ? current : current.filter((brief) => brief.id !== id));
  }

  async function readOneCommand() {
    if (!oneCommand.trim()) return setNotice("พิมพ์โจทย์ที่อยากให้ AI ทำก่อน เช่น โปรดักต์ โปรจริง คนที่อยากคุยด้วย และปัญหาที่อยากขยี้");
    setIsReadingBrief(true);
    setNotice("AI กำลังอ่านโจทย์และแยกเป็นแผนให้…");
    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: oneCommand, client, planMonth, quantity, industry }),
      });
      const payload = await response.json() as { brief?: ParsedBrief; error?: string; nextStep?: string };
      if (!response.ok || !payload.brief) throw new Error(payload.nextStep ?? payload.error ?? "AI ยังอ่านโจทย์ไม่ได้");
      const parsed = payload.brief;
      if (parsed.planName) setPlanName(parsed.planName);
      if (parsed.client) setClient(parsed.client);
      if (parsed.industry) setIndustry(parsed.industry);
      if (parsed.theme) setTheme(parsed.theme);
      if (parsed.planningGoal) setPlanningGoal(parsed.planningGoal);
      if (parsed.freshContext) setFreshContext(parsed.freshContext);
      if (typeof parsed.quantity === "number") setQuantity(Math.max(1, Math.min(36, parsed.quantity)));
      if (Array.isArray(parsed.requestedCategories)) setRequestedCategories(parsed.requestedCategories);
      if (Array.isArray(parsed.briefs) && parsed.briefs.length) {
        setBriefs(parsed.briefs.slice(0, 20).map((brief, index) => ({
          id: `brief-ai-${Date.now()}-${index + 1}`,
          product: String(brief.product ?? "ไม่ระบุโปรดักต์"), goal: String(brief.goal ?? ""), painFocus: String(brief.painFocus ?? ""),
          customNeed: String(brief.customNeed ?? ""), price: String(brief.price ?? ""), priceUnit: String(brief.priceUnit ?? ""),
        })));
      }
      setBriefSummary(String(parsed.summary ?? "AI แยกโปรดักต์ เป้าหมาย และจุดที่ต้องขยี้ให้แล้ว"));
      setAdvancedBriefOpen(false);
      setNotice("AI แยกโจทย์ให้แล้ว — กดสร้างไอเดียได้เลย หรือเปิดรายละเอียดเพื่อปรับเฉพาะจุด");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ยังเชื่อม AI ไม่สำเร็จ");
    } finally {
      setIsReadingBrief(false);
    }
  }

  async function generateIdeas() {
    const usableBriefs = briefs.filter((brief) => brief.product !== "ไม่ระบุโปรดักต์" || brief.goal || brief.painFocus || brief.customNeed);
    if (!usableBriefs.length) return setNotice("เพิ่มอย่างน้อย 1 โปรดักต์ หรือพิมพ์เรื่องที่อยากสื่อก่อนให้ AI คิด");
    if (requestedCategories.includes("โปรโมชั่น / Offer") && !usableBriefs.some((brief) => brief.price.trim() && brief.priceUnit.trim())) return setNotice("ถ้าเลือก โปรโมชั่น / Offer ต้องใส่ราคาและหน่วยของอย่างน้อย 1 โปรดักต์ก่อน");
    setIsGenerating(true);
    setNotice("AI กำลังแตกแนวคิดหลายมุมจากโจทย์เดือนนี้…");
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client, planMonth, theme, quantity, briefs: usableBriefs, industry, reusePolicy, categories: requestedCategories, planningGoal, freshContext }),
      });
      const payload = await response.json() as { ideas?: Omit<Idea, "selected" | "date">[]; error?: string; nextStep?: string };
      if (!response.ok || !payload.ideas) throw new Error(payload.nextStep ?? payload.error ?? "AI ยังสร้างไอเดียไม่ได้");
      const recommendedIds = new Set(payload.ideas.slice(0, quantity).map((idea) => idea.id));
      setIdeas(payload.ideas.map((idea, index) => ({ ...idea, id: idea.id || `IDEA-${String(index + 1).padStart(2, "0")}`, selected: recommendedIds.has(idea.id || `IDEA-${String(index + 1).padStart(2, "0")}`) })));
      setSlides([]);
      setStep(2);
      setNotice(`AI วางโครง 8 กลไกและสร้าง ${payload.ideas.length} ทางเลือกแล้ว — เลือก ${quantity} ชิ้นแรกไว้ให้ และคุณแก้หรือเพิ่มไอเดียเองได้ทุกชิ้น`);
      scrollToId("idea-selection");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ยังเชื่อม AI ไม่สำเร็จ");
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateMoreIdeas() {
    const usableBriefs = briefs.filter((brief) => brief.product !== "ไม่ระบุโปรดักต์" || brief.goal || brief.painFocus || brief.customNeed);
    if (!usableBriefs.length) return setNotice("เพิ่มอย่างน้อย 1 โปรดักต์ หรือพิมพ์เรื่องที่อยากสื่อก่อนให้ AI คิด");
    const count = Math.max(1, Math.min(20, additionalIdeaCount));
    const focusBrief = additionalBriefId === "custom"
      ? { product: additionalCustomProduct.trim(), goal: additionalDirection.trim(), painFocus: additionalDirection.trim(), customNeed: "", price: "", priceUnit: "" }
      : additionalBriefId === "all" ? undefined : briefs.find((brief) => brief.id === additionalBriefId);
    if (additionalBriefId === "custom" && !focusBrief?.product) return setNotice("พิมพ์ชื่อโปรดักต์หรือเรื่องที่อยากให้ AI เติมก่อน");
    setIsGenerating(true);
    setNotice(`AI กำลังเติมอีก ${count} ไอเดีย${focusBrief ? ` สำหรับ ${focusBrief.product}` : ""} โดยหลบมุมที่มีอยู่…`);
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client, planMonth, theme, quantity: count, briefs: usableBriefs, industry, reusePolicy, categories: requestedCategories, planningGoal, freshContext,
          mode: "additional",
          focusBrief,
          additionalDirection: additionalDirection.trim(),
          existingIdeas: ideas.map(({ title, hook, product, pillar, category, mechanism }) => ({ title, hook, product, pillar, category, mechanism })),
        }),
      });
      const payload = await response.json() as { ideas?: Omit<Idea, "selected" | "date">[]; error?: string; nextStep?: string };
      if (!response.ok || !payload.ideas) throw new Error(payload.nextStep ?? payload.error ?? "AI ยังสร้างไอเดียเพิ่มไม่ได้");
      const generated = payload.ideas.map((idea, index) => ({
        ...idea,
        id: `ADDED-${Date.now()}-${index + 1}`,
        selected: false,
      }));
      setIdeas((current) => [...current, ...generated]);
      setNotice(`เพิ่ม ${generated.length} ไอเดียแล้ว — ชุดเดิมยังอยู่ครบ และรอให้คุณเลือกเอง`);
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
    setIdeas((current) => {
      const chosen = new Set(current.slice(0, quantity).map((idea) => idea.id));
      return current.map((idea) => ({ ...idea, selected: chosen.has(idea.id) }));
    });
    setNotice(`เลือก ${quantity} ชิ้นแรกแล้ว — ปรับหรือเพิ่มจากชุดไอเดียได้เสมอ`);
  }

  function addManualIdea() {
    const number = ideas.length + 1;
    const id = `MANUAL-${String(number).padStart(2, "0")}`;
    const idea: Idea = {
      id,
      product: manualIdeaProduct,
      title: "หัวข้อคอนเทนท์ใหม่",
      hook: "เขียนประโยคเปิดที่อยากให้คนหยุดดู",
      reason: "อธิบายว่าชิ้นนี้ช่วยเป้าหมายของเดือนได้อย่างไร",
      adminAngle: "",
      format: "ภาพ",
      pillar: "กำหนดมุมเล่า",
      category: "ความรู้ / FAQ",
      visualDirection: "อธิบายภาพที่อยากให้คนเห็นในโพสต์ Facebook",
      adaptation: "ไอเดียที่ทีมเพิ่มเอง",
      selected: false,
    };
    setIdeas((current) => [...current, idea]);
    setStep(2);
    setEditingIdeaId(id);
    setNotice("เพิ่มไอเดียร่างแล้ว — เลือกโปรดักต์/เรื่อง แก้หัวข้อ Hook และรายละเอียดก่อนกดเลือกเข้าชุดแผน");
    scrollToId("idea-selection");
  }

  function removeIdea(id: string) {
    const removed = ideas.find((idea) => idea.id === id);
    setIdeas((current) => current.filter((idea) => idea.id !== id));
    setEditingIdeaId((current) => current === id ? null : current);
    setNotice(removed ? `ลบไอเดีย “${removed.title}” แล้ว` : "ลบไอเดียแล้ว");
  }

  function updateIdea(id: string, field: EditableIdeaField, value: string) {
    setIdeas((current) => current.map((idea) => idea.id === id ? { ...idea, [field]: value } : idea));
  }

  function updateIdeaFormat(id: string, format: Format) {
    setIdeas((current) => current.map((idea) => idea.id === id ? { ...idea, format } : idea));
  }

  function updateIdeaCategory(id: string, category: Idea["category"]) {
    setIdeas((current) => current.map((idea) => idea.id === id ? { ...idea, category } : idea));
  }

  function clearSelection() {
    setIdeas((current) => current.map((idea) => ({ ...idea, selected: false })));
    setNotice("ล้างตัวเลือกแล้ว — เลือกใหม่ได้ตามที่ต้องการ");
  }

  async function addBoard() {
    const cleanId = newBoardId.trim();
    const cleanName = newBoardName.trim();
    const cleanGroupId = newBoardGroupId.trim();
    const cleanGroupName = newBoardGroupName.trim();
    if (!cleanId || !cleanName || !cleanGroupId || !cleanGroupName) return setNotice("ใส่ชื่อและ ID ของ Board กับ Group ให้ครบก่อนเพิ่ม");
    if (boards.some((board) => board.id === cleanId)) return setNotice("Board นี้อยู่ในรายการแล้ว");
    const board = { id: cleanId, name: cleanName, groups: [{ id: cleanGroupId, label: cleanGroupName }] };
    try {
      const response = await fetch("/api/monday/boards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boardId: cleanId, boardName: cleanName, groupId: cleanGroupId, groupName: cleanGroupName }) });
      if (!response.ok) throw new Error("บันทึก Board ไม่สำเร็จ");
    } catch {
      return setNotice("ยังบันทึก Board ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    setBoards((current) => [...current, board]);
    setBoardId(cleanId);
    setGroupId(cleanGroupId);
    setNewBoardId("");
    setNewBoardName("");
    setNewBoardGroupId("");
    setNewBoardGroupName("");
    setShowBoardForm(false);
    setNotice(`เพิ่ม ${cleanName} เป็นปลายทาง Monday แล้ว`);
  }

  async function generateSlideImage(slide: Slide, useReference = false) {
    setSlides((current) => current.map((item) => item.id === slide.id ? { ...item, imageLoading: true, imageError: undefined } : item));
    try {
      const response = await fetch("/api/mockups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ industry, title: slide.title, body: slide.body, client, theme, brandMood, brandReferenceImage, category: slide.category, product: slide.product, visualDirection: slide.visualDirection, headline: slide.postHeadline, offer: slide.postOffer, cta: slide.postCta, assetKind: slide.kind, referenceImage: useReference ? slide.referenceImage : undefined }) });
      const payload = await response.json() as { image?: string; error?: string; nextStep?: string };
      if (!response.ok || !payload.image) throw new Error(payload.nextStep ?? payload.error ?? "สร้างภาพ mockup ไม่สำเร็จ");
      setSlides((current) => current.map((item) => item.id === slide.id ? { ...item, image: payload.image, imageLoading: false, imageError: undefined } : item));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "สร้างภาพ mockup ไม่สำเร็จ");
      const message = error instanceof Error ? error.message : "สร้างภาพ mockup ไม่สำเร็จ";
      setSlides((current) => current.map((item) => item.id === slide.id ? { ...item, imageLoading: false, imageError: message } : item));
    }
  }

  function updateSlideField(id: string, field: "postHeadline" | "postOffer" | "postCta", value: string) {
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, [field]: value } : slide));
  }

  function prepareReferenceImage(file: File, onReady: (image: string, status: string) => void, onError: (message: string) => void) {
    if (!file.type.startsWith("image/")) return onError("เลือกไฟล์ภาพ PNG, JPG หรือ WebP เท่านั้น");
    if (file.size > 25 * 1024 * 1024) return onError("ไฟล์ภาพใหญ่เกิน 25 MB — ลดขนาดไฟล์แล้วอัปอีกครั้ง");
    const reader = new FileReader();
    reader.onerror = () => onError("อ่านไฟล์ภาพไม่สำเร็จ ลองเลือกไฟล์ใหม่");
    reader.onload = () => {
      const source = String(reader.result);
      const image = new Image();
      image.onerror = () => onError("ไฟล์นี้ไม่ใช่ภาพที่ใช้งานได้ ลองเลือก PNG, JPG หรือ WebP");
      image.onload = () => {
        const maxSide = 2048;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        if (scale === 1) return onReady(source, `พร้อมใช้ · ${image.naturalWidth} × ${image.naturalHeight} px`);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) return onError("เตรียมภาพไม่สำเร็จ ลองเลือกไฟล์ใหม่");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        onReady(canvas.toDataURL("image/png"), `ย่อจาก ${image.naturalWidth} × ${image.naturalHeight} เป็น ${canvas.width} × ${canvas.height} px เพื่อสร้างภาพได้`);
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  }

  function uploadSlideImage(id: string, file?: File, target: "reference" | "final" = "reference") {
    if (!file) return;
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, referenceStatus: "กำลังตรวจภาพ…", imageError: undefined } : slide));
    prepareReferenceImage(file, (image, status) => {
      setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, [target === "reference" ? "referenceImage" : "image"]: image, ...(target === "reference" ? { referenceName: file.name, referenceStatus: status } : {}) } : slide));
      setNotice(target === "reference" ? "เพิ่มภาพอ้างอิงแล้ว — กดสร้างจากข้อความ + ภาพได้" : "ใช้ภาพจริงกับชิ้นงานนี้แล้ว");
    }, (message) => {
      setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, referenceStatus: message, imageError: message } : slide));
      setNotice(message);
    });
  }

  function clearSlideReference(id: string) {
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, referenceImage: undefined, referenceName: undefined, referenceStatus: undefined, imageError: undefined } : slide));
    setNotice("ล้างภาพอ้างอิงของชิ้นงานนี้แล้ว");
  }

  function removeSlideImage(id: string) {
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, image: undefined } : slide));
    setNotice("ลบภาพที่สร้างแล้ว — กลับไปแก้ข้อความหรือสร้างใหม่ได้");
  }

  function uploadBrandReference(file?: File) {
    if (!file) return;
    setBrandReferenceStatus("กำลังตรวจภาพ…");
    prepareReferenceImage(file, (image, status) => {
      setBrandReferenceImage(image);
      setBrandReferenceName(file.name);
      setBrandReferenceStatus(status);
      setNotice("เพิ่ม logo / mood reference แล้ว — จะส่งพร้อมการสร้าง artwork ทุกชิ้น");
    }, (message) => {
      setBrandReferenceStatus(message);
      setNotice(message);
    });
  }

  function clearBrandReference() {
    setBrandReferenceImage(null);
    setBrandReferenceName("");
    setBrandReferenceStatus("");
    setNotice("ล้าง logo / mood reference แล้ว — ภาพที่จะสร้างครั้งถัดไปจะไม่ใช้ไฟล์นี้");
  }

  async function downloadPresentation() {
    if (!slides.length) return setNotice("สร้างสไลด์ก่อนดาวน์โหลด");
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Marktech Content OS";
    pptx.subject = `Content plan for ${client}`;
    pptx.title = `Content Plan ${client} ${planMonth}`;
    pptx.lang = "th-TH";
    for (const [index, source] of slides.entries()) {
      const slide = pptx.addSlide();
      slide.background = { color: source.kind === "cover" ? "5C3729" : "FFF9F2" };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: "A55E42" }, line: { color: "A55E42" } });
      slide.addText(`MARKTECH CONTENT OS  |  ${String(index + 1).padStart(2, "0")}`, { x: 0.55, y: 0.35, w: 7.4, h: 0.22, fontFace: "Aptos", fontSize: 8, bold: true, color: source.kind === "cover" ? "F0CBB4" : "A55E42", charSpacing: 1.2 });
      slide.addText(source.title, { x: 0.55, y: 0.75, w: source.kind === "content" ? 5.35 : 12.1, h: source.kind === "content" ? 0.9 : 0.65, fontFace: "Aptos Display", fontSize: source.kind === "content" ? 27 : 30, bold: true, color: source.kind === "cover" ? "FFF8F1" : "302820", breakLine: false, fit: "shrink" });
      if (source.kind === "content") {
        slide.addText(source.body, { x: 0.55, y: 1.75, w: 5.35, h: 4.55, fontFace: "Aptos", fontSize: 12, color: "51463E", breakLine: false, fit: "shrink", margin: 0 });
        slide.addShape(pptx.ShapeType.roundRect, { x: 7.45, y: 0.88, w: 4.75, h: 4.75, rectRadius: 0.14, fill: { color: "F0E5D7" }, line: { color: "D9B9A4", width: 1 } });
        if (source.image?.startsWith("data:image")) slide.addImage({ data: source.image, x: 7.48, y: 0.91, w: 4.69, h: 4.69, sizing: { type: "cover", x: 7.48, y: 0.91, w: 4.69, h: 4.69 } });
        slide.addShape(pptx.ShapeType.roundRect, { x: 7.72, y: 4.25, w: 4.22, h: 1.05, rectRadius: 0.08, fill: { color: "FFFFFF", transparency: 10 }, line: { color: "FFFFFF", transparency: 100 } });
        slide.addText(source.postHeadline ?? source.title, { x: 7.94, y: 4.4, w: 3.8, h: 0.35, fontFace: "Aptos Display", fontSize: 17, bold: true, color: "302820", fit: "shrink", margin: 0 });
        slide.addText(source.postOffer ?? "", { x: 7.94, y: 4.79, w: 3.8, h: 0.23, fontFace: "Aptos", fontSize: 10, color: "82442F", fit: "shrink", margin: 0 });
        slide.addText(source.postCta ?? "", { x: 7.94, y: 5.06, w: 3.8, h: 0.18, fontFace: "Aptos", fontSize: 8, bold: true, color: "53654A", fit: "shrink", margin: 0 });
      } else {
        slide.addText(source.body, { x: 0.55, y: 1.65, w: 12.05, h: 5.1, fontFace: "Aptos", fontSize: source.kind === "summary" ? 14 : 18, color: source.kind === "cover" ? "F1DED2" : "51463E", breakLine: false, fit: "shrink", margin: 0 });
      }
    }
    await pptx.writeFile({ fileName: `Content-Plan-${client.replaceAll(" ", "-")}-${planMonth}.pptx` });
    setNotice("ดาวน์โหลดไฟล์ PowerPoint แล้ว — เปิดแก้ต่อใน PowerPoint หรือ Google Slides ได้");
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

  async function approveProposal() {
    try {
      const response = await fetch("/api/content/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client, planMonth, serviceScope, items: selectedIdeas }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "บันทึกประวัติแผนไม่สำเร็จ");
      setStep(4);
      await saveDraft("manual", "approved");
      setNotice("บันทึกการอนุมัติแล้ว — ขั้นต่อไปคือกระจายวันลงตลอดทั้งเดือน โดยดูจำนวนงานและประเภทงานในแต่ละวัน");
      scrollToId("month-calendar");
    } catch (error) {
      setNotice(`ยังไม่อนุมัติแผน: ${error instanceof Error ? error.message : "บันทึกประวัติแผนไม่สำเร็จ"}`);
    }
  }

  function schedulePlan() {
    const dates = balancedDates(selectedIdeas, planMonth, existingWork);
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
          boardId,
          groupId,
          tasks: selectedIdeas.map((idea, index) => ({
            contentId: idea.id,
            title: titleForMonday(client, planMonth, index + 1, idea),
            client,
            format: idea.format,
            scheduledFor: idea.date,
            contentBrief: slides.find((slide) => slide.ideaId === idea.id)?.body ?? `${idea.category}\n${idea.hook}\n${idea.adminAngle}`,
          })),
        }),
      });
      const payload = await response.json() as { created?: number; error?: string; nextStep?: string };
      if (!response.ok) throw new Error(payload.nextStep ?? payload.error ?? "ส่ง Monday ไม่สำเร็จ");
      await saveDraft("manual", "sent_to_monday");
      setNotice(`สร้าง ${payload.created ?? selectedIdeas.length} งานใน ${activeGroup.label} เรียบร้อยแล้ว`);
      setShowConfirm(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ส่ง Monday ไม่สำเร็จ");
    }
  }

  async function completePlan() {
    const saved = await saveDraft("manual", "completed");
    if (!saved) return;
    setShowCompleteConfirm(false);
    setShowDrafts(false);
    setShowArchive(true);
    setNotice("ปิดงานและเก็บเข้าคลังแล้ว — เปิดดูหรือดาวน์โหลด PowerPoint ซ้ำได้ทุกเมื่อ");
  }

  const stages = ["ตั้งโจทย์", "คัดชุดไอเดีย", "ทำสไลด์", "อนุมัติแผน", "จัดวันและส่ง Monday"];

  return <main className="planner-shell" id="top">
    <header className="planner-header">
      <a className="brand" href="#top" aria-label="Marktech Content OS home"><span className="brand-mark">m</span><span><strong>marktech</strong><small>content planning OS</small></span></a>
      <div className="header-copy"><strong>วางแผนคอนเทนท์รายเดือน</strong><span>AI คิด → ทีมคัด → ลูกค้าอนุมัติ → ส่งทีมผลิต</span></div>
      <div className="draft-controls">
        <span className={`save-indicator ${saveState}`} aria-live="polite">{saveState === "saving" ? "กำลังบันทึก…" : saveState === "saved" ? planStatus === "completed" ? "เก็บเข้าคลังแล้ว" : "บันทึกอัตโนมัติแล้ว" : saveState === "error" ? "บันทึกไม่สำเร็จ" : "ยังไม่มีร่าง"}{lastSavedAt && saveState === "saved" ? ` · ${new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSavedAt))}` : ""}</span>
        <button className="button button-secondary" onClick={() => { setShowDrafts((value) => !value); setShowArchive(false); }} type="button">งานระหว่างทำ {draftPlans.length}</button>
        <button className="button button-secondary" onClick={() => { setShowArchive((value) => !value); setShowDrafts(false); }} type="button">คลังงานเสร็จ {completedPlans.length}</button>
        <button className="button button-secondary" onClick={() => void saveDraft("manual")} disabled={saveState === "saving"} type="button">บันทึกตอนนี้</button>
        {hasPlanWork && planStatus !== "completed" && <button className="button button-secondary" onClick={() => setShowCompleteConfirm(true)} type="button">ปิดงานเข้าคลัง</button>}
        <button className="button button-primary" onClick={() => hasPlanWork ? setShowNewPlanConfirm(true) : resetPlan()} type="button">+ เริ่มแผนใหม่</button>
      </div>
    </header>

    {showDrafts && <section className="draft-panel" aria-label="รายการงานร่าง">
      <div><p className="eyebrow">งานร่างที่บันทึกไว้</p><h2>กลับมาทำต่อได้ทุกแผน</h2><p>เลือกเปิดร่างที่เคยทำไว้ ระบบจะโหลดไอเดีย สไลด์ และภาพ mockup กลับมาให้ครบ</p></div>
      <div className="draft-list">{draftPlans.length ? draftPlans.map((savedPlan) => <article key={savedPlan.id} className={savedPlan.id === activePlanId ? "active" : ""}><div><strong>{savedPlan.title}</strong><span>{savedPlan.client} · {savedPlan.planMonth} · {savedPlan.status === "sent_to_monday" ? "ส่ง Monday แล้ว" : savedPlan.status === "approved" ? "แผนผ่านแล้ว" : "ร่าง"} · แก้ล่าสุด {new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(savedPlan.updatedAt))}</span></div><div><button className="text-button" type="button" onClick={() => void loadPlan(savedPlan.id)}>เปิดทำต่อ</button><button className="text-button text-button-danger" type="button" onClick={() => { if (window.confirm(`ลบร่าง “${savedPlan.title}” ใช่หรือไม่? การลบนี้ย้อนกลับไม่ได้`)) void deletePlan(savedPlan.id); }}>ลบ</button></div></article>) : <div className="empty-drafts">ยังไม่มีงานระหว่างทำ — เริ่มสร้างไอเดียแล้วระบบจะบันทึกให้อัตโนมัติ</div>}</div>
    </section>}
    {showArchive && <section className="draft-panel archive-panel" aria-label="คลังงานเสร็จ">
      <div><p className="eyebrow">คลังงานเสร็จ</p><h2>แผนที่ปิดงานแล้ว</h2><p>ทุกชิ้นเก็บสไลด์ รายละเอียด และภาพ mockup ไว้ครบ เปิดดู แก้ หรือดาวน์โหลด PowerPoint ซ้ำได้ทุกเมื่อ</p></div>
      <div className="draft-list">{completedPlans.length ? completedPlans.map((savedPlan) => <article key={savedPlan.id} className={savedPlan.id === activePlanId ? "active" : ""}><div><strong>{savedPlan.title}</strong><span>{savedPlan.client} · {savedPlan.planMonth} · ปิดงานเมื่อ {new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(savedPlan.updatedAt))}</span></div><div><button className="text-button" type="button" onClick={() => void loadPlan(savedPlan.id)}>เปิดดู / โหลด</button><button className="text-button text-button-danger" type="button" onClick={() => { if (window.confirm(`ลบงานเสร็จ “${savedPlan.title}” ใช่หรือไม่? จะไม่สามารถกู้สไลด์และภาพกลับมาได้`)) void deletePlan(savedPlan.id); }}>ลบ</button></div></article>) : <div className="empty-drafts">ยังไม่มีงานในคลัง — เมื่อส่งมอบหรือทำงานเสร็จ ให้กด “ปิดงานเข้าคลัง”</div>}</div>
    </section>}

    <section className="hero">
      <p className="eyebrow">MARKTECH CONTENT OS · MONTHLY PLANNING</p>
      <h1>สั่งโจทย์ครั้งเดียว<br />ให้ AI คิดทั้งเดือน</h1>
      <p>หลายโปรดักต์ก็ได้ ไม่มีโปรดักต์ก็ได้ แล้วคัดเป็นแผนที่พร้อมนำเสนอและส่งทีมผลิต</p>
      <ol className="journey" aria-label="ขั้นตอนการวางแผน">{stages.map((stage, index) => <li className={step > index + 1 ? "done" : step === index + 1 ? "active" : ""} key={stage}><span>{step > index + 1 ? "✓" : index + 1}</span><strong>{stage}</strong></li>)}</ol>
    </section>

    <div className="notice" role="status"><strong>สถานะ</strong><span>{notice}</span></div>

    <section className="flow-card" id="brief">
      <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 1</p><h2>ตั้งโจทย์ของเดือน</h2><p>เลือกลูกค้า เดือน และเรื่องที่อยากผลักดันในเดือนนี้ จะมีหลายโปรดักต์หรือเป็นเรื่องกว้าง ๆ ก็ได้</p></div><span className="pill">AI สร้าง · Planner คัด</span></div>
      <section className="one-command" aria-label="สั่งงานครั้งเดียว">
        <div><p className="eyebrow">วิธีที่เร็วที่สุด</p><h3>พิมพ์โจทย์ครั้งเดียว</h3><p>บอกโปรดักต์ โปรจริง คนที่อยากคุยด้วย และปัญหาที่อยากขยี้ในภาษาทีมได้เลย</p></div>
        <textarea value={oneCommand} onChange={(event) => setOneCommand(event.target.value)} placeholder="เช่น NV เดือนสิงหาคม อยากดัน Filler โปรกล่องดำ 1,990/cc กลุ่มที่สนใจแต่กลัว 1 cc ไม่พอจนงบบาน เน้นให้ทักมาประเมินก่อนซื้อ ทำ 8 ไอเดีย เน้นโปรโมชันแต่มีรีวิวประกอบ" />
        <div className="action-row"><button className="button button-primary" type="button" onClick={() => void readOneCommand()} disabled={isReadingBrief}>{isReadingBrief ? "AI กำลังแยกโจทย์…" : "ให้ AI แยกโจทย์ให้ →"}</button><span>ไม่ต้องกรอกช่องย่อยก่อน — ถ้ามีข้อมูลไม่พอ AI จะไม่แต่งราคา โปร หรือข้ออ้างขึ้นเอง</span></div>
        {briefSummary && <div className="brief-summary"><strong>AI เข้าใจโจทย์ว่า</strong><span>{briefSummary}</span></div>}
      </section>
      <div className="quick-settings">
        <label>ลูกค้า<input aria-label="ลูกค้า" list="client-options" value={client} onChange={(event) => setClient(event.target.value)} placeholder="พิมพ์ชื่อลูกค้าใหม่ได้" /><datalist id="client-options">{clientOptions.map((option) => <option key={option} value={option} />)}</datalist></label>
        <label>เดือนที่ต้องการแพลน<input aria-label="เดือนที่ต้องการแพลน" type="month" value={planMonth} onChange={(event) => setPlanMonth(event.target.value)} /></label>
        <label>ให้ AI คิดกี่ทางเลือก <small>(1–36 ชิ้น)</small><input type="number" min="1" max="36" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(36, Number(event.target.value) || 1)))} /></label>
      </div>
      {briefSummary && <section className="brief-review" aria-label="ตรวจโจทย์ก่อนสร้างไอเดีย">
        <div className="brief-review-heading"><div><p className="eyebrow">หยุดตรวจ 1 ครั้งก่อนสร้าง</p><h3>ตรวจโจทย์และภาพอ้างอิง</h3><p>นี่คือสิ่งที่ AI จะแจกไปสร้างไอเดีย คุณแก้รายละเอียดได้ด้านล่าง หรือยืนยันเพื่อเริ่มสร้างได้เลย</p></div><button className="text-button" type="button" onClick={() => setAdvancedBriefOpen(true)}>แก้รายละเอียด</button></div>
        <div className="brief-counts"><span>AI แยกได้ <strong>{reviewedBriefs.length} เรื่อง</strong> จากโจทย์</span><strong>เมื่อยืนยัน ระบบจะสร้าง <b>{ideaPoolSize} ไอเดีย</b></strong></div>
        <div className="brief-review-products">{reviewedBriefs.map((brief) => <article key={brief.id}><strong>{brief.product || "เรื่องทั่วไป"}</strong><span>{brief.goal || "ยังไม่ได้ระบุสิ่งที่อยากสื่อ"}</span><small>{brief.painFocus || "ยังไม่ได้ระบุ pain / สถานการณ์"}</small></article>)}</div>
        <div className="brand-art-direction"><label>Mood / tone ของแบรนด์<textarea value={brandMood} onChange={(event) => setBrandMood(event.target.value)} placeholder="เช่น premium navy-gold, สนุกสดใส pink-yellow, minimal clean หรือข้อห้ามของแบรนด์" /></label><div className="brand-reference-control"><label className="brand-reference-upload">{brandReferenceImage ? "เปลี่ยน Logo / mood reference" : "อัปโหลด Logo / mood reference"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { uploadBrandReference(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{brandReferenceImage ? <div className="brand-reference-preview"><img src={brandReferenceImage} alt={`ภาพอ้างอิงแบรนด์ ${brandReferenceName || "ที่อัปโหลด"}`} /><div><strong>{brandReferenceName || "Logo / mood reference"}</strong><span>จะใช้กับภาพ mockup ที่สร้างหลังจากนี้</span></div><button className="text-button text-button-danger" type="button" onClick={clearBrandReference}>ล้างภาพ</button></div> : <span className="brand-reference-hint">ใส่ก่อนสร้างไอเดียได้เลย ระบบจะเก็บไว้ใช้สร้าง mockup ของแผนนี้</span>}{brandReferenceStatus && <span className={`brand-reference-status ${brandReferenceImage ? "ready" : "error"}`}>{brandReferenceStatus}</span>}</div></div>
        <div className="action-row"><button className="button button-primary" type="button" onClick={generateIdeas} disabled={isGenerating}>{isGenerating ? `AI กำลังคิด ${ideaPoolSize} ทางเลือก…` : `ยืนยันโจทย์ · ให้ AI คิด ${ideaPoolSize} ทางเลือก →`}</button><span>ไอเดียจะยังไม่ถูกสร้างจนกว่าจะกดปุ่มนี้</span></div>
      </section>}
      <button className="advanced-toggle" type="button" onClick={() => setAdvancedBriefOpen((value) => !value)}>{advancedBriefOpen ? "− ซ่อนรายละเอียดที่ AI แยกให้" : "+ ดู / แก้รายละเอียดที่ AI แยกให้"}</button>
      {advancedBriefOpen && <div className="advanced-brief">
        <div className="brief-grid">
          <label>ชื่อแผน <small>(ตั้งเองได้)</small><input aria-label="ชื่อแผน" value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="เช่น August Botox Conversion" /></label>
          <label>ประเภทงาน<select value={serviceScope} onChange={(event) => setServiceScope(event.target.value as "content" | "ads_only")}><option value="content">ทำ Content + ส่ง Monday</option><option value="ads_only">Ads-only / ให้คำแนะนำ</option></select></label>
          <label>อุตสาหกรรม / ธุรกิจ<input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="เช่น ร้านอาหาร, อสังหาริมทรัพย์" /></label>
          <label className="span-two">คอนเซ็ปต์หรือเป้าหมายหลักของเดือน<textarea value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="เช่น เดือนนี้ต้องการให้คนเข้าใจว่า Botox ไม่ได้ทำให้หน้าตึง และพาไปสู่การนัด" /></label>
          <label>น้ำหนักแผน<select value={planningGoal} onChange={(event) => setPlanningGoal(event.target.value as PlanningGoal)}><option value="sales">เน้นปิดการขาย</option><option value="trust">เน้นความน่าเชื่อถือ</option><option value="balanced">คละอย่างสมดุล</option><option value="trend">เน้นบริบท/กระแส</option></select></label>
          <label className="span-two">บริบทสดที่อยากให้หยิบใช้ <small>(โปรจริง, เทศกาล, ข่าว, เทรนด์, format ที่กำลังมา)</small><textarea value={freshContext} onChange={(event) => setFreshContext(event.target.value)} placeholder="เช่น โปรสิ้นเดือน: Botox 50 ยูนิต ราคา… / เปิดสาขาใหม่ / ช่วงเปิดเทอม / คลิป POV แบบ…" /></label>
          <label>การนำไอเดียเดิมมาใช้<select value={reusePolicy} onChange={(event) => setReusePolicy(event.target.value as "avoid" | "adapt")}><option value="adapt">Copy-to-Adapt ตามโปร/บริบทเดือนนี้</option><option value="avoid">เปิดมุมใหม่เป็นหลัก</option></select></label>
        </div>
        <fieldset className="category-picker"><legend>ประเภทคอนเทนท์ที่อยากได้ <small>ไม่เลือก = ระบบกระจาย 8 กลไกให้อัตโนมัติ</small></legend><div>{categoryChoices.map((category) => <label key={category}><input type="checkbox" checked={requestedCategories.includes(category)} onChange={() => setRequestedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])} />{category}</label>)}</div><p className="mechanism-note">ระบบจะวางโครงก่อนเขียน: Offer · Proof · Expert · Scenario · Interactive · Conversion · Trend · Behind the scenes แล้วตรวจคำเปิดและมุมซ้ำก่อนแสดงผล</p></fieldset>
        <div className="brand-art-direction"><label>Mood / tone ของแบรนด์<textarea value={brandMood} onChange={(event) => setBrandMood(event.target.value)} placeholder="เช่น premium navy-gold, สนุกสดใส pink-yellow, minimal clean หรือข้อห้ามของแบรนด์" /></label><div className="brand-reference-control"><label className="brand-reference-upload">{brandReferenceImage ? "เปลี่ยน Logo / mood reference" : "อัปโหลด Logo / mood reference"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { uploadBrandReference(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{brandReferenceImage ? <div className="brand-reference-preview"><img src={brandReferenceImage} alt={`ภาพอ้างอิงแบรนด์ ${brandReferenceName || "ที่อัปโหลด"}`} /><div><strong>{brandReferenceName || "Logo / mood reference"}</strong><span>พร้อมใช้กับการสร้างภาพครั้งถัดไปทุกชิ้น</span></div><button className="text-button text-button-danger" type="button" onClick={clearBrandReference}>ล้างภาพ</button></div> : <span className="brand-reference-hint">ใช้เป็น tone / logo reference กับภาพที่จะสร้างหลังจากนี้</span>}{brandReferenceStatus && <span className={`brand-reference-status ${brandReferenceImage ? "ready" : "error"}`}>{brandReferenceStatus}</span>}</div></div>
        <div className="product-briefs"><div className="section-label"><div><strong>โปรดักต์ / เรื่องที่อยากสื่อ</strong><span>เพิ่มได้หลายแถว หรือแก้สิ่งที่ AI แยกให้ได้ตรงนี้</span></div><button className="text-button" type="button" onClick={addBrief}>+ เพิ่มเรื่อง</button></div>
          {briefs.map((brief, index) => <div className="product-row" key={brief.id}><strong className="row-number">{index + 1}</strong><label>โปรดักต์<input aria-label={`โปรดักต์ ${index + 1}`} list="product-options" value={brief.product} onChange={(event) => updateBrief(brief.id, "product", event.target.value)} placeholder="พิมพ์ชื่อโปรดักต์ได้" /></label><label>อยากให้สื่ออะไร<input value={brief.goal} onChange={(event) => updateBrief(brief.id, "goal", event.target.value)} placeholder="เช่น ชวนคนที่ลังเลให้ทัก" /></label><label className="product-pain">ปัญหา / สถานการณ์ที่อยากขยี้<textarea value={brief.painFocus} onChange={(event) => updateBrief(brief.id, "painFocus", event.target.value)} placeholder="เช่น สนใจโปร แต่กลัว 1 cc ไม่พอจนงบบาน" /></label><label>ราคา <small>(ไม่บังคับ)</small><input inputMode="decimal" value={brief.price} onChange={(event) => updateBrief(brief.id, "price", event.target.value)} placeholder="เช่น 3,990" /></label><label>หน่วย <small>(ไม่บังคับ)</small><input value={brief.priceUnit} onChange={(event) => updateBrief(brief.id, "priceUnit", event.target.value)} placeholder="เช่น บาท / ต่อครั้ง" /></label><label>เงื่อนไข / ความต้องการเพิ่ม<input value={brief.customNeed} onChange={(event) => updateBrief(brief.id, "customNeed", event.target.value)} placeholder="เช่น ใช้หมอพูด, มีโปร 2.2" /></label><button className="icon-button" type="button" aria-label={`ลบเรื่องที่ ${index + 1}`} disabled={briefs.length === 1} onClick={() => removeBrief(brief.id)}>×</button></div>)}<datalist id="product-options">{productOptions.map((option) => <option key={option} value={option} />)}</datalist></div>
      </div>}
      {!briefSummary && <div className="action-row"><button className="button button-primary" type="button" onClick={generateIdeas} disabled={isGenerating}>{isGenerating ? `AI กำลังคิด ${ideaPoolSize} ทางเลือก…` : `ให้ AI คิด ${ideaPoolSize} ทางเลือก →`}</button><button className="button button-secondary" type="button" onClick={addManualIdea}>+ เพิ่มไอเดียเอง</button><span>พิมพ์ครั้งเดียวแล้วให้ AI จัดโครงให้ก่อน จากนั้นคุณค่อยเปิดแก้เฉพาะส่วนที่จำเป็น</span></div>}
    </section>

    {step >= 2 && <section className="flow-card" id="idea-selection">
      <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 2</p><h2>คัดชุดไอเดียสำหรับแผนนี้</h2><p>คัดทีละกลุ่มด้วยตัวกรอง และแก้ให้เป็นภาษาของแบรนด์ก่อนรวมเป็นแผน</p></div><div className="button-cluster"><label className="manual-product-picker">เพิ่มให้เรื่อง<select aria-label="โปรดักต์หรือเรื่องของไอเดียใหม่" value={manualIdeaProduct} onChange={(event) => setManualIdeaProduct(event.target.value)}><option value="ไม่ระบุโปรดักต์">เลือกภายหลัง</option>{briefs.filter((brief) => brief.product && brief.product !== "ไม่ระบุโปรดักต์").map((brief) => <option key={brief.id} value={brief.product}>{brief.product}{brief.goal ? ` · ${brief.goal}` : ""}</option>)}</select></label><button className="button button-secondary" onClick={addManualIdea} type="button">+ เพิ่มไอเดียเอง</button><button className="button button-secondary" onClick={clearSelection} type="button">ล้างตัวเลือก</button><button className="button button-secondary" onClick={selectRecommended} type="button">เลือก {quantity} ชิ้นที่แนะนำ</button></div></div>
      <div className="selection-summary"><strong>เลือก {selectedIdeas.length} / {ideas.length} ชิ้น</strong><span>คัดตามความเหมาะสมของแผน ไม่บังคับสัดส่วน Promotion / Offer</span><button className="button button-primary selection-next" onClick={makeProposal} type="button" disabled={!selectedIdeas.length}>ทำสไลด์เสนอแผน →</button></div>
      <div className="additional-generator"><div className="additional-intro"><strong>ไอเดียยังไม่พอ?</strong><span>ระบุว่าจะเติมเรื่องไหนและขยี้ pain แบบใดได้ — ชุดเดิมจะอยู่ครบ</span></div><label>เติมให้เรื่อง<select aria-label="โปรดักต์หรือเรื่องที่จะให้ AI เติม" value={additionalBriefId} onChange={(event) => setAdditionalBriefId(event.target.value)}><option value="all">ให้ AI เลือกจากทุก brief</option>{briefs.map((brief) => <option key={brief.id} value={brief.id}>{brief.product}{brief.goal ? ` · ${brief.goal}` : ""}</option>)}<option value="custom">+ พิมพ์โปรดักต์ / เรื่องใหม่</option></select></label>{additionalBriefId === "custom" && <label className="additional-direction">โปรดักต์ / เรื่องใหม่<input aria-label="โปรดักต์หรือเรื่องใหม่ที่จะให้ AI เติม" value={additionalCustomProduct} onChange={(event) => setAdditionalCustomProduct(event.target.value)} placeholder="เช่น Filler คาง / HIFU" /></label>}<label className="additional-direction">อยากให้เพิ่มแบบไหน<input aria-label="มุมหรือปัญหาที่อยากให้ AI เพิ่ม" value={additionalDirection} onChange={(event) => setAdditionalDirection(event.target.value)} placeholder="เช่น คนที่กลัวหน้าตึง / เปรียบเทียบทางเลือก" /></label><label>จำนวน<input aria-label="จำนวนไอเดียที่เพิ่ม" type="number" min="1" max="20" value={additionalIdeaCount} onChange={(event) => setAdditionalIdeaCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label><button className="button button-secondary" type="button" onClick={generateMoreIdeas} disabled={isGenerating}>{isGenerating ? "AI กำลังเติม…" : `ให้ AI เพิ่ม ${additionalIdeaCount} ไอเดีย`}</button></div>
      <div className="idea-filters"><label>ประเภทคอนเทนท์<select value={ideaCategoryFilter} onChange={(event) => setIdeaCategoryFilter(event.target.value)}><option>ทั้งหมด</option>{ideaCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label>โปรดักต์<select value={ideaProductFilter} onChange={(event) => setIdeaProductFilter(event.target.value)}><option>ทั้งหมด</option>{ideaProducts.map((item) => <option key={item}>{item}</option>)}</select></label><label>รูปแบบ<select value={ideaFormatFilter} onChange={(event) => setIdeaFormatFilter(event.target.value)}><option>ทั้งหมด</option><option>วิดีโอ</option><option>ภาพ</option><option>อัลบั้ม</option></select></label><label>มุมเล่า<select value={ideaPillarFilter} onChange={(event) => setIdeaPillarFilter(event.target.value)}><option>ทั้งหมด</option>{ideaPillars.map((item) => <option key={item}>{item}</option>)}</select></label><span>แสดง {visibleIdeas.length} จาก {ideas.length} ไอเดีย</span></div>
      <div className="idea-grid">{visibleIdeas.map((idea) => <article className={`idea-tile ${idea.selected ? "selected" : ""}`} key={idea.id}><button className="idea-select" onClick={() => toggleIdea(idea.id)} aria-pressed={idea.selected} type="button"><span>{idea.selected ? "✓ เลือกแล้ว" : "+ เลือก"} · {idea.format}</span><strong>{idea.title}</strong><p>{idea.hook}</p>{idea.priceLabel && <b className="idea-price">{idea.priceLabel}</b>}<em>{idea.category} · {idea.product}</em>{idea.mechanism && <small className="mechanism-label">กลไก: {idea.mechanism} · {idea.funnel || "consideration"}</small>}{idea.angle && <small className="angle-label">มุม: {idea.angle}</small>}<small>{idea.adaptation}</small></button><div className="idea-actions"><button className="text-button" type="button" onClick={() => setEditingIdeaId((current) => current === idea.id ? null : idea.id)}>{editingIdeaId === idea.id ? "ปิดการแก้ไข" : "แก้ไขไอเดีย"}</button><button className="text-button text-button-danger" type="button" onClick={() => removeIdea(idea.id)}>ลบไอเดีย</button></div>{editingIdeaId === idea.id && <div className="idea-editor"><label>หัวข้อ<input value={idea.title} onChange={(event) => updateIdea(idea.id, "title", event.target.value)} /></label><label>Hook<textarea value={idea.hook} onChange={(event) => updateIdea(idea.id, "hook", event.target.value)} /></label><label>ราคา / ข้อเสนอ<input value={idea.priceLabel ?? ""} onChange={(event) => updateIdea(idea.id, "priceLabel", event.target.value)} placeholder="เช่น 699 บาท / 10 cc" /></label><label>โปรดักต์ / เรื่อง<input value={idea.product} onChange={(event) => updateIdea(idea.id, "product", event.target.value)} /></label><label>รูปแบบ<select value={idea.format} onChange={(event) => updateIdeaFormat(idea.id, event.target.value as Format)}><option>วิดีโอ</option><option>ภาพ</option><option>อัลบั้ม</option></select></label><label>ประเภท<select value={idea.category} onChange={(event) => updateIdeaCategory(idea.id, event.target.value as Idea["category"])}><option>โปรโมชั่น / Offer</option><option>รีวิว / Proof</option><option>ความรู้ / FAQ</option><option>แบรนด์ / ไลฟ์สไตล์</option></select></label><label>มุมเล่า<input value={idea.pillar} onChange={(event) => updateIdea(idea.id, "pillar", event.target.value)} /></label><label>เหตุผลที่ควรทำ<textarea value={idea.reason} onChange={(event) => updateIdea(idea.id, "reason", event.target.value)} /></label><label>แนวภาพโพสต์ Facebook<textarea value={idea.visualDirection} onChange={(event) => updateIdea(idea.id, "visualDirection", event.target.value)} /></label></div>}</article>)}</div>
      <div className="sticky-action"><span><strong>{selectedIdeas.length} ไอเดีย</strong> พร้อมรวมเป็นข้อเสนอ</span><button className="button button-primary" onClick={makeProposal} type="button">ทำสไลด์เสนอแผน →</button></div>
    </section>}

    {step >= 3 && <section className="flow-card" id="proposal-slides">
      <div className="flow-title"><div><p className="eyebrow">ขั้นที่ 3 · สไลด์เสนอ</p><h2>สไลด์แนวนอนสำหรับนำเสนอ</h2><p>มีหน้าสรุปทั้งแผน และ 1 หน้า ต่อ 1 คอนเทนท์ พร้อมตัวอย่างชิ้นงาน Facebook ที่แก้ข้อความได้</p></div><div className="button-cluster"><button className="button button-secondary" type="button" onClick={() => window.print()}>พิมพ์ / PDF</button><button className="button button-primary" type="button" onClick={downloadPresentation}>ดาวน์โหลด PowerPoint</button></div></div>
      <div className="slides-editor">{slides.map((slide, index) => <article className={`proposal-slide ${slide.kind} ${slide.image && slide.kind !== "content" ? "full-image-slide" : ""}`} key={slide.id}>{slide.image && slide.kind !== "content" ? <><img className="full-slide-image" src={slide.image} alt={`ภาพสไลด์ ${index + 1}: ${slide.title}`} /><div className="full-slide-actions"><button className="slide-mockup-button" type="button" onClick={() => generateSlideImage(slide)} disabled={slide.imageLoading}>{slide.imageLoading ? "กำลังสร้างภาพ…" : "สร้างภาพใหม่"}</button><button className="slide-mockup-button" type="button" onClick={() => removeSlideImage(slide.id)}>ลบภาพ</button></div></> : <><div className="slide-copy"><span>SLIDE {String(index + 1).padStart(2, "0")}</span><textarea aria-label={`หัวข้อสไลด์ ${index + 1}`} className="slide-title" value={slide.title} onChange={(event) => updateSlide(slide.id, "title", event.target.value)} /><textarea aria-label={`เนื้อหาสไลด์ ${index + 1}`} className="slide-body" value={slide.body} onChange={(event) => updateSlide(slide.id, "body", event.target.value)} /></div>{slide.kind === "content" && <div className="facebook-preview"><div className="facebook-top"><strong>facebook</strong><span>ชิ้นงานแอดที่สร้างด้วย AI</span></div><div className={`facebook-art ad-${adVariant(slide.category)} ${slide.image ? "generated-art" : ""}`}>{slide.image ? <img src={slide.image} alt={`Artwork สำหรับ ${slide.title}`} /> : <div className="facebook-overlay"><span className="ad-category">{slide.category}</span><textarea aria-label={`Headline โพสต์ ${index + 1}`} value={slide.postHeadline ?? ""} onChange={(event) => updateSlideField(slide.id, "postHeadline", event.target.value)} /><textarea aria-label={`Offer โพสต์ ${index + 1}`} value={slide.postOffer ?? ""} onChange={(event) => updateSlideField(slide.id, "postOffer", event.target.value)} /><textarea aria-label={`CTA โพสต์ ${index + 1}`} value={slide.postCta ?? ""} onChange={(event) => updateSlideField(slide.id, "postCta", event.target.value)} /></div>}</div><div className="artwork-copy-editor"><strong>แก้ข้อความในภาพนี้</strong><span>แก้เฉพาะชิ้นนี้ แล้วกดสร้าง artwork ใหม่ด้านล่าง — สไลด์อื่นจะไม่เปลี่ยน</span><label>Headline<input aria-label={`Headline artwork ${index + 1}`} value={slide.postHeadline ?? ""} onChange={(event) => updateSlideField(slide.id, "postHeadline", event.target.value)} /></label><label>{slide.category === "โปรโมชั่น / Offer" ? "ราคา / ข้อเสนอ" : "ข้อความรอง"}<input aria-label={`ข้อความรอง artwork ${index + 1}`} value={slide.postOffer ?? ""} onChange={(event) => updateSlideField(slide.id, "postOffer", event.target.value)} /></label><label>CTA<input aria-label={`CTA artwork ${index + 1}`} value={slide.postCta ?? ""} onChange={(event) => updateSlideField(slide.id, "postCta", event.target.value)} /></label></div><div className="slide-image-actions"><label className="slide-upload">{slide.referenceImage ? "เปลี่ยนภาพอ้างอิง" : "อัปโหลดภาพอ้างอิง"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { uploadSlideImage(slide.id, event.target.files?.[0], "reference"); event.currentTarget.value = ""; }} /></label>{slide.referenceImage && <div className="slide-reference-preview"><img src={slide.referenceImage} alt={`ภาพอ้างอิง ${slide.referenceName || "ที่อัปโหลด"}`} /><span>{slide.referenceName || "ภาพอ้างอิงพร้อมใช้"}</span><button className="text-button text-button-danger" type="button" onClick={() => clearSlideReference(slide.id)}>ล้าง</button></div>}{slide.referenceStatus && <span className={`slide-reference-status ${slide.referenceImage ? "ready" : "error"}`}>{slide.referenceStatus}</span>}{slide.imageError && <span className="slide-reference-status error">สร้างภาพไม่สำเร็จ: {slide.imageError}</span>}<button className="slide-mockup-button" type="button" onClick={() => generateSlideImage(slide, true)} disabled={slide.imageLoading || !slide.referenceImage}>{slide.imageLoading ? "กำลังสร้าง…" : "สร้าง artwork ใหม่จากข้อความ + ภาพ"}</button><button className="slide-mockup-button" type="button" onClick={() => generateSlideImage(slide)} disabled={slide.imageLoading}>{slide.imageLoading ? "กำลังสร้าง…" : "สร้าง artwork ใหม่จากข้อความ"}</button></div></div>}{slide.kind !== "content" && <div className="slide-side-visual"><button className="slide-mockup-button" type="button" onClick={() => generateSlideImage(slide)} disabled={slide.imageLoading}>{slide.imageLoading ? "กำลังสร้างภาพ…" : "สร้างภาพสไลด์"}</button></div>}</>}</article>)}</div>
      <div className="slide-tools"><button className="text-button" type="button" onClick={() => setSlides((current) => [...current, { id: `custom-${Date.now()}`, kind: "custom", title: "หัวข้อสไลด์เพิ่มเติม", body: "พิมพ์ข้อความที่ต้องการนำเสนอ" }])}>+ เพิ่มสไลด์</button><span>ตัวอย่าง Facebook เป็นชิ้นงานตั้งต้น: แก้ Headline, Offer, CTA และสร้างภาพประกอบเฉพาะชิ้นได้</span></div>
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
      {adsOnly ? <div className="ads-only"><strong>ลูกค้ารายนี้เป็น Ads-only</strong><span>จบที่สไลด์และคำแนะนำคอนเทนท์ จึงไม่มีการสร้างงานเข้า Monday</span></div> : <><div className="destination-grid"><label>Board<select aria-label="Board" value={boardId} onChange={(event) => { const next = boards.find((board) => board.id === event.target.value); setBoardId(event.target.value); setGroupId(next?.groups[0].id ?? groupOptions[0].id); }}>{boards.map((board) => <option value={board.id} key={board.id}>{board.name}</option>)}</select></label><label>Group ปลายทาง<select aria-label="Group ปลายทาง" value={groupId} onChange={(event) => setGroupId(event.target.value)}>{activeBoard.groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label><div><span>จำนวนที่จะสร้าง</span><strong>{selectedIdeas.length} งาน</strong><small>มีวันที่ลงครบทุกชิ้น</small></div></div><button className="text-button" type="button" onClick={() => setShowBoardForm((value) => !value)}>+ เพิ่ม Board ปลายทาง</button>{showBoardForm && <div className="board-form"><label>ชื่อ Board<input value={newBoardName} onChange={(event) => setNewBoardName(event.target.value)} placeholder="เช่น Marktech : Content (Aug 2026)" /></label><label>Monday Board ID<input value={newBoardId} onChange={(event) => setNewBoardId(event.target.value)} placeholder="ตัวเลข Board ID" /></label><label>ชื่อ Group ปลายทาง<input value={newBoardGroupName} onChange={(event) => setNewBoardGroupName(event.target.value)} placeholder="เช่น New Brief" /></label><label>Monday Group ID<input value={newBoardGroupId} onChange={(event) => setNewBoardGroupId(event.target.value)} placeholder="เช่น new_group123" /></label><button className="button button-secondary" type="button" onClick={addBoard}>บันทึก Board นี้</button></div>}<div className="monday-preview"><strong>ตัวอย่างชื่อที่จะสร้าง</strong>{selectedIdeas.slice(0, 3).map((idea, index) => <span key={idea.id}>{titleForMonday(client, planMonth, index + 1, idea)}</span>)}{selectedIdeas.length > 3 && <small>…และอีก {selectedIdeas.length - 3} งาน</small>}</div><div className="action-row"><button className="button button-primary" onClick={openMondayConfirmation} type="button">ตรวจ {selectedIdeas.length} งานก่อนส่ง →</button><span>ยังไม่มีงานถูกสร้างจนกว่าจะยืนยันในหน้าถัดไป</span></div></>}
    </section>}

    {showConfirm && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><section className="confirm-modal"><p className="eyebrow">ก่อนส่งจริง</p><h2 id="confirm-title">ยืนยันสร้าง {selectedIdeas.length} งานใน Monday</h2><p>Board: <strong>{activeBoard.name}</strong> · Group: <strong>{activeGroup.label}</strong></p><div className="confirm-list">{selectedIdeas.map((idea, index) => <div key={idea.id}><span>{idea.id}</span><strong>{titleForMonday(client, planMonth, index + 1, idea)}</strong><time>{idea.date ? thaiDate(idea.date) : "ยังไม่มีวัน"}</time></div>)}</div><div className="modal-actions"><button className="button button-secondary" onClick={() => setShowConfirm(false)} type="button">กลับไปแก้</button><button className="button button-primary" onClick={confirmMonday} type="button">ยืนยันส่ง {selectedIdeas.length} งาน</button></div></section></div>}
    {showCompleteConfirm && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-plan-title"><section className="confirm-modal new-plan-modal"><p className="eyebrow">ปิดงานและเก็บเข้าคลัง</p><h2 id="complete-plan-title">ยืนยันว่าแผนนี้เสร็จเรียบร้อยแล้ว?</h2><p>ระบบจะย้ายงานนี้ออกจาก “งานระหว่างทำ” ไปอยู่ในคลัง พร้อมสไลด์ ภาพ mockup และข้อมูลสำหรับดาวน์โหลดซ้ำภายหลัง</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setShowCompleteConfirm(false)} type="button">ยังทำต่อ</button><button className="button button-primary" onClick={() => void completePlan()} type="button">ยืนยันปิดงานเข้าคลัง</button></div></section></div>}
    {showNewPlanConfirm && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-plan-title"><section className="confirm-modal new-plan-modal"><p className="eyebrow">เริ่มแผนใหม่</p><h2 id="new-plan-title">ต้องการทำกับแผนที่กำลังเปิดอยู่แบบไหน?</h2><p>ถ้าบันทึกแล้ว ร่างเดิมจะอยู่ในรายการให้กลับมาเปิดต่อได้เสมอ</p><div className="new-plan-choices"><button className="choice-card" type="button" onClick={async () => { await saveDraft("manual"); resetPlan(); }}><strong>บันทึกร่างนี้ แล้วเริ่มแผนใหม่</strong><span>เหมาะเมื่ออยากเก็บสิ่งที่แก้ล่าสุดไว้ก่อน</span></button><button className="choice-card danger" type="button" onClick={resetPlan}><strong>เริ่มแผนใหม่โดยไม่บันทึกการแก้ล่าสุด</strong><span>ร่างที่เคยบันทึกไว้จะไม่ถูกลบ แต่การแก้ครั้งนี้จะหายไป</span></button></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setShowNewPlanConfirm(false)} type="button">อยู่ทำแผนนี้ต่อ</button></div></section></div>}
  </main>;
}
