import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import type { Profil } from "../../../core/brand";
import { emptyMemory } from "../../../core/corrections";
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
import { SAMPLE_RUSHES, fakeMontage } from "./fake";
import { Onboarding } from "./Onboarding";
import type { Brief, MontageResult, Music, Rush, Trade } from "./types";

type Step = "brand" | "import" | "brief" | "music" | "generation" | "result" | "editor" | "catalogue";
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
  const chosen = selected.map(id => rushes.find(r => r.id === id)).filter((r): r is Rush => !!r);
  // Shots worth keeping light up during the wait; Vision will provide them (lot 2, native part).
  const kept = chosen.map((r, i) => (r.badges.includes("blur") || r.badges.includes("dark") ? -1 : i)).filter(i => i >= 0);

  if (brand === undefined && step !== "catalogue") return null;
  switch (step) {
    case "catalogue": return <DesignCatalogue />;
    case "brand": return <Onboarding initial={brand ?? null} onDone={b => { setBrand(b); setBrief(x => ({ ...x, trade: TRADE_OF[b.profil] })); setStep("import"); }} />;
    case "import": return <ImportScreen onBrand={() => setStep("brand")} rushes={rushes} selected={selected} pro={false} demo={demo}
      onRushes={r => { setRushes(r); setDemo(false); }} onSelect={setSelected} onNext={() => setStep("brief")} />;
    case "brief": return <BriefScreen brief={brief} onChange={b => { setBrief(b); if (b.duration !== brief.duration) setMusic(m => ({ ...m, length: b.duration })); }} onBack={() => setStep("import")} onNext={() => setStep("music")} />;
    case "music": return <MusicScreen music={music} onChange={setMusic} briefDuration={brief.duration} incoming={incoming} onBack={() => setStep("brief")} onNext={() => setStep("generation")} />;
    case "generation": return <GenerationScreen rushes={chosen.length} kept={kept} variants={3}
      run={(onStep, signal) => fakeMontage(chosen, brief, music, onStep, signal)}
      onDone={(r, s) => { setResult({ r, s }); setStep("result"); }} onCancel={() => setStep("music")} />;
    case "result": return result ? <ResultScreen result={result.r} seconds={result.s} onBack={() => setStep("brief")} onRestart={() => { setResult(null); setStep("import"); }}
      onEdit={i => { setEditing(i); setStep("editor"); }} /> : null;
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
