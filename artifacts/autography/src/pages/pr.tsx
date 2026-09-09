import { useGetFlood, useGetPullRequest, useSignPullRequest, useDismissPullRequest } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoadingPanel, ErrorPanel } from "@/components/states";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export function PR() {
  const params = useParams();
  const id = params.id || "pr_001";
  const [, setLocation] = useLocation();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data: pr, isLoading, error: prError, refetch: refetchPr } = useGetPullRequest(id, {
    query: { queryKey: ["/api/pr", id] }
  });
  
  const { data: flood } = useGetFlood(undefined, { query: { queryKey: ["/api/flood"] } });

  const signMutation = useSignPullRequest({
    mutation: {
      onSuccess: (result) => {
        setMutationError(null);
        if (result.evaluation.pass) {
          setLocation(`/drop/${result.drop.drop_id}`);
        } else {
          // Redirect to receipts so they see the refusal log.
          setLocation(`/receipts`);
        }
      },
      onError: (err) => {
        setMutationError(err.message || "Failed to sign the response.");
      }
    }
  });

  const dismissMutation = useDismissPullRequest({
    mutation: {
      onSuccess: () => {
        setMutationError(null);
        setLocation(`/receipts`);
      },
      onError: (err) => {
        setMutationError(err.message || "Failed to dismiss the request.");
      }
    }
  });

  if (isLoading) {
    return <LoadingPanel text="DRAFTING MOVES" />;
  }
  
  if (prError) {
    return <ErrorPanel error={prError as Error} onRetry={() => refetchPr()} message="Could not load the pull request context." />;
  }

  if (!pr) return null;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-7xl mx-auto w-full overflow-x-hidden animate-in fade-in duration-500">
      
      {mutationError && (
        <div className="mb-8 border border-velvet bg-velvet/10 p-4 flex items-start gap-4 animate-in slide-in-from-top-4">
          <AlertTriangle className="w-5 h-5 text-velvet shrink-0 mt-0.5" />
          <div>
            <div className="font-system text-xs tracking-[0.1em] text-velvet mb-1 uppercase">Action Failed</div>
            <div className="font-sans text-sm text-oyster/90">{mutationError}</div>
          </div>
        </div>
      )}

      <header className="mb-10 sm:mb-12 border-b border-sepia/30 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="font-system text-sepia text-[10px] tracking-[0.2em] bg-house border border-sepia/20 px-3 py-1.5">RESPONSE ROOM / {pr.id}</div>
          <div className="font-mono text-[10px] text-brass border border-brass/40 bg-brass/5 px-3 py-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brass animate-pulse" />
            HUMAN SIGNATURE REQUIRED
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 bg-house/40 p-6 sm:p-8 border border-sepia/20">
          <div>
            <div className="font-system text-[10px] text-brass tracking-[0.15em] mb-3">AUTHENTIC CONCERN</div>
            <p className="font-sans text-xl sm:text-2xl text-oyster leading-snug">{pr.finding.authentic_concern}</p>
          </div>
          <div className="md:border-l border-t md:border-t-0 border-sepia/30 pt-6 md:pt-0 md:pl-8 lg:pl-12">
            <div className="font-system text-[10px] text-sepia tracking-[0.15em] mb-3">COMMERCIAL EXPOSURE</div>
            <ul className="space-y-3">
              {pr.finding.commercial_exposure.map((exp, i) => (
                <li key={i} className="font-mono text-xs text-oyster/80 leading-relaxed border-l-2 border-sepia/30 pl-3">
                  {exp}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      {flood && flood.safety_holds.length > 0 && (
        <section className="mb-10 sm:mb-12 border border-tally/40 bg-tally/5 p-6 sm:p-8 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-tally" />
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 lg:gap-8">
            <div className="flex-1">
              <div className="font-system text-tally text-[10px] tracking-[0.2em] mb-2 font-bold">SAFETY HOLD / BEFORE STAGING</div>
              <h2 className="font-serif text-2xl sm:text-3xl text-oyster mt-1">{flood.safety_holds[0]?.label}</h2>
              <p className="font-sans text-sm sm:text-base text-oyster/80 mt-3 max-w-3xl leading-relaxed">
                {flood.safety_holds[0]?.reason}
              </p>
            </div>
            <div className="lg:w-80 lg:shrink-0 lg:border-l border-t lg:border-t-0 border-tally/20 pt-5 lg:pt-0 lg:pl-6 bg-house/30 p-4 lg:p-0 lg:bg-transparent">
              <div className="font-system text-[10px] text-sepia tracking-[0.15em] mb-2">SAFE ACTION</div>
              <p className="font-mono text-[10px] sm:text-xs text-brass leading-relaxed">{flood.safety_holds[0]?.safe_action}</p>
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-tally/20 flex flex-wrap gap-4 sm:gap-6 font-mono text-[9px] sm:text-[10px] text-sepia">
            <span className="bg-house/50 px-2 py-1">{flood.evidence.length} LINEAGED CITATIONS</span>
            <span className="bg-house/50 px-2 py-1">{flood.questions.filter((q) => q.answerability === "answerable_with_context").length} ANSWERABLE QUESTIONS</span>
            <span className="bg-house/50 px-2 py-1 border border-sepia/20">NO IDENTITY RESOLUTION</span>
          </div>
        </section>
      )}

      <div className="font-system text-xs tracking-[0.15em] text-oyster mb-6 pl-1">AVAILABLE MOVES</div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {pr.moves.map((move, index) => {
          // First move should be Stay dark ideally.
          const isStayDark = move.id === "mv_hold" || index === 0;

          return (
            <div key={move.id} className={cn(
              "border flex flex-col relative transition-all duration-300",
              isStayDark ? "border-sepia/30 bg-house/60" : "border-sepia/70 bg-house/90 shadow-[0_0_15px_rgba(107,93,82,0.1)] hover:border-oyster/50"
            )}>
              <div className="flex-1 p-6 sm:p-8">
                <div className="font-system tracking-[0.15em] text-xs text-sepia mb-6 uppercase flex justify-between items-start">
                  <span>{move.label}</span>
                  {isStayDark && <span className="text-[9px] border border-sepia/30 px-1.5 py-0.5">DEFAULT</span>}
                </div>
                
                <p className="font-sans text-base sm:text-lg text-oyster mb-8 min-h-[5rem] leading-relaxed">
                  {move.description}
                </p>

                <div className="space-y-4 mb-8">
                  <div className="font-system text-[10px] text-sepia uppercase tracking-[0.1em]">Projected Outcome</div>
                  <div className="p-4 sm:p-5 border border-sepia/20 bg-house/40">
                    <div className="font-sans font-medium text-brass mb-2">{move.projected_outcome.headline}</div>
                    <div className="font-mono text-[10px] sm:text-xs text-oyster/70 leading-relaxed">{move.projected_outcome.detail}</div>
                  </div>
                </div>
                
                {move.context_refs.length > 0 && (
                  <div className="space-y-3 mb-8">
                    <div className="font-system text-[10px] text-sepia uppercase tracking-[0.1em]">Sourcing</div>
                    <div className="flex flex-wrap gap-2">
                      {move.context_refs.map(ref => (
                        <span key={ref} className="font-mono text-[9px] bg-sepia/15 border border-sepia/20 px-2 py-1 text-oyster/70">
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="font-mono text-[9px] text-sepia mb-2 mt-auto pt-4 border-t border-sepia/20">
                  {move.context_refs.length > 0 ? `${move.context_refs.length} approved citations attached` : "No claims attached · silence remains available"}
                </div>
              </div>

              <div className="p-4 sm:p-6 border-t border-sepia/30 bg-house/50">
                <Button 
                  className={cn(
                    "w-full h-12 tracking-[0.15em] transition-all", 
                    isStayDark ? "bg-sepia/20 text-oyster hover:bg-sepia/40 border border-sepia/30" : "bg-brass text-house hover:bg-white border border-transparent"
                  )}
                  onClick={() => {
                    if (isStayDark) {
                      dismissMutation.mutate({ id: pr.id });
                    } else {
                      signMutation.mutate({ id: pr.id, data: { move_id: move.id } });
                    }
                  }}
                  disabled={signMutation.isPending || dismissMutation.isPending}
                >
                  {(signMutation.isPending || dismissMutation.isPending) ? "PROCESSING..." : (isStayDark ? "DISMISS PR" : "SIGN & STAGE")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}