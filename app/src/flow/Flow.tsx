import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "../design";
import { useEffect, useState, type ReactNode } from "react";
import { fr } from "../copy/fr";
import type { Profil } from "../../../core/brand";
import { emptyMemory } from "../../../core/corrections";
import { manualTimeline } from "../../../core/edit";
import { paywallFor } from "../../../core/plans";
import { sanitizeTimeline } from "../../../core/timeline";
import { aiAllowed, consent, loadConsent, setConsent } from "../consent";
import { initDevice } from "../plans/device";
import { ConsentScreen } from "../screens/ConsentScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { videoSources } from "../video/sources";
import { loadPlans, proHeader, record, savePlans, verdict, type Plans } from "../plans/state";
import { PaywallScreen } from "../screens/PaywallScreen";
import { createVisual } from "../visual/api";
import { charteOf, montageStyle } from "../../../core/brand";
import { loadBrand, saveBrand } from "../brand/store";
import { EditorScreen } from "../screens/EditorScreen";
import { composeBrief } from "./brief";
import type { Brand as BrandDna } from "../brand/types";
import { DesignCatalogue } from "../screens/DesignCatalogue";
import { BriefScreen } from "../screens/BriefScreen";
import { GenerationScreen } from "../screens/GenerationScreen";
import { ImportScreen } from "../screens/ImportScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { CreationsScreen } from "../screens/CreationsScreen";
import { IdeasScreen } from "../screens/IdeasScreen";
import { Tabs, type CreateChoice, type Tab } from "./Tabs";
import { creationsOf, type Creation } from "../creations/Tile";
import { deleteReel, loadReels, loadRefusals, saveReel, saveRefusals, type SavedReel } from "../creations/store";
import { dayOf, ideaOfTheDay, refuse, weekPlan, type Refusals } from "../../../core/week";
import type { Idee } from "../../../core/brand";
import { MusicScreen } from "../screens/MusicScreen";
import { ResultScreen } from "../screens/ResultScreen";
import { ExportScreen } from "../screens/ExportScreen";
import { VisualBriefScreen } from "../screens/VisualBriefScreen";
import { VisualEditorScreen } from "../screens/VisualEditorScreen";
import type { VisualBrief } from "../../../core/design";
import type { Photo, VisualResult } from "../visual/api";
import { deleteVisual, loadVisuals, saveVisual, type SavedVisual } from "../visual/store";
import { SAMPLE_RUSHES, fakeMontage } from "./fake";
import { streamMontage } from "./api";
import { aiUrl } from "./server";
import { canTriage, montageBody, triageRush } from "./triage";
import { Onboarding } from "./Onboarding";
import { clearDraft, loadDraft, saveDraft, type FlowDraft } from "./draft";
import type { Draft } from "../../../core/draft";
import type { TimelineV1 } from "../../../core/timeline";
import { tokens, useToast } from "../design";
import type { Brief, MontageResult, Music, Rush, Trade } from "./types";

type Step = "home" | "creations" | "ideas" | "brand" | "import" | "brief" | "music" | "generation" | "result" | "editor" | "catalogue" | "visual" | "visual-editor" | "export" | "paywall" | "consent" | "settings";
// The brief's trade chips (lot 2) start from the sign-up profile.
const TRADE_OF: Record<Profil, Trade> = { commerce: "commerce", restaurant: "restaurant", "petite-entreprise": "artisan", "grande-entreprise": "freelance", ecole: "freelance", createur: "freelance", debutant: "freelance" };
const START_BRIEF: Brief = { text: "", trade: "restaurant", goal: null, tone: null, duration: 30, platforms: ["reels", "tiktok", "shorts"], cta: null };

// Sign-up first (lot 4: brand DNA), then the core path of lot 2: import → brief → music → generation →
// result, with sample data until the native module (Vision triage, AVFoundation preview) and the
// server are plugged in.
export function Flow() {
  const [step, setStep] = useState<Step>(() => typeof location !== "undefined" && location.hash === "#catalogue" ? "catalogue" : "home");
  const [brand, setBrand] = useState<BrandDna | null | undefined>(undefined);
  useEffect(() => { Promise.all([loadBrand(), loadConsent()]).then(([b]) => { setBrand(b); if (!b) setStep(s => (s === "catalogue" ? s : "brand")); else setBrief(x => ({ ...x, trade: TRADE_OF[b.profil] })); }); }, []);
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
  // The editor's unsaved state, and the draft found at launch (étude de la refonte : « Ne jamais rien perdre »).
  const [editorTl, setEditorTl] = useState<TimelineV1 | null>(null);
  const [draft, setDraft] = useState<Draft<FlowDraft> | null>(null);
  useEffect(() => { loadDraft().then(setDraft); }, []);
  // Créations and Idées (étape 2 de la refonte): the saved Reels, the ideas refused for a month, the
  // id of the Reel on screen so each save updates the same creation, and a visual started from an idea.
  const [reels, setReels] = useState<SavedReel[]>([]);
  const [refusals, setRefusals] = useState<Refusals>({});
  useEffect(() => { loadReels().then(setReels); loadRefusals().then(setRefusals); }, []);
  const [reelId, setReelId] = useState(() => Date.now().toString(36));
  const [manualMode, setManualMode] = useState(false);
  const [seed, setSeed] = useState<{ brief: VisualBrief; photos: Photo[] } | null>(null);
  const toast = useToast();
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
  // The AI permission (lot 9), asked where it is first needed, with where each answer leads.
  const [ask, setAsk] = useState<{ back: Step; yes: () => void; no: () => void } | null>(null);
  const askConsent = (back: Step, yes: () => void, no: () => void) => { setAsk({ back, yes, no }); setStep("consent"); };
  // Each new rush is measured on the iPhone as soon as it is picked (Vision, lot 2 native part).
  useEffect(() => {
    if (!canTriage()) return;
    for (const r of rushes.filter(x => x.uri && !x.triage)) {
      triageRush(r).then(t => setRushes(list => list.map(x => (x.id === t.id ? t : x)))).catch(() => {});
    }
  }, [rushes]);
  // Saved a moment after each change while a Reel is in progress; the home offers to pick it up.
  useEffect(() => {
    saveDraft(step, { rushes, selected, demo, brief, music, result, editing, keptVersion, editorTimeline: editorTl }, tokens.motion.autosave);
  }, [step, rushes, selected, demo, brief, music, result, editing, keptVersion, editorTl]);
  const resume = (d: Draft<FlowDraft>) => {
    const x = d.data;
    setRushes(x.rushes); setSelected(x.selected); setDemo(x.demo); setBrief(x.brief); setMusic(x.music);
    setResult(x.result); setEditing(x.editing); setKeptVersion(x.keptVersion); setEditorTl(x.editorTimeline);
    setDraft(null);
    // Without a result (an older draft), the steps after it fall back to the music.
    setStep(!x.result && (d.step === "result" || d.step === "editor" || d.step === "export") ? "music" : d.step);
  };
  const keepReel = (timeline: TimelineV1) => saveReel({ id: reelId, at: new Date().toISOString(), timeline, byAi: !result?.r.manuel, rushes: chosen, selected }).then(setReels);
  const newReel = (text = "") => {
    setDraft(null); setResult(null); setEditorTl(null); setKeptVersion(null); setManualMode(false); setReelId(Date.now().toString(36));
    setBrief(b => ({ ...b, text })); setStep("import");
  };
  const startIdea = (i: Idee) => {
    if (i.format === "reel" || i.format === "story") return newReel(i.titre);
    setVisual(null); setSeed({ brief: { kind: i.format === "affiche" ? "affiche" : "post", idee: i.titre, infos: {} }, photos: [] });
    consent() ? setStep("visual") : askConsent("home", () => setStep("visual"), () => setStep("visual"));
  };
  const openCreation = (x: Creation) => {
    if (x.kind === "visual") { const v = x.visual; setVisual({ id: v.id, result: { design: v.design, concept: "", relecture: [], byAi: true }, brief: v.brief, photos: v.photos }); setStep("visual-editor"); return; }
    const r = x.reel;
    setRushes(r.rushes); setSelected(r.selected); setDemo(false); setReelId(r.id); setEditorTl(null); setKeptVersion(0);
    setResult({ r: { variantes: [{ timeline: r.timeline, duration: r.timeline.duree, warnings: [] }], cout_usd: 0, temps_s: 0, manuel: !r.byAi }, s: 0 });
    setEditing(0); setStep("result");
  };
  const duplicate = (x: Creation) => {
    const id = Date.now().toString(36), at = new Date().toISOString();
    if (x.kind === "reel") saveReel({ ...x.reel, id, at, timeline: { ...x.reel.timeline, titre: fr.creations.copyOf(x.reel.timeline.titre) } }).then(setReels);
    else saveVisual({ ...x.visual, id, at }).then(setVisuals);
    toast({ message: fr.creations.duplicated });
  };
  const remove = (x: Creation) => {
    if (x.kind === "reel") deleteReel(x.id).then(setReels); else deleteVisual(x.id).then(setVisuals);
    toast({ message: fr.creations.deleted, action: fr.nav.undo, onAction: () => (x.kind === "reel" ? saveReel(x.reel).then(setReels) : saveVisual(x.visual).then(setVisuals)) });
  };
  const create = (k: CreateChoice) => {
    if (k === "reel") newReel();
    else if (k === "manual") { newReel(); setManualMode(true); }
    else if (k === "visual") { setSeed(null); setVisual(null); consent() ? setStep("visual") : askConsent("home", () => setStep("visual"), () => setStep("visual")); }
    else setStep("ideas");
  };
  const plan = weekPlan(brand?.dna?.idees ?? [], refusals, new Date());
  const creations = creationsOf(reels, visuals);
  const tabs = (tab: Tab, child: ReactNode) => <Tabs tab={tab} onTab={x => setStep(x)} onCreate={create}>{child}</Tabs>;
  const chosen = selected.map(id => rushes.find(r => r.id === id)).filter((r): r is Rush => !!r);
  // Shots worth keeping light up during the wait; Vision will provide them (lot 2, native part).
  const kept = chosen.map((r, i) => (r.badges.includes("blur") || r.badges.includes("dark") ? -1 : i)).filter(i => i >= 0);

  // The free way on: the rushes in order, then everything by hand (ch. 8 §2).
  const manual = () => {
    const tl = manualTimeline(chosen.map(r => ({ id: r.id, duration: r.duration, photo: r.photo })), brief.duration, (raw, c) => sanitizeTimeline(raw, c).timeline);
    setResult({ r: { variantes: [{ timeline: tl, duration: tl.duree, warnings: [] }], cout_usd: 0, temps_s: 0, manuel: true }, s: 0 }); setEditing(0); setStep("editor");
  };

  if (brand === undefined && step !== "catalogue") return null;
  switch (step) {
    case "catalogue": return <DesignCatalogue />;
    case "brand": return <Onboarding initial={brand ?? null} onLater={() => setStep("home")} onDone={b => { setBrand(b); setBrief(x => ({ ...x, trade: TRADE_OF[b.profil] })); setStep("home"); }} />;
    case "home": return tabs("home", <HomeScreen brand={brand ?? null} plan={plan} today={ideaOfTheDay(plan, new Date())} recents={creations}
      made={[...new Set(creations.map(x => dayOf(x.at)))]} freeLeft={plans && !plans.pro ? verdict(plans, "montage").restant : null}
      draft={draft} onResume={() => draft && resume(draft)}
      onIdea={p => (p ? startIdea(p.idee) : newReel())} onMoreIdeas={() => setStep("ideas")} onBrand={() => setStep("brand")}
      onSettings={() => setStep("settings")} onOpen={openCreation} onSeeAll={() => setStep("creations")} />);
    case "creations": return tabs("creations", <CreationsScreen items={creations} brand={brand ?? null} onOpen={openCreation} onDuplicate={duplicate} onDelete={remove} onNew={() => newReel()} />);
    case "ideas": return tabs("ideas", <IdeasScreen plan={plan} ideas={brand?.dna?.idees ?? []} pillars={brand?.dna?.piliers ?? []} hasBrand={!!brand?.dna}
      onMake={startIdea} onBrand={() => setStep("brand")}
      onRefuse={i => { const r = refuse(refusals, i, new Date()); setRefusals(r); saveRefusals(r); toast({ message: fr.ideas.refused, action: fr.nav.undo, onAction: () => { setRefusals(refusals); saveRefusals(refusals); } }); }} />);
    case "visual": return <VisualBriefScreen brand={brand ?? null} saved={visuals} initial={visual ?? seed} onBack={() => setStep("home")}
      canAi={!plans || verdict(plans, "visuel").ok} onBlocked={(b, photos) => { setVisual(v => (v ? { ...v, brief: b, photos } : v)); setPaywall({ mode: "bloquant", back: "visual", offline: { brief: b, photos } }); setStep("paywall"); }}
      onCreated={(r, b, photos) => { if (plans && r.byAi) updatePlans(record(plans, "visuel")); setVisual({ id: Date.now().toString(36), result: r, brief: b, photos }); setStep("visual-editor"); }}
      onOpen={v => { setVisual({ id: v.id, result: { design: v.design, concept: "", relecture: [], byAi: true }, brief: v.brief, photos: v.photos }); setStep("visual-editor"); }} />;
    case "visual-editor": return visual ? <VisualEditorScreen key={visual.id} result={visual.result} brief={visual.brief} photos={visual.photos} brand={brand ?? null}
      onBack={() => setStep("visual")}
      onSave={d => { saveVisual({ id: visual.id, brief: visual.brief, design: d, photos: visual.photos, at: new Date().toISOString() }).then(setVisuals); setStep("visual"); }} /> : null;
    case "import": return <ImportScreen onBack={() => setStep("home")} rushes={rushes} selected={selected} pro={!!plans?.pro} demo={demo}
      onRushes={r => { setRushes(r); setDemo(false); }} onSelect={setSelected} onNext={() => (manualMode ? manual() : setStep("brief"))} />;
    case "brief": return <BriefScreen brief={brief} onChange={b => { setBrief(b); if (b.duration !== brief.duration) setMusic(m => ({ ...m, length: b.duration })); }} onBack={() => setStep("import")} onNext={() => setStep("music")} />;
    case "music": return <MusicScreen music={music} onChange={setMusic} briefDuration={brief.duration} incoming={incoming} onBack={() => setStep("brief")} onNext={() => {
      const v = plans && verdict(plans, "montage");
      if (plans && paywallFor("nouvelle_creation", { pro: plans.pro, seen: plans.paywallSeen, verdict: v ?? undefined }) === "bloquant") { setPaywall({ mode: "bloquant", back: "music", manual: true }); setStep("paywall"); }
      else if (!aiAllowed()) askConsent("music", () => setStep("generation"), manual);
      else setStep("generation");
    }} />;
    case "generation": return <GenerationScreen rushes={chosen.length} kept={kept} variants={3}
      run={(onStep, signal) => {
        // The real montage once the iPhone has measured the rushes and the person agreed to the AI;
        // the sample answer otherwise (web preview, no server).
        const url = aiUrl();
        if (!url || demo || !chosen.every(r => r.triage)) return fakeMontage(chosen, brief, music, onStep, signal, undefined, charteOf(brand?.dna ?? null, !!brand?.logoUri));
        onStep(1);
        return montageBody(chosen, brief, music, brand ?? null, brand?.memory?.rules.map(r => r.text) ?? []).then(body => streamMontage(url, body, onStep, signal));
      }}
      onDone={(r, s) => { if (plans) updatePlans(record(plans, "montage")); setKeptVersion(null); setReelId(Date.now().toString(36)); setResult({ r, s }); setStep("result"); }} onCancel={() => setStep("music")} />;
    case "result": return result ? <ResultScreen result={result.r} seconds={result.s} onBack={() => setStep("brief")} onRestart={() => { setResult(null); setEditorTl(null); clearDraft(); setStep("home"); }}
      sources={i => videoSources(result.r.variantes[i].timeline, chosen, brand ?? null, music)}
      onEdit={i => { setEditing(i); setStep("editor"); }} onExport={i => { setEditing(i); keepReel(result.r.variantes[i].timeline); setStep("export"); }}
      kept={keptVersion} onKeep={i => {
        setKeptVersion(i); keepReel(result.r.variantes[i].timeline);
        // Right after the first result the person keeps: the soft paywall, once (ch. 8 §1).
        if (plans && paywallFor("version_gardee", { pro: plans.pro, seen: plans.paywallSeen }) === "doux") { updatePlans({ ...plans, paywallSeen: true }); setPaywall({ mode: "doux", back: "result" }); setStep("paywall"); }
      }} /> : null;
    case "paywall": return plans && paywall ? <PaywallScreen plans={plans} mode={paywall.mode} onClose={() => setStep(paywall.back)}
      onPro={p => { updatePlans(p); setStep(paywall.back); }}
      onManual={paywall.manual ? manual : undefined}
      onOffline={paywall.offline ? () => {
        const o = paywall.offline!;
        createVisual(o.brief, brand ?? null, o.photos, undefined, false).then(r => { setVisual({ id: Date.now().toString(36), result: r, brief: o.brief, photos: o.photos }); setStep("visual-editor"); });
      } : undefined} /> : null;
    case "consent": return ask ? <ConsentScreen onBack={() => setStep(ask.back)} onAnswer={ok => setConsent(ok).then(() => (ok ? ask.yes() : ask.no()))} /> : null;
    case "settings": return <SettingsScreen plans={plans} onPlans={updatePlans} onBack={() => setStep("home")}
      onDeleted={() => { setBrand(null); setVisuals([]); setVisual(null); setResult(null); setStep("brand"); }} />;
    case "export": {
      const v = result?.r.variantes[editing];
      return v ? <ExportScreen timeline={v.timeline} byAi={!result?.r.manuel} brief={composeBrief(brief)} brand={brand ?? null} onBack={() => setStep("result")}
        sources={() => videoSources(v.timeline, chosen, brand ?? null, music)} /> : null;
    }
    case "editor": {
      const v = result?.r.variantes[editing];
      if (!result || !v) return null;
      const memory = brand?.memory ?? emptyMemory();
      // The editor stays dark in « Atelier clair »: footage is judged on a dark ground.
      return <ThemeProvider initial="dark"><StatusBar style="light" /><EditorScreen key={editing} timeline={editorTl ?? v.timeline} onChange={setEditorTl} brief={composeBrief(brief)}
        clips={Object.fromEntries(chosen.map(r => [r.id, { duration: r.duration }]))} bad={chosen.filter(r => r.badges.includes("blur") || r.badges.includes("dark")).map(r => r.id)}
        style={montageStyle(brand?.dna ?? null, memory.rules.map(r => r.text))} memory={memory}
        onMemory={m => { if (!brand) return; const b = { ...brand, memory: m }; setBrand(b); saveBrand(b); }}
        onBack={() => { setEditorTl(null); setStep("result"); }}
        onSave={tl => {
          const variantes = result.r.variantes.map((x, j) => (j === editing ? { ...x, timeline: tl, duration: tl.duree } : x));
          setResult({ ...result, r: { ...result.r, variantes } }); setEditorTl(null); keepReel(tl); setStep("result");
        }} /></ThemeProvider>;
    }
  }
}
