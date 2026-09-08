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
    bg: "bg-tally/10",
    border: "border-tally/30",
    body: "A signal storm arrives before anyone has the full scene.",
  },
  {
    kicker: "ACT II · THE REVEAL",
    title: "The loudest theory is not the question.",
    icon: FileCheck2,
    accent: "text-oyster",
    bg: "bg-oyster/10",
    border: "border-oyster/30",
    body: "The evidence points to a specific timeline gap worth answering.",
  },
  {
    kicker: "ACT III · THE GATE",
    title: "A response can still be contained.",
    icon: ShieldCheck,
    accent: "text-brass",
    bg: "bg-brass/10",
    border: "border-brass/30",
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
    <section className="w-full mt-4 border border-sepia/30 bg-house/80 p-5 sm:p-8 text-left relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-xl">
      <div className="absolute left-0 top-0 h-1 bg-brass transition-all duration-700 ease-out" style={{ width: `${((act + 1) / acts.length) * 100}%` }} />
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-sepia/20">
        <div>
          <p className="font-system text-xs tracking-[0.2em] text-brass">THE EVIDENCE REEL</p>
          <p className="font-mono text-[10px] text-sepia mt-1.5">A SYNTHETIC CASE STUDY · {String(act + 1).padStart(2, "0")} / 03</p>
        </div>
        <span className="font-mono text-[10px] text-sepia bg-house px-3 py-1.5 border border-sepia/20">PLAYBACK {isComplete ? "READY" : "LIVE"}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8 mb-8">
        <div className="flex gap-4 sm:gap-6 flex-1">
          <div className={`w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center shrink-0 border ${current.bg} ${current.border} ${current.accent} shadow-inner`}>
            <Icon size={24} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className={`font-system text-[10px] sm:text-xs tracking-[0.2em] ${current.accent}`}>{current.kicker}</p>
            <h2 className="font-serif text-2xl sm:text-3xl text-oyster mt-2 leading-tight">{current.title}</h2>
            <p className="font-sans text-sm text-oyster/70 mt-3 leading-relaxed max-w-lg">{current.body}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={advance} 
          className={`shrink-0 w-full sm:w-48 h-12 border-sepia/50 hover:border-oyster hover:bg-oyster/10 tracking-[0.15em] transition-all duration-300 ${isComplete ? "bg-brass text-house hover:bg-white border-transparent" : "bg-house"}`}
        >
          <div className="flex items-center gap-2">
            {act === 0 ? <Play size={14} className="fill-current" /> : isComplete ? <ArrowRight size={14} /> : <ArrowRight size={14} />}
            <span>{act === 0 ? "ROLL REEL" : isComplete ? "STAGE RESPONSE" : "NEXT ACT"}</span>
          </div>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-sepia/30 mt-8 mb-6 border border-sepia/20">
        <EvidenceStat label="OBSERVED" value={observedVolume.toLocaleString()} />
        <EvidenceStat label="COORD. LIKELIHOOD" value={`${Math.round(coordinatedShare * 100)}%`} />
        <EvidenceStat label="DATED SOURCES" value={String(contextCount)} />
        <EvidenceStat label="EXPOSURE" value={exposure.split(" — ")[0]} />
      </div>

      <div className="mt-8 border-l-2 border-brass/50 pl-5 bg-gradient-to-r from-brass/5 to-transparent py-4">
        <p className="font-system text-[10px] tracking-[0.2em] text-brass mb-2">WHAT THE EVIDENCE ACTUALLY SAYS</p>
        <p className="font-sans text-sm sm:text-base text-oyster/90 leading-relaxed max-w-2xl">{authenticConcern}</p>
      </div>
    </section>
  );
}

function EvidenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-house/90 p-4 sm:p-5 min-w-0 transition-colors hover:bg-house">
      <p className="font-system text-[9px] text-sepia tracking-[0.15em] truncate mb-2">{label}</p>
      <p className="font-mono text-sm sm:text-lg text-oyster truncate">{value}</p>
    </div>
  );
}