import { useState } from "react";
import { ArrowRight, FileCheck2, Play, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type EvidenceReelProps = {
  observedVolume: number;
  coordinatedShare: number;
  authenticConcern: string;
  contextCount: number;
  exposure: string;
  onStageResponse: () => void;
};

const acts = [
  {
    kicker: "ACT I · THE HOOK",
    title: "The room is loud.",
    icon: Radio,
    accent: "text-tally",
    body: "A signal storm arrives before anyone has the full scene.",
  },
  {
    kicker: "ACT II · THE REVEAL",
    title: "The loudest theory is not the question.",
    icon: FileCheck2,
    accent: "text-oyster",
    body: "The evidence points to a specific timeline gap worth answering.",
  },
  {
    kicker: "ACT III · THE GATE",
    title: "A response can still be contained.",
    icon: ShieldCheck,
    accent: "text-brass",
    body: "Only dated context, scoped reach, and a human signature can open the next scene.",
  },
];

export function EvidenceReel({
  observedVolume,
  coordinatedShare,
  authenticConcern,
  contextCount,
  exposure,
  onStageResponse,
}: EvidenceReelProps) {
  const [act, setAct] = useState(0);
  const current = acts[act];
  const Icon = current.icon;
  const isComplete = act === acts.length - 1;

  function advance() {
    if (isComplete) {
      onStageResponse();
      return;
    }
    setAct((value) => value + 1);
  }

  return (
    <section className="w-full max-w-2xl mt-8 border border-sepia/30 bg-velvet/10 p-5 sm:p-6 text-left relative overflow-hidden">
      <div className="absolute left-0 top-0 h-0.5 bg-tally transition-all duration-500" style={{ width: `${((act + 1) / acts.length) * 100}%` }} />
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <p className="font-system text-[11px] tracking-[0.18em] text-brass">THE EVIDENCE REEL</p>
          <p className="font-mono text-[10px] text-sepia mt-1">A SYNTHETIC CASE STUDY · {String(act + 1).padStart(2, "0")} / 03</p>
        </div>
        <span className="font-mono text-[10px] text-sepia">PLAYBACK {isComplete ? "READY" : "LIVE"}</span>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-center">
        <div className="flex gap-4">
          <div className={`w-11 h-11 border border-sepia/40 flex items-center justify-center shrink-0 ${current.accent}`}>
            <Icon size={18} strokeWidth={1.5} />
          </div>
          <div>
            <p className={`font-system text-xs tracking-[0.14em] ${current.accent}`}>{current.kicker}</p>
            <h2 className="font-serif text-2xl text-oyster mt-2 leading-tight">{current.title}</h2>
            <p className="font-sans text-sm text-oyster/70 mt-2 leading-relaxed">{current.body}</p>
          </div>
        </div>
        <Button variant="outline" onClick={advance} className="min-w-44 border-sepia/50 hover:border-oyster hover:bg-oyster/10">
          {act === 0 ? <Play size={14} /> : isComplete ? <ArrowRight size={14} /> : <ArrowRight size={14} />}
          <span>{act === 0 ? "ROLL THE REEL" : isComplete ? "STAGE RESPONSE" : "NEXT ACT"}</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-sepia/20 mt-6">
        <EvidenceStat label="OBSERVED" value={observedVolume.toLocaleString()} />
        <EvidenceStat label="COORD. LIKELIHOOD" value={`${Math.round(coordinatedShare * 100)}%`} />
        <EvidenceStat label="DATED SOURCES" value={String(contextCount)} />
        <EvidenceStat label="EXPOSURE" value={exposure.split(" — ")[0]} />
      </div>

      <div className="mt-5 border-l border-brass/50 pl-4">
        <p className="font-system text-[10px] tracking-[0.12em] text-sepia">WHAT THE EVIDENCE ACTUALLY SAYS</p>
        <p className="font-sans text-sm text-oyster/85 mt-2 leading-relaxed">{authenticConcern}</p>
      </div>
    </section>
  );
}

function EvidenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-house/80 p-3 min-w-0">
      <p className="font-system text-[9px] text-sepia tracking-[0.1em] truncate">{label}</p>
      <p className="font-mono text-sm text-oyster mt-1 truncate">{value}</p>
    </div>
  );
}