import { useState } from "react";
import type { Answers, Dna, Kit, Profil } from "../../../core/brand";
import { emptyMemory, type Memory } from "../../../core/corrections";
import { writeDna } from "../brand/api";
import type { Logo } from "../brand/logo";
import { saveBrand } from "../brand/store";
import { emptyKit, type Brand } from "../brand/types";
import { AnalysisScreen } from "../screens/AnalysisScreen";
import { CarnetScreen } from "../screens/CarnetScreen";
import { LogoScreen } from "../screens/LogoScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { QuestionsScreen } from "../screens/QuestionsScreen";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { SERVER } from "./server";

type Step = "welcome" | "profile" | "questions" | "logo" | "analysis" | "carnet";

// Sign-up (lot 4) : welcome → profile → questions → logo → one AI analysis → carnet. Starting again
// keeps the answers, so « Refaire le questionnaire » only asks to change what is wrong.
export function Onboarding({ initial, onDone }: { initial: Brand | null; onDone: (b: Brand) => void }) {
  const [step, setStep] = useState<Step>(initial?.dna ? "carnet" : initial ? "profile" : "welcome");
  const [profil, setProfil] = useState<Profil | null>(initial?.profil ?? null);
  const [answers, setAnswers] = useState<Answers>(initial?.answers ?? {});
  const [kit, setKit] = useState<Kit>(initial?.kit ?? emptyKit());
  const [logo, setLogo] = useState<Logo | null>(null);
  const [result, setResult] = useState<{ dna: Dna; byAi: boolean } | null>(initial?.dna ? { dna: initial.dna, byAi: initial.byAi } : null);
  const [saveError, setSaveError] = useState(false);
  const [memory, setMemory] = useState<Memory>(initial?.memory ?? emptyMemory());
  const brand = (dna: Dna | null, byAi: boolean): Brand => ({ profil: profil!, answers, kit, logoUri: logo?.uri ?? initial?.logoUri ?? null, dna, byAi, at: new Date().toISOString(), memory });

  switch (step) {
    case "welcome": return <WelcomeScreen onStart={() => setStep("profile")} />;
    case "profile": return <ProfileScreen profil={profil} onChange={setProfil} onBack={() => setStep("welcome")} onNext={() => setStep("questions")} />;
    case "questions": return <QuestionsScreen profil={profil!} answers={answers} onChange={setAnswers} onBack={() => setStep("profile")} onDone={() => setStep("logo")} />;
    case "logo": return <LogoScreen kit={kit} logo={logo} onChange={(k, l) => { setKit(k); setLogo(l); }} onBack={() => setStep("questions")} onNext={() => setStep("analysis")} />;
    case "analysis": return <AnalysisScreen onDone={() => setStep("carnet")}
      run={async signal => setResult(await writeDna(brand(null, false), logo?.forAi ?? "", SERVER.url, signal, SERVER.access))} />;
    case "carnet": return result ? <CarnetScreen dna={result.dna} byAi={result.byAi} saveError={saveError} memory={memory} onMemory={setMemory}
      onChange={dna => setResult({ ...result, dna })} onRedo={() => setStep("profile")}
      onDone={async () => {
        const b = brand(result.dna, result.byAi);
        const ok = await saveBrand(b);
        setSaveError(!ok);
        if (ok) onDone(b);
      }} /> : null;
  }
}
