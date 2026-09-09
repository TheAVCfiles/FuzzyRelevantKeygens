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
import { LoadingPanel, ErrorPanel } from "@/components/states";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export function Board() {
  const [, setLocation] = useLocation();
  const [runError, setRunError] = useState("");
  const runAgentFlow = useRunAgentFlow({
    mutation: {
      onSuccess: (result) => {
        setRunError("");
        window.sessionStorage.setItem(
          "autography-adk-runtime-evidence",
          JSON.stringify(result.runtime_evidence),
        );
        setLocation("/constellation");
      },
      onError: () => {
        setRunError("The signal read did not complete. Nothing moved forward; retry when the source desk is available.");
      },
    },
  });
  
  const { data: activeCall, isLoading, error, refetch } = useGetActiveCall({
    query: {
      queryKey: ["/api/call/active"],
      refetchInterval: 1000,
    },
  });
  
  const { data: flood } = useGetFlood(undefined, { query: { queryKey: ["/api/flood"] } });
  const { data: context } = useGetContext({ query: { queryKey: ["/api/context"] } });
  const { data: pullRequest } = useGetPullRequest("pr_001", {
    query: { queryKey: ["/api/pr/pr_001"] },
  });

  if (isLoading) {
    return <LoadingPanel text="WARMING UP DESK" />;
  }
  
  if (error) {
    return <ErrorPanel error={error as Error} onRetry={() => refetch()} message="Could not connect to the live call stream." />;
  }

  if (!activeCall || !activeCall.call) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-700">
        <Tally active={false} label="DARK" />
        <p className="font-sans text-sepia text-lg text-center max-w-md">No Call is live. The production desk is offline and nothing can issue.</p>
      </div>
    );
  }

  const { call, state, seconds_remaining } = activeCall;
  const isLive = state === "LIVE" && seconds_remaining > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative">
      <div className="w-full max-w-3xl flex flex-col items-center border border-sepia/30 bg-house/60 p-6 sm:p-12 md:p-16 relative shadow-2xl backdrop-blur-sm animate-in zoom-in-95 duration-500">
        
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-house px-4">
          <Tally active={isLive} label={isLive ? "ON AIR" : state === "INERT" ? "INERT" : "DARK"} />
        </div>

        <div className="mt-8 mb-10 text-center space-y-4">
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-oyster mb-4 max-w-2xl mx-auto leading-tight">
            {call.subject.display.toUpperCase()}
          </h1>
          <p className="font-sans text-lg sm:text-xl text-brass">
            {call.engagement.show} &middot; Episode {call.engagement.episode}
          </p>
        </div>

        <div className="w-full border-t border-b border-sepia/30 py-6 mb-10 flex flex-col items-center gap-4 bg-house/40">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-system text-sepia tracking-[0.1em]">WINDOW CLOSES IN</span>
            <span className="font-mono text-2xl text-oyster">{formatTime(seconds_remaining)}</span>
          </div>
          
          <div className="flex items-start gap-3 mt-4 w-full max-w-lg justify-center flex-wrap">
            <span className="font-system text-sepia w-full text-center mb-1 text-xs tracking-[0.1em]">ACTIVE SCOPES</span>
            {call.scopes.map(s => (
              <span key={s} className="font-mono text-[10px] sm:text-xs bg-sepia/20 px-3 py-1.5 text-oyster uppercase border border-sepia/20">{s}</span>
            ))}
          </div>
        </div>

        <div className="w-full flex justify-center z-10 relative">
          {isLive ? (
            <Button
              size="lg"
              className={`w-full sm:w-72 h-14 tracking-[0.15em] transition-all duration-500 ${runAgentFlow.isPending ? "bg-brass text-house" : "bg-oyster text-house hover:bg-white"}`}
              disabled={runAgentFlow.isPending}
              onClick={() => runAgentFlow.mutate()}
            >
              {runAgentFlow.isPending ? (
                <span className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-house animate-ping" />
                  READING THE ROOM
                </span>
              ) : "READ THE ROOM"}
            </Button>
          ) : (
            <Button size="lg" disabled className="w-full sm:w-72 h-14 tracking-[0.15em] opacity-30 border-sepia border bg-transparent text-sepia">
              OFFLINE
            </Button>
          )}
        </div>
        {runError && (
          <div className="mt-5 flex w-full max-w-xl items-start gap-3 border border-tally/40 bg-tally/5 p-4 text-left" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tally" aria-hidden="true" />
            <div>
              <p className="font-system text-xs uppercase tracking-[0.12em] text-tally">Signal read failed</p>
              <p className="mt-1 text-sm leading-6 text-oyster/80">{runError}</p>
            </div>
          </div>
        )}

        {isLive && flood && pullRequest && context && (
          <div className="mt-12 w-full animate-in slide-in-from-bottom-8 duration-700 fade-in border-t border-sepia/30 pt-10">
            <EvidenceReel
              observedVolume={flood.observed_volume}
              coordinatedShare={pullRequest.finding.coordinated_share}
              authenticConcern={pullRequest.finding.authentic_concern}
              contextCount={pullRequest.moves[1]?.context_refs.length ?? context.items.length}
              exposure={pullRequest.finding.commercial_exposure[0] ?? "No exposure recorded"}
              onStageResponse={() => setLocation("/pr/pr_001")}
            />
          </div>
        )}
      </div>
    </div>
  );
}