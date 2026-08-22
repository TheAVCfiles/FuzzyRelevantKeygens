import { useGetFlood, useGetPullRequest, useSignPullRequest, useDismissPullRequest } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PR() {
  const params = useParams();
  const id = params.id || "pr_001";
  const [, setLocation] = useLocation();

  const { data: pr, isLoading } = useGetPullRequest(id, {
    query: { queryKey: ["/api/pr", id] }
  });
  const { data: flood } = useGetFlood({ query: { queryKey: ["/api/flood"] } });

  const signMutation = useSignPullRequest({
    mutation: {
      onSuccess: (result) => {
        if (result.evaluation.pass) {
          setLocation(`/drop/${result.drop.drop_id}`);
        } else {
          // Stay on page, show refusal in receipt log style maybe, or redirect to receipts
          // Actually, let's redirect to receipts so they see the refusal log.
          setLocation(`/receipts`);
        }
      }
    }
  });

  const dismissMutation = useDismissPullRequest({
    mutation: {
      onSuccess: () => {
        setLocation(`/receipts`);
      }
    }
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="font-system text-sepia animate-pulse tracking-[0.1em]">DRAFTING MOVES</div>
      </div>
    );
  }

  if (!pr) return null;

  return (
    <div className="flex-1 flex flex-col p-8 max-w-7xl mx-auto w-full">
      <header className="mb-12 border-b border-sepia/30 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="font-system text-sepia text-sm">RESPONSE ROOM / {pr.id}</div>
          <div className="font-mono text-[10px] text-brass border border-brass/30 px-2 py-1">HUMAN SIGNATURE REQUIRED</div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="font-system text-xs text-brass mb-2">AUTHENTIC CONCERN</div>
            <p className="font-sans text-xl text-oyster">{pr.finding.authentic_concern}</p>
          </div>
          <div className="border-l border-sepia/30 pl-8">
            <div className="font-system text-xs text-sepia mb-2">COMMERCIAL EXPOSURE</div>
            <ul className="space-y-2">
              {pr.finding.commercial_exposure.map((exp, i) => (
                <li key={i} className="font-mono text-sm text-oyster/80 leading-relaxed">• {exp}</li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      {flood && (
        <section className="mb-8 border border-tally/30 bg-tally/5 p-5">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div>
              <div className="font-system text-tally text-xs tracking-[0.14em]">SAFETY HOLD / BEFORE STAGING</div>
              <h2 className="font-serif text-2xl text-oyster mt-2">{flood.safety_holds[0]?.label}</h2>
              <p className="font-sans text-sm text-oyster/70 mt-2 max-w-2xl leading-relaxed">
                {flood.safety_holds[0]?.reason}
              </p>
            </div>
            <div className="lg:max-w-sm border-l border-tally/30 pl-4">
              <div className="font-system text-[10px] text-sepia tracking-[0.12em]">SAFE ACTION</div>
              <p className="font-mono text-xs text-brass mt-2 leading-relaxed">{flood.safety_holds[0]?.safe_action}</p>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-tally/20 flex flex-wrap gap-4 font-mono text-[10px] text-sepia">
            <span>{flood.evidence.length} LINEAGED CITATIONS AVAILABLE</span>
            <span>{flood.questions.filter((question) => question.answerability === "answerable_with_context").length} GROUPED QUESTIONS ANSWERABLE</span>
            <span>NO IDENTITY RESOLUTION</span>
          </div>
        </section>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
        {pr.moves.map((move, index) => {
          // First move should be Stay dark ideally.
          const isStayDark = move.id === "mv_hold" || index === 0;

          return (
            <div key={move.id} className={cn(
              "border flex flex-col p-6",
              isStayDark ? "border-sepia/20 bg-house/50" : "border-sepia bg-house/80"
            )}>
              <div className="flex-1">
                <div className="font-system tracking-[0.1em] text-sm text-sepia mb-6 uppercase">
                  {move.label}
                </div>
                
                <p className="font-sans text-base text-oyster mb-8 min-h-[4rem]">
                  {move.description}
                </p>

                <div className="space-y-4 mb-8">
                  <div className="font-system text-[10px] text-sepia uppercase">Projected Outcome</div>
                  <div className="p-4 border border-sepia/20 bg-house/30">
                    <div className="font-sans font-semibold text-brass mb-1">{move.projected_outcome.headline}</div>
                    <div className="font-mono text-xs text-oyster/70">{move.projected_outcome.detail}</div>
                  </div>
                </div>
                
                {move.context_refs.length > 0 && (
                  <div className="space-y-2 mb-8">
                    <div className="font-system text-[10px] text-sepia uppercase">Sourcing</div>
                    <div className="flex flex-wrap gap-2">
                      {move.context_refs.map(ref => (
                        <span key={ref} className="font-mono text-[10px] bg-sepia/10 px-2 py-1 text-oyster/60">
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="font-mono text-[10px] text-sepia mb-6">
                  {move.context_refs.length > 0 ? `${move.context_refs.length} approved citations attached` : "No claims attached · silence remains available"}
                </div>
              </div>

              <div className="pt-6 border-t border-sepia/30">
                <Button 
                  className={cn("w-full", isStayDark ? "bg-sepia text-house hover:bg-sepia/80" : "")}
                  onClick={() => {
                    if (isStayDark) {
                      dismissMutation.mutate({ id: pr.id });
                    } else {
                      signMutation.mutate({ id: pr.id, data: { move_id: move.id } });
                    }
                  }}
                  disabled={signMutation.isPending || dismissMutation.isPending}
                >
                  {isStayDark ? "DISMISS" : "SIGN"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
