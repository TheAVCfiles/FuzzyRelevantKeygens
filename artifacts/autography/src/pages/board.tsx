import {
  useGetActiveCall,
  useGetContext,
  useGetFlood,
  useGetPullRequest,
  useRunAgentFlow,
} from "@workspace/api-client-react";
import { Tally } from "@/components/tally";
import { Button } from "@/components/ui/button";
import { EvidenceReel } from "@/components/evidence-reel";
import { formatTime } from "@/lib/utils";
import { useLocation } from "wouter";

export function Board() {
  const [, setLocation] = useLocation();
  const runAgentFlow = useRunAgentFlow({
    mutation: {
      onSuccess: () => setLocation("/constellation"),
      onError: () => setLocation("/constellation"),
    },
  });
  const { data: activeCall, isLoading } = useGetActiveCall({
    query: {
      queryKey: ["/api/call/active"],
      refetchInterval: 1000,
    },
  });
  const { data: flood } = useGetFlood({ query: { queryKey: ["/api/flood"] } });
  const { data: context } = useGetContext({ query: { queryKey: ["/api/context"] } });
  const { data: pullRequest } = useGetPullRequest("pr_001", {
    query: { queryKey: ["/api/pr/pr_001"] },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="font-system text-sepia animate-pulse tracking-[0.1em]">WARMING UP</div>
      </div>
    );
  }

  if (!activeCall || !activeCall.call) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <Tally active={false} label="DARK" />
        <p className="font-sans text-sepia text-lg text-center">No Call is live. Nothing can issue.</p>
      </div>
    );
  }

  const { call, state, seconds_remaining } = activeCall;
  const isLive = state === "LIVE" && seconds_remaining > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
      {/* Centerpiece Object */}
      <div className="w-full max-w-2xl flex flex-col items-center border border-sepia/30 bg-house/50 p-12 relative shadow-2xl">
        
        {/* Tally above */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-house px-4">
          <Tally active={isLive} label={isLive ? "ON AIR" : state === "INERT" ? "INERT" : "DARK"} />
        </div>

        <div className="mt-8 mb-12 text-center space-y-2">
          <h1 className="font-serif text-5xl text-oyster mb-4">
            {call.subject.display.toUpperCase()}
          </h1>
          <p className="font-sans text-xl text-brass">
            {call.engagement.show} &middot; Episode {call.engagement.episode}
          </p>
        </div>

        <div className="w-full border-t border-b border-sepia/30 py-6 mb-12 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-system text-sepia">WINDOW CLOSES IN</span>
            <span className="font-mono text-xl text-oyster">{formatTime(seconds_remaining)}</span>
          </div>
          
          <div className="flex items-start gap-4 text-sm mt-4 w-full max-w-md justify-center flex-wrap">
            <span className="font-system text-sepia w-full text-center mb-1">SCOPES</span>
            {call.scopes.map(s => (
              <span key={s} className="font-mono text-xs bg-sepia/20 px-2 py-1 text-oyster">{s}</span>
            ))}
          </div>
        </div>

        <div>
          {isLive ? (
            <Button
              size="lg"
              className="w-64 tracking-[0.1em] shadow-[0_0_20px_rgba(217,206,196,0.1)]"
              disabled={runAgentFlow.isPending}
              onClick={() => runAgentFlow.mutate()}
            >
              {runAgentFlow.isPending ? "READING THE ROOM" : "READ THE ROOM"}
            </Button>
          ) : (
            <Button size="lg" disabled className="w-64 tracking-[0.1em] opacity-30">
              OFFLINE
            </Button>
          )}
        </div>

        {isLive && flood && pullRequest && context && (
          <EvidenceReel
            observedVolume={flood.observed_volume}
            coordinatedShare={pullRequest.finding.coordinated_share}
            authenticConcern={pullRequest.finding.authentic_concern}
            contextCount={pullRequest.moves[1]?.context_refs.length ?? context.items.length}
            exposure={pullRequest.finding.commercial_exposure[0] ?? "No exposure recorded"}
            onStageResponse={() => setLocation("/pr/pr_001")}
          />
        )}
      </div>
    </div>
  );
}
