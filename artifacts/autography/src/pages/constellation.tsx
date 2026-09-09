import { useGetFlood } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoadingPanel, ErrorPanel } from "@/components/states";

export function Constellation() {
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("producer");
  const [activePulseId, setActivePulseId] = useState<string | null>(null);
  const [source, setSource] = useState<"fixture" | "live">("fixture");
  
  const { data: flood, isLoading, error, refetch } = useGetFlood({ source }, {
    query: { queryKey: ["/api/flood", source], staleTime: 15_000, refetchInterval: source === "live" ? 15_000 : false }
  });

  if (isLoading) {
    return <LoadingPanel text="READING SIGNAL" />;
  }
  
  if (error) {
    return <ErrorPanel error={error as Error} onRetry={() => refetch()} message="Could not read the signal room stream." />;
  }

  if (!flood) return null;

  const selectedCluster = flood.clusters.find(c => c.id === selectedClusterId);
  const currentRole = flood.role_permissions.find(role => role.role === selectedRole) ?? flood.role_permissions[0];
  const activePulse = flood.timeline.find(pulse => pulse.id === activePulseId);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-house relative overflow-x-hidden">
      <header className="px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-6 border-b border-sepia/30 bg-house/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="font-system text-tally text-xs tracking-[0.2em] mb-3">SIGNAL ROOM / LIVE AUDIENCE DYNAMICS</div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-oyster leading-tight">The room, with the volume turned down.</h1>
            <p className="font-sans text-sm text-oyster/60 mt-3 max-w-2xl leading-relaxed">
              A de-amplified view of what is moving, what is supported, and what should stay in a human hold.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 shrink-0">
            <div className="flex border border-sepia/30 bg-house">
              {(["fixture", "live"] as const).map((option) => (
                <button key={option} onClick={() => { setSource(option); setSelectedClusterId(null); setActivePulseId(null); }} className={cn(
                  "font-system text-[10px] tracking-[0.12em] px-3 sm:px-4 py-2.5 transition-colors focus-visible:outline-none focus-visible:bg-brass/20 flex-1 sm:flex-none whitespace-nowrap",
                  source === option ? "bg-brass/15 text-brass border-b-2 border-brass" : "text-sepia hover:text-oyster border-b-2 border-transparent",
                )}>
                  {option === "fixture" ? "SYNTHETIC FIXTURE" : "APPROVED LIVE SOURCE"}
                </button>
              ))}
            </div>
            <div className="font-mono text-[9px] text-sepia text-right hidden sm:block">
              {source === "live" ? "CONSENTED NEWSROOM / IDENTITY UNAVAILABLE" : "DEMO RECOVERY PATH / SYNTHETIC"}
            </div>
          </div>
        </div>
        <div className="mt-7 flex flex-col xl:flex-row gap-6 xl:items-end">
          <div className="flex-1 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="font-system text-[10px] tracking-[0.16em] text-sepia mb-3">EPISODE TIMELINE · CLICK A PULSE TO INSPECT</div>
            <div className="flex items-end gap-2 h-20 min-w-[600px]">
              {flood.timeline.map((pulse) => {
                const isActive = activePulseId === pulse.id;
                return (
                  <button
                    key={pulse.id}
                    onClick={() => {
                      setActivePulseId(pulse.id);
                      setSelectedClusterId(pulse.cluster_id);
                    }}
                    className="group flex-1 min-w-[3.5rem] h-full flex flex-col justify-end gap-2 text-left focus-visible:outline-none"
                    aria-label={`Inspect ${pulse.label}`}
                  >
                    <div className={cn(
                      "relative h-12 w-full border-l transition-colors",
                      isActive ? "border-oyster" : "border-sepia/30 group-hover:border-oyster/60"
                    )}>
                      <span
                        className={`absolute bottom-0 left-0 w-full transition-all duration-500 ${isActive ? "bg-tally" : "bg-brass/40 group-hover:bg-brass"}`}
                        style={{ height: `${Math.max(16, pulse.intensity * 100)}%` }}
                      />
                    </div>
                    <span className={`font-system text-[9px] sm:text-[10px] truncate w-full ${isActive ? "text-oyster" : "text-sepia"}`}>{pulse.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="xl:w-80 xl:border-l border-t xl:border-t-0 border-sepia/30 pt-4 xl:pt-0 xl:pl-5 shrink-0">
            <div className="font-system text-[10px] tracking-[0.16em] text-sepia mb-3">ROOM LENS</div>
            <div className="flex flex-wrap gap-2">
              {flood.role_permissions.map((role) => (
                <button
                  key={role.role}
                  onClick={() => setSelectedRole(role.role)}
                  className={cn(
                    "font-system text-[10px] tracking-[0.08em] px-3 py-2 border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass",
                    selectedRole === role.role
                      ? "border-brass text-brass bg-brass/10"
                      : "border-sepia/30 text-sepia hover:text-oyster hover:border-oyster/50 bg-house/50",
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
            {currentRole && (
              <p className="font-mono text-[10px] text-oyster/60 mt-3 leading-relaxed">
                EMPHASIS / {currentRole.emphasis.join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-sepia/20 pt-4">
          <p className="font-mono text-[9px] sm:text-[10px] text-sepia">{flood.data_notice}</p>
          {activePulse && (
            <p className="font-mono text-[9px] sm:text-[10px] text-brass bg-brass/10 px-2 py-1 border border-brass/20">SELECTED / {activePulse.freshness} / {activePulse.confidence} confidence</p>
          )}
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] min-h-[620px] border-b border-sepia/30">
      
        {/* Map Area */}
        <div className="relative overflow-hidden flex items-center justify-center p-4 sm:p-8 min-h-[400px] sm:min-h-[520px]">
          
          <div className="relative w-full max-w-4xl aspect-square sm:aspect-video flex flex-wrap gap-4 sm:gap-6 items-center justify-center content-center z-10 p-4">
            {flood.clusters.map((cluster) => {
              const isSelected = selectedClusterId === cluster.id;
              const volumePct = cluster.share_of_observed_volume;
              // Map share to size. Ensure mobile fits
              const baseSize = typeof window !== "undefined" && window.innerWidth < 640 ? 60 : 80;
              const maxSize = typeof window !== "undefined" && window.innerWidth < 640 ? 160 : 240;
              const size = Math.max(baseSize, Math.min(maxSize, volumePct * 400));
              
              let clusterColorClass = "border-sepia/30 text-sepia hover:border-sepia/60";
              if (cluster.class === "coordinated_likely") clusterColorClass = "border-velvet bg-velvet/20 text-velvet shadow-[0_0_30px_rgba(58,31,43,0.5)]";
              else if (cluster.class === "authentic_concern") clusterColorClass = "border-oyster bg-oyster/10 text-oyster shadow-[0_0_20px_rgba(217,206,196,0.3)] hover:bg-oyster/20";
              else if (cluster.class === "first_party") clusterColorClass = "border-brass bg-brass/10 text-brass shadow-[0_0_20px_rgba(176,141,87,0.3)] hover:bg-brass/20";

              if (cluster.class === "insufficient_evidence") {
                return (
                  <button 
                    key={cluster.id}
                    onClick={() => setSelectedClusterId(cluster.id)}
                    className={cn(
                      "relative flex items-center justify-center blur-sm hover:blur-none transition-all duration-300 rounded-full focus-visible:outline-none focus-visible:blur-none",
                      isSelected ? "ring-2 ring-sepia blur-none scale-105" : ""
                    )}
                    style={{ width: size, height: size }}
                  >
                    <div className="absolute inset-0 bg-sepia/10 rounded-full animate-pulse" />
                      <span className="font-system text-[10px] sm:text-xs text-sepia relative z-10 opacity-60 px-2 text-center leading-tight">
                       {Math.round(volumePct * 100)}% OBSERVED
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={cluster.id}
                  onClick={() => setSelectedClusterId(cluster.id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-full border transition-all duration-300 hover:scale-105 focus-visible:outline-none",
                    clusterColorClass,
                    isSelected ? "ring-4 ring-offset-4 ring-offset-house ring-oyster scale-105 z-10" : "opacity-80 hover:opacity-100"
                  )}
                  style={{ width: size, height: size }}
                >
                    <span className="font-mono text-lg sm:text-xl">{Math.round(volumePct * 100)}%</span>
                  <span className="font-system text-[9px] sm:text-[10px] uppercase mt-1 sm:mt-2 max-w-[80%] text-center leading-tight opacity-70">
                     SHARE
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Inspector Sidebar */}
        <div className="xl:border-l border-t xl:border-t-0 border-sepia/30 bg-house/95 flex flex-col z-20 min-h-[400px] xl:min-h-[520px]">
          <div className="p-6 border-b border-sepia/30 bg-house sticky top-0 z-10">
            <div className="font-system text-sepia text-xs sm:text-sm mb-3 flex justify-between items-center">
              <span className="tracking-[0.1em]">TOTAL VOLUME</span>
              <span className="font-mono text-oyster bg-sepia/10 px-2 py-1">{flood.observed_volume.toLocaleString()}</span>
            </div>
            <Link href="/pr/pr_001" className="block mt-4">
              <Button className="w-full tracking-[0.15em] bg-brass text-house hover:bg-brass/90 h-12">SYNTHESIZE RESPONSE</Button>
            </Link>
          </div>

          {selectedCluster ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-8 animate-in fade-in duration-300">
              <div>
                <div className="font-system text-sepia text-[10px] tracking-[0.15em] mb-2">INSPECTING CLUSTER</div>
                <h2 className="font-sans text-xl text-oyster leading-snug">{selectedCluster.label}</h2>
                <p className="font-mono text-xs text-brass mt-3 border-l-2 border-brass pl-3">{selectedCluster.note}</p>
              </div>

              <div className="space-y-4">
                <div className="font-system text-sepia text-[10px] tracking-[0.15em]">COORDINATION SIGNALS</div>
                <div className="grid grid-cols-2 gap-3">
                  <SignalScore label="DUP PHRASING" score={selectedCluster.coordination_signals.duplicate_phrasing} />
                  <SignalScore label="AGE CLUSTER" score={selectedCluster.coordination_signals.account_age_clustering} />
                  <SignalScore label="BURST WINDOW" score={selectedCluster.coordination_signals.burst_window_seconds / 600} isTime />
                  <SignalScore label="CADENCE" score={selectedCluster.coordination_signals.cadence_irregularity} />
                </div>
              </div>

              <div className="space-y-4 pb-6">
                <div className="font-system text-sepia text-[10px] tracking-[0.15em] mb-2">{source === "live" ? "DE-AMPLIFIED OBSERVATIONS" : "RAW SIGNAL EXAMPLES"}</div>
                {flood.events.filter(e => e.cluster_id === selectedCluster.id).slice(0, 3).map(event => (
                  <div key={event.id} className="border border-sepia/20 p-4 bg-house/40 hover:bg-house/60 transition-colors">
                    <div className="flex justify-between items-start mb-3 border-b border-sepia/10 pb-2">
                      <div className="font-mono text-[10px] text-brass">{event.provenance ? "IDENTITY UNAVAILABLE" : event.author.handle}</div>
                      <div className="font-system text-[9px] text-sepia">{event.provenance ? "CONTENT WITHHELD" : `AGE ${event.author.account_age_days}d`}</div>
                    </div>
                    <p className="font-sans text-sm text-oyster/90 leading-relaxed">{event.text}</p>
                    {event.provenance && (
                      <div className="mt-4 border-t border-sepia/20 pt-3 space-y-1.5 bg-sepia/5 p-2">
                        <p className="font-mono text-[9px] text-sepia">SOURCE / {event.provenance.source_id} · {event.provenance.source_class}</p>
                        <p className="font-mono text-[9px] text-sepia">WINDOW / {event.provenance.observation_window.start} → {event.provenance.observation_window.end}</p>
                        <p className="font-mono text-[9px] text-brass">FRESHNESS / {event.provenance.freshness} · CONFIDENCE / {event.provenance.confidence}</p>
                      </div>
                    )}
                    <div className="mt-4 flex gap-4 text-sepia font-mono text-[10px]">
                      <span className="bg-sepia/10 px-2 py-0.5">LIKES {event.engagement.likes}</span>
                      <span className="bg-sepia/10 px-2 py-0.5">REPOSTS {event.engagement.reposts}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center min-h-[300px]">
              <div className="border border-dashed border-sepia/40 p-8 rounded-full flex items-center justify-center w-48 h-48">
                <span className="font-system text-sepia opacity-60 text-xs tracking-[0.1em] max-w-[100px]">SELECT A CLUSTER TO INSPECT</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="grid lg:grid-cols-[1.35fr_0.65fr] gap-px bg-sepia/30">
        <div className="bg-house p-6 lg:p-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="font-system text-brass text-[10px] tracking-[0.2em] border border-brass/30 inline-block px-2 py-1 mb-3">EVIDENCE COMPILER</div>
              <h2 className="font-serif text-3xl sm:text-4xl text-oyster mt-2">What can actually be stood behind.</h2>
            </div>
            <span className="font-mono text-[10px] text-sepia bg-sepia/10 px-3 py-1.5">{flood.evidence.length} CITATIONS / LINEAGED</span>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {flood.evidence.map((item) => (
              <article key={item.id} className="border border-sepia/25 p-5 bg-house/60 hover:border-brass/60 transition-colors flex flex-col group">
                <div className="flex items-center justify-between gap-3 border-b border-sepia/20 pb-3 mb-3">
                  <span className="font-system text-[9px] text-brass tracking-[0.15em] bg-brass/10 px-2 py-0.5">{item.source_class.replaceAll("_", " ")}</span>
                  <span className="font-mono text-[9px] text-sepia">{item.confidence}</span>
                </div>
                <h3 className="font-sans text-sm text-oyster font-medium">{item.label}</h3>
                <p className="font-sans text-xs text-oyster/70 mt-3 leading-relaxed flex-1">{item.excerpt}</p>
                <div className="mt-5 pt-3 border-t border-sepia/20 space-y-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                  <p className="font-mono text-[9px] text-oyster/50 truncate" title={item.source_ref}>{item.source_ref}</p>
                  <p className="font-mono text-[9px] text-sepia">{item.freshness} · {item.observation_window}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="bg-velvet/10 p-6 lg:p-10 border-t lg:border-t-0 lg:border-l border-sepia/30">
          <div className="font-system text-brass text-[10px] tracking-[0.2em] mb-2">SAFE FEEDBACK LANE</div>
          <h2 className="font-serif text-3xl text-oyster mt-2">Questions, not targets.</h2>
          <p className="font-sans text-sm text-oyster/70 mt-4 leading-relaxed max-w-md">
            Grouped questions give the audience a door in without handing a cast member an unfiltered feed.
          </p>
          <div className="mt-8 space-y-4">
            {flood.questions.map((question) => (
              <div key={question.id} className="border border-sepia/30 bg-house/80 p-5 shadow-sm">
                <div className="flex flex-wrap justify-between gap-3 font-mono text-[9px] text-sepia mb-3 pb-2 border-b border-sepia/20">
                  <span className="bg-sepia/10 px-2 py-0.5">{question.grouped_count} GROUPED</span>
                  <span className={question.answerability === "answerable_with_context" ? "text-brass bg-brass/10 px-2 py-0.5" : "text-tally bg-tally/10 px-2 py-0.5"}>
                    {question.answerability.replaceAll("_", " ").toUpperCase()}
                  </span>
                </div>
                <p className="font-sans text-sm text-oyster mt-2 leading-relaxed">{question.prompt}</p>
                <p className="font-mono text-[9px] text-sepia mt-4 border-l-2 border-sepia/30 pl-2">
                  {question.context_refs.length ? `${question.context_refs.length} approved context refs` : "No supported third-party context"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-house p-6 lg:p-10 border-t border-sepia/30">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
          <div>
            <div className="font-system text-tally text-[10px] tracking-[0.2em] border border-tally/30 inline-block px-2 py-1 mb-3 bg-tally/5">ACTIVE SAFETY HOLDS</div>
            <h2 className="font-serif text-3xl sm:text-4xl text-oyster mt-2">Keep the heat from finding a person.</h2>
          </div>
          <p className="font-mono text-[10px] text-sepia max-w-sm lg:text-right">Holds are product behavior, not a disclaimer. They stay visible before a response is staged.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5 mt-6">
          {flood.safety_holds.map((hold) => (
            <div key={hold.id} className="border border-tally/40 bg-tally/5 p-6 shadow-[0_0_15px_rgba(255,45,31,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-tally"></div>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <span className="font-system text-sm text-tally tracking-[0.1em] font-bold">{hold.label}</span>
                <span className="font-mono text-[9px] text-tally bg-tally/10 px-2 py-1 border border-tally/20">{hold.severity} / {hold.status}</span>
              </div>
              <p className="font-sans text-sm text-oyster/80 mt-2 leading-relaxed">{hold.reason}</p>
              <div className="mt-5 border-t border-tally/20 pt-4 bg-house/50 -mx-6 -mb-6 px-6 pb-6">
                <span className="font-system text-[9px] text-brass tracking-[0.15em] block mb-1">SAFE ACTION REQUIRED</span>
                <p className="font-mono text-[10px] text-oyster/90 leading-relaxed">{hold.safe_action}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SignalScore({ label, score, isTime = false }: { label: string, score: number, isTime?: boolean }) {
  return (
    <div className="border border-sepia/20 p-3 sm:p-4 bg-house/40 flex flex-col gap-1.5 transition-colors hover:bg-house/60">
      <span className="font-system text-[9px] sm:text-[10px] text-sepia tracking-[0.1em]">{label}</span>
      <span className={cn("font-mono text-sm sm:text-base", score > 0.7 ? "text-velvet font-bold" : "text-oyster")}>
        {score.toFixed(2)}
      </span>
    </div>
  );
}