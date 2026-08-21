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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="font-system text-sepia animate-pulse tracking-[0.1em]">READING SIGNAL</div>
      </div>
    );
  }

  if (!flood) return null;

  const selectedCluster = flood.clusters.find(c => c.id === selectedClusterId);

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-house relative">
      
      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
        
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
      <div className="w-[400px] border-l border-sepia/30 bg-house/90 backdrop-blur flex flex-col shrink-0 z-20">
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
