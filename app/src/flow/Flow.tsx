import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import type { Profil } from "../../../core/brand";
import { emptyMemory } from "../../../core/corrections";
import { manualTimeline } from "../../../core/edit";
import { paywallFor } from "../../../core/plans";
import { sanitizeTimeline } from "../../../core/timeline";
import { initDevice } from "../plans/device";
import { loadPlans, proHeader, record, savePlans, verdict, type Plans } from "../plans/state";
import { PaywallScreen } from "../screens/PaywallScreen";
import { createVisual } from "../visual/api";
import { montageStyle } from "../../../core/brand";
import { loadBrand, saveBrand } from "../brand/store";
import { EditorScreen } from "../screens/EditorScreen";
import { composeBrief } from "./brief";
import type { Brand as BrandDna } from "../brand/types";
import { DesignCatalogue } from "../screens/DesignCatalogue";
import { BriefScreen } from "../screens/BriefScreen";
import { GenerationScreen } from "../screens/GenerationScreen";
import { ImportScreen } from "../screens/ImportScreen";
import { MusicScreen } from "../screens/MusicScreen";
import { ResultScreen } from "../screens/ResultScreen";
import { ExportScreen } from "../screens/ExportScreen";
import { VisualBriefScreen } from "../screens/VisualBriefScreen";
import { VisualEditorScreen } from "../screens/VisualEditorScreen";
import type { VisualBrief } from "../../../core/design";
import type { Photo, VisualResult } from "../visual/api";
import { loadVisuals, saveVisual, type SavedVisual } from "../visual/store";
import { SAMPLE_RUSHES, fakeMontage } from "./fake";
import { Onboarding } from "./Onboarding";
import type { Brief, MontageResult, Music, Rush, Trade } from "./types";

type Step = "brand" | "import" | "brief" | "music" | "generation" | "result" | "editor" | "catalogue" | "visual" | "visual-editor" | "export" | "paywall";
// The brief's trade chips (lot 2) start from the sign-up profile.
const TRADE_OF: Record<Profil, Trade> = { commerce: "commerce", restaurant: "restaurant", "petite-entreprise": "artisan", "grande-entreprise": "freelance", ecole: "freelance", createur: "freelance", debutant: "freelance" };
const START_BRIEF: Brief = { text: "", trade: "restaurant", goal: null, tone: null, duration: 30, platforms: ["reels", "tiktok", "shorts"], cta: null };

// Sign-up first (lot 4: brand DNA), then the core path of lot 2: import → brief → music → generation →
// result, with sample data until the native module (Vision triage, AVFoundation preview) and the
// server are plugged in.
export function Flow() {
  const [step, setStep] = useState<Step>(() => typeof location !== "undefined" && location.hash === "#catalogue" ? "catalogue" : "import");
  const [brand, setBrand] = useState<BrandDna | null | undefined>(undefined);
  useEffect(() => { loadBrand().then(b => { setBrand(b); if (!b) setStep(s => (s === "catalogue" ? s : "brand")); else setBrief(x => ({ ...x, trade: TRADE_OF[b.profil] })); }); }, []);
  const [rushes, setRushes] = useState<Rush[]>(SAMPLE_RUSHES);
  const [demo, setDemo] = useState(true);
  const [selected, setSelected] = useState<string[]>(["r1", "r2", "r4", "r6", "r8"]);
  const [brief, setBrief] = useState<Brief>(START_BRIEF);
  const [music, setMusic] = useState<Music>({ choice: "trending", sound: null, fromLink: false, analysis: null, passage: null, length: 30, rightsAt: null, trendingTempo: 110 });
  const [incoming, setIncoming] = useState<{ uri: string } | null>(null);
  // A sound shared to Ma DA (AirDrop, Dictaphone, « Ouvrir avec ») opens the Music screen with it.
  const url = Linking.useLinkingURL();
  useEffect(() => { if (url?.startsWith("file:")) { setIncoming({ uri: url }); setMusic(m => ({ ...m, choice: "mine" })); setStep("music"); } }, [url]);
  const [result, setResult] = useState<{ r: MontageResult; s: number } | null>(null);
  const [editing, setEditing] = useState(0);
  // Visuals (lot 6): the ones kept on the iPhone, and the one being edited.
  const [visuals, setVisuals] = useState<SavedVisual[]>([]);
  useEffect(() => { loadVisuals().then(setVisuals); }, []);
  const [visual, setVisual] = useState<{ id: string; result: VisualResult; brief: VisualBrief; photos: Photo[] } | null>(null);
  // Subscription (lot 8): offers and counters, and the paywall with where it came from.
  const [plans, setPlans] = useState<Plans | null>(null);
  useEffect(() => { initDevice().then(loadPlans).then(p => { proHeader(p); setPlans(p); }); }, []);
  const updatePlans = (p: Plans) => { proHeader(p); setPlans(p); savePlans(p); };
  const [paywall, setPaywall] = useState<{ mode: "doux" | "bloquant"; back: Step; manual?: boolean; offline?: { brief: VisualBrief; photos: Photo[] } } | null>(null);
  const [keptVersion, setKeptVersion] = useState<number | null>(null);
  const chosen = selected.map(id => rushes.find(r => r.id === id)).filter((r): r is Rush => !!r);
  // Shots worth keeping light up during the wait; Vision will provide them (lot 2, native part).
  const kept = chosen.map((r, i) => (r.badges.includes("blur") || r.badges.includes("dark") ? -1 : i)).filter(i => i >= 0);

  if (brand === undefined && step !== "catalogue") return null;
  switch (step) {
    case "catalogue": return <DesignCatalogue />;
    case "brand": return <Onboarding initial={brand ?? null} onDone={b => { setBrand(b); setBrief(x => ({ ...x, trade: TRADE_OF[b.profil] })); setStep("import"); }} />;
    case "visual": return <VisualBriefScreen brand={brand ?? null} saved={visuals} initial={visual} onBack={() => setStep("import")}
      canAi={!plans || verdict(plans, "visuel").ok} onBlocked={(b, photos) => { setVisual(v => (v ? { ...v, brief: b, photos } : v)); setPaywall({ mode: "bloquant", back: "visual", offline: { brief: b, photos } }); setStep("paywall"); }}
      onCreated={(r, b, photos) => { if (plans && r.byAi) updatePlans(record(plans, "visuel")); setVisual({ id: Date.now().toString(36), result: r, brief: b, photos }); setStep("visual-editor"); }}
      onOpen={v => { setVisual({ id: v.id, result: { design: v.design, concept: "", relecture: [], byAi: true }, brief: v.brief, photos: v.photos }); setStep("visual-editor"); }} />;
    case "visual-editor": return visual ? <VisualEditorScreen key={visual.id} result={visual.result} brief={visual.brief} photos={visual.photos} brand={brand ?? null}
      onBack={() => setStep("visual")}
      onSave={d => { saveVisual({ id: visual.id, brief: visual.brief, design: d, photos: visual.photos, at: new Date().toISOString() }).then(setVisuals); setStep("visual"); }} /> : null;
    case "import": return <ImportScreen onBrand={() => setStep("brand")} onVisual={() => setStep("visual")} rushes={rushes} selected={selected} pro={!!plans?.pro} demo={demo}
      freeLeft={plans && !plans.pro ? verdict(plans, "montage").restant : null}
      onRushes={r => { setRushes(r); setDemo(false); }} onSelect={setSelected} onNext={() => setStep("brief")} />;
    case "brief": return <BriefScreen brief={brief} onChange={b => { setBrief(b); if (b.duration !== brief.duration) setMusic(m => ({ ...m, length: b.duration })); }} onBack={() => setStep("import")} onNext={() => setStep("music")} />;
    case "music": return <MusicScreen music={music} onChange={setMusic} briefDuration={brief.duration} incoming={incoming} onBack={() => setStep("brief")} onNext={() => {
      const v = plans && verdict(plans, "montage");
      if (plans && paywallFor("nouvelle_creation", { pro: plans.pro, seen: plans.paywallSeen, verdict: v ?? undefined }) === "bloquant") { setPaywall({ mode: "bloquant", back: "music", manual: true }); setStep("paywall"); }
      else setStep("generation");
    }} />;
    case "generation": return <GenerationScreen rushes={chosen.length} kept={kept} variants={3}
      run={(onStep, signal) => fakeMontage(chosen, brief, music, onStep, signal)}
      onDone={(r, s) => { if (plans) updatePlans(record(plans, "montage")); setKeptVersion(null); setResult({ r, s }); setStep("result"); }} onCancel={() => setStep("music")} />;
    case "result": return result ? <ResultScreen result={result.r} seconds={result.s} onBack={() => setStep("brief")} onRestart={() => { setResult(null); setStep("import"); }}
      onEdit={i => { setEditing(i); setStep("editor"); }} onExport={i => { setEditing(i); setStep("export"); }}
      kept={keptVersion} onKeep={i => {
        setKeptVersion(i);
        // Right after the first result the person keeps: the soft paywall, once (ch. 8 §1).
        if (plans && paywallFor("version_gardee", { pro: plans.pro, seen: plans.paywallSeen }) === "doux") { updatePlans({ ...plans, paywallSeen: true }); setPaywall({ mode: "doux", back: "result" }); setStep("paywall"); }
      }} /> : null;
    case "paywall": return plans && paywall ? <PaywallScreen plans={plans} mode={paywall.mode} onClose={() => setStep(paywall.back)}
      onPro={p => { updatePlans(p); setStep(paywall.back); }}
      onManual={paywall.manual ? () => {
        // The free way on: the rushes in order, then everything by hand (ch. 8 §2).
        const tl = manualTimeline(chosen.map(r => ({ id: r.id, duration: r.duration, photo: r.photo })), brief.duration, (raw, c) => sanitizeTimeline(raw, c).timeline);
        setResult({ r: { variantes: [{ timeline: tl, duration: tl.duree, warnings: [] }], cout_usd: 0, temps_s: 0 }, s: 0 }); setEditing(0); setStep("editor");
      } : undefined}
      onOffline={paywall.offline ? () => {
        const o = paywall.offline!;
        createVisual(o.brief, brand ?? null, o.photos, undefined, false).then(r => { setVisual({ id: Date.now().toString(36), result: r, brief: o.brief, photos: o.photos }); setStep("visual-editor"); });
      } : undefined} /> : null;
    case "export": {
      const v = result?.r.variantes[editing];
      return v ? <ExportScreen timeline={v.timeline} brief={composeBrief(brief)} brand={brand ?? null} onBack={() => setStep("result")}
        rushes={Object.fromEntries(chosen.flatMap(r => (r.uri ? [[r.id, r.uri]] : [])))} /> : null;
    }
    case "editor": {
      const v = result?.r.variantes[editing];
      if (!result || !v) return null;
      const memory = brand?.memory ?? emptyMemory();
      return <EditorScreen key={editing} timeline={v.timeline} brief={composeBrief(brief)}
        clips={Object.fromEntries(chosen.map(r => [r.id, { duration: r.duration }]))} bad={chosen.filter(r => r.badges.includes("blur") || r.badges.includes("dark")).map(r => r.id)}
        style={montageStyle(brand?.dna ?? null, memory.rules.map(r => r.text))} memory={memory}
        onMemory={m => { if (!brand) return; const b = { ...brand, memory: m }; setBrand(b); saveBrand(b); }}
        onBack={() => setStep("result")}
        onSave={tl => {
          const variantes = result.r.variantes.map((x, j) => (j === editing ? { ...x, timeline: tl, duration: tl.duree } : x));
          setResult({ ...result, r: { ...result.r, variantes } }); setStep("result");
        }} />;
    }
  }
}
