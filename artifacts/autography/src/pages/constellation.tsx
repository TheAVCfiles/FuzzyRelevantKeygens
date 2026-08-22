import { useGetFlood } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Constellation() {
  const { data: flood, isLoading } = useGetFlood({
    query: { queryKey: ["/api/flood"] }
  });

  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("producer");
  const [activePulseId, setActivePulseId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="font-system text-sepia animate-pulse tracking-[0.1em]">READING SIGNAL</div>
      </div>
    );
  }

  if (!flood) return null;

  const selectedCluster = flood.clusters.find(c => c.id === selectedClusterId);
  const currentRole = flood.role_permissions.find(role => role.role === selectedRole) ?? flood.role_permissions[0];
  const activePulse = flood.timeline.find(pulse => pulse.id === activePulseId);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-house relative">
      <header className="px-6 lg:px-10 pt-8 pb-6 border-b border-sepia/30">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="font-system text-tally text-xs tracking-[0.2em] mb-3">SIGNAL ROOM / LIVE AUDIENCE DYNAMICS</div>
            <h1 className="font-serif text-4xl lg:text-5xl text-oyster">The room, with the volume turned down.</h1>
            <p className="font-sans text-sm text-oyster/60 mt-3 max-w-2xl">
              A de-amplified view of what is moving, what is supported, and what should stay in a human hold.
            </p>
          </div>
          <div className="font-mono text-xs text-sepia border border-sepia/30 px-3 py-2 whitespace-nowrap">
            OBSERVATION WINDOW / NOW
          </div>
        </div>
        <div className="mt-7 flex flex-col xl:flex-row gap-5 xl:items-end">
          <div className="flex-1">
            <div className="font-system text-[10px] tracking-[0.16em] text-sepia mb-3">EPISODE TIMELINE · CLICK A PULSE TO INSPECT</div>
            <div className="flex items-end gap-2 h-20">
              {flood.timeline.map((pulse) => {
                const isActive = activePulseId === pulse.id;
                return (
                  <button
                    key={pulse.id}
                    onClick={() => {
                      setActivePulseId(pulse.id);
                      setSelectedClusterId(pulse.cluster_id);
                    }}
                    className="group flex-1 min-w-14 h-full flex flex-col justify-end gap-2 text-left"
                    aria-label={`Inspect ${pulse.label}`}
                  >
                    <div className="relative h-12 border-l border-sepia/30 group-hover:border-oyster/60 transition-colors">
                      <span
                        className={`absolute bottom-0 left-0 w-full transition-all duration-500 ${isActive ? "bg-tally" : "bg-brass/50 group-hover:bg-brass"}`}
                        style={{ height: `${Math.max(16, pulse.intensity * 100)}%` }}
                      />
                    </div>
                    <span className={`font-system text-[10px] truncate ${isActive ? "text-oyster" : "text-sepia"}`}>{pulse.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="xl:w-80 border-l border-sepia/30 xl:pl-5">
            <div className="font-system text-[10px] tracking-[0.16em] text-sepia mb-3">ROOM LENS</div>
            <div className="flex flex-wrap gap-2">
              {flood.role_permissions.map((role) => (
                <button
                  key={role.role}
                  onClick={() => setSelectedRole(role.role)}
                  className={cn(
                    "font-system text-[10px] tracking-[0.08em] px-2 py-2 border transition-colors",
                    selectedRole === role.role
                      ? "border-brass text-brass bg-brass/10"
                      : "border-sepia/30 text-sepia hover:text-oyster hover:border-oyster/50",
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
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-sepia/20 pt-4">
          <p className="font-mono text-[10px] text-sepia">{flood.data_notice}</p>
          {activePulse && (
            <p className="font-mono text-[10px] text-brass">SELECTED / {activePulse.freshness} / {activePulse.confidence} confidence</p>
          )}
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] min-h-[620px]">
      
      {/* Map Area */}
      <div className="relative overflow-hidden flex items-center justify-center p-8 min-h-[520px]">
        
        <div className="relative w-full max-w-4xl aspect-video flex flex-wrap gap-4 items-center justify-center content-center z-10">
          {flood.clusters.map((cluster) => {
            const isSelected = selectedClusterId === cluster.id;
            const volumePct = cluster.share_of_observed_volume;
            // Map share to size. E.g. 0.5 -> large star, 0.05 -> small star
            const size = Math.max(80, Math.min(240, volumePct * 400));
            
            let clusterColorClass = "border-sepia/30 text-sepia";
            if (cluster.class === "coordinated_likely") clusterColorClass = "border-velvet bg-velvet/20 text-velvet shadow-[0_0_30px_rgba(58,31,43,0.5)]";
            else if (cluster.class === "authentic_concern") clusterColorClass = "border-oyster bg-oyster/10 text-oyster shadow-[0_0_20px_rgba(217,206,196,0.3)]";
            else if (cluster.class === "first_party") clusterColorClass = "border-brass bg-brass/10 text-brass shadow-[0_0_20px_rgba(176,141,87,0.3)]";

            if (cluster.class === "insufficient_evidence") {
              return (
                <button 
                  key={cluster.id}
                  onClick={() => setSelectedClusterId(cluster.id)}
                  className={cn(
                    "relative flex items-center justify-center blur-sm hover:blur-none transition-all duration-300 rounded-full",
                    isSelected ? "ring-2 ring-sepia blur-none" : ""
                  )}
                  style={{ width: size, height: size }}
                >
                  <div className="absolute inset-0 bg-sepia/10 rounded-full animate-pulse" />
                    <span className="font-system text-xs text-sepia relative z-10 opacity-50 px-2 text-center leading-tight">
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
                  "relative flex flex-col items-center justify-center rounded-full border transition-all duration-300 hover:scale-105",
                  clusterColorClass,
                  isSelected ? "ring-4 ring-offset-4 ring-offset-house ring-oyster" : ""
                )}
                style={{ width: size, height: size }}
              >
                  <span className="font-mono text-xl">{Math.round(volumePct * 100)}%</span>
                <span className="font-system text-[10px] uppercase mt-2 max-w-[80%] text-center leading-tight opacity-70">
                   SHARE OF OBSERVED VOLUME
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Inspector Sidebar */}
      <div className="border-l border-sepia/30 bg-house/90 backdrop-blur flex flex-col z-20 min-h-[520px]">
        <div className="p-6 border-b border-sepia/30">
          <div className="font-system text-sepia text-sm mb-2 flex justify-between">
            <span>TOTAL VOLUME</span>
            <span className="font-mono text-oyster">{flood.observed_volume.toLocaleString()}</span>
          </div>
          <Link href="/pr/pr_001" className="block mt-4">
            <Button className="w-full">SYNTHESIZE RESPONSE</Button>
          </Link>
        </div>

        {selectedCluster ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div>
              <div className="font-system text-sepia text-xs mb-1">CLUSTER</div>
              <h2 className="font-sans text-xl text-oyster">{selectedCluster.label}</h2>
              <p className="font-mono text-xs text-brass mt-2">{selectedCluster.note}</p>
            </div>

            <div className="space-y-4">
              <div className="font-system text-sepia text-xs">COORDINATION SIGNALS</div>
              <div className="grid grid-cols-2 gap-4">
                <SignalScore label="DUP PHRASING" score={selectedCluster.coordination_signals.duplicate_phrasing} />
                <SignalScore label="AGE CLUSTER" score={selectedCluster.coordination_signals.account_age_clustering} />
                <SignalScore label="BURST WINDOW" score={selectedCluster.coordination_signals.burst_window_seconds / 600} isTime />
                <SignalScore label="CADENCE" score={selectedCluster.coordination_signals.cadence_irregularity} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="font-system text-sepia text-xs">RAW SIGNAL EXAMPLES</div>
              {flood.events.filter(e => e.cluster_id === selectedCluster.id).slice(0, 3).map(event => (
                <div key={event.id} className="border border-sepia/20 p-4 bg-house/50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-mono text-xs text-brass">{event.author.handle}</div>
                    <div className="font-system text-[10px] text-sepia">AGE {event.author.account_age_days}d</div>
                  </div>
                  <p className="font-sans text-sm text-oyster/90 leading-relaxed">{event.text}</p>
                  <div className="mt-3 flex gap-3 text-sepia font-mono text-[10px]">
                    <span>LIKES {event.engagement.likes}</span>
                    <span>REPOSTS {event.engagement.reposts}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <span className="font-system text-sepia opacity-50">SELECT A CLUSTER TO INSPECT</span>
          </div>
        )}
      </div>
      </div>

      <section className="grid lg:grid-cols-[1.35fr_0.65fr] gap-px bg-sepia/20 border-t border-sepia/30">
        <div className="bg-house p-6 lg:p-8">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="font-system text-tally text-xs tracking-[0.16em]">EVIDENCE COMPILER</div>
              <h2 className="font-serif text-3xl text-oyster mt-2">What can actually be stood behind.</h2>
            </div>
            <span className="font-mono text-[10px] text-sepia">{flood.evidence.length} CITATIONS / LINEAGED</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {flood.evidence.map((item) => (
              <article key={item.id} className="border border-sepia/25 p-4 bg-house/60 hover:border-brass/60 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-system text-[10px] text-brass tracking-[0.1em]">{item.source_class.replaceAll("_", " ")}</span>
                  <span className="font-mono text-[9px] text-sepia">{item.confidence}</span>
                </div>
                <h3 className="font-sans text-sm text-oyster mt-4">{item.label}</h3>
                <p className="font-sans text-xs text-oyster/65 mt-2 leading-relaxed">{item.excerpt}</p>
                <div className="mt-4 pt-3 border-t border-sepia/20 space-y-1">
                  <p className="font-mono text-[9px] text-oyster/50">{item.source_ref}</p>
                  <p className="font-mono text-[9px] text-sepia">{item.freshness} · {item.observation_window}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="bg-velvet/20 p-6 lg:p-8">
          <div className="font-system text-brass text-xs tracking-[0.16em]">SAFE FEEDBACK LANE</div>
          <h2 className="font-serif text-3xl text-oyster mt-2">Questions, not targets.</h2>
          <p className="font-sans text-sm text-oyster/60 mt-3 leading-relaxed">
            Grouped questions give the audience a door in without handing a cast member an unfiltered feed.
          </p>
          <div className="mt-6 space-y-3">
            {flood.questions.map((question) => (
              <div key={question.id} className="border border-sepia/25 bg-house/50 p-4">
                <div className="flex justify-between gap-3 font-mono text-[9px] text-sepia">
                  <span>{question.grouped_count} GROUPED</span>
                  <span className={question.answerability === "answerable_with_context" ? "text-brass" : "text-tally"}>
                    {question.answerability.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="font-sans text-sm text-oyster mt-3">{question.prompt}</p>
                <p className="font-mono text-[9px] text-sepia mt-3">
                  {question.context_refs.length ? `${question.context_refs.length} approved context refs` : "No supported third-party context"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-sepia/30 p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <div className="font-system text-tally text-xs tracking-[0.16em]">ACTIVE SAFETY HOLDS</div>
            <h2 className="font-serif text-3xl text-oyster mt-2">Keep the heat from finding a person.</h2>
          </div>
          <p className="font-mono text-[10px] text-sepia max-w-md">Holds are product behavior, not a disclaimer. They stay visible before a response is staged.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {flood.safety_holds.map((hold) => (
            <div key={hold.id} className="border border-tally/30 bg-tally/5 p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-system text-xs text-tally tracking-[0.1em]">{hold.label}</span>
                <span className="font-mono text-[9px] text-tally">{hold.severity} / {hold.status}</span>
              </div>
              <p className="font-sans text-sm text-oyster/75 mt-3 leading-relaxed">{hold.reason}</p>
              <p className="font-mono text-[10px] text-brass mt-4 border-t border-tally/20 pt-3">SAFE ACTION / {hold.safe_action}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SignalScore({ label, score, isTime = false }: { label: string, score: number, isTime?: boolean }) {
  // if isTime, it's just a normalized ratio for display
  return (
    <div className="border border-sepia/20 p-3 bg-house/30 flex flex-col gap-1">
      <span className="font-system text-[10px] text-sepia">{label}</span>
      <span className={cn("font-mono text-sm", score > 0.7 ? "text-velvet" : "text-oyster")}>
        {score.toFixed(2)}
      </span>
    </div>
  );
}
