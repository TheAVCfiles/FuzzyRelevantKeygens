import { useGetDrop } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { LoadingPanel, ErrorPanel } from "@/components/states";

export function DropView() {
  const params = useParams();
  const id = params.id || "";

  const { data: drop, isLoading, error, refetch } = useGetDrop(id, {
    query: { queryKey: ["/api/drop", id], enabled: !!id }
  });

  if (isLoading) {
    return <LoadingPanel text="VERIFYING SEAL" />;
  }

  if (error) {
    return <ErrorPanel error={error as Error} onRetry={() => refetch()} message="Could not retrieve the artifact." />;
  }

  if (!drop) return null;

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative min-h-[80vh] bg-house/40 animate-in fade-in duration-700">
      <div className="w-full max-w-4xl bg-oyster text-house shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-8 sm:p-16 md:p-24 relative overflow-hidden">
        
        {/* Subtle texture/watermark effect */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" 
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}>
        </div>

        <div className="absolute top-0 left-0 w-full h-1.5 bg-brass" />

        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 sm:gap-0 mb-16 relative z-10">
          <div>
            <div className="font-system text-[10px] sm:text-xs tracking-[0.2em] text-house/50 border border-house/20 inline-block px-3 py-1 mb-2 uppercase">
              SEALED PRODUCTION ARTIFACT
            </div>
          </div>
          <div className="sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-house/10 pt-4 sm:pt-0">
            <div className="font-mono text-xs sm:text-sm font-bold text-house/90 mb-1">{drop.drop_id}</div>
            <div className="font-mono text-[10px] text-house/60">EDITION {drop.edition.number} OF {drop.edition.of}</div>
          </div>
        </div>

        <div className="mt-8 sm:mt-16 mb-16 sm:mb-24 text-center relative z-10">
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl mb-12 text-house leading-tight sm:leading-tight max-w-3xl mx-auto">
            {drop.title}
          </h1>

          <div className="space-y-8 sm:space-y-12 text-left max-w-2xl mx-auto">
            {drop.claims.map((claim, idx) => (
              <div key={idx} className="relative group">
                <p className="font-sans text-xl sm:text-2xl text-house/90 leading-relaxed font-medium">
                  "{claim.text}"
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[9px] sm:text-[10px] border-t border-house/10 pt-3">
                  <span className="bg-house/5 px-2.5 py-1 text-house/70 uppercase font-bold tracking-widest border border-house/10">
                    {claim.source_class.replace("_", " ")}
                  </span>
                  <span className="text-house/60 bg-white/50 px-2 py-1 truncate max-w-[200px] sm:max-w-none" title={claim.source_ref}>
                    {claim.source_ref}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t-2 border-house/20 pt-8 sm:pt-12 mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 text-sm relative z-10">
          <div>
            <div className="font-system text-[10px] text-house/50 tracking-[0.2em] mb-3 uppercase">SIGNED BY</div>
            <div className="font-sans text-xl sm:text-2xl text-house/90">{drop.seal.signed_by}</div>
            <div className="font-mono text-[10px] sm:text-xs text-house/60 mt-2 bg-house/5 inline-block px-2 py-1 border border-house/10">{drop.seal.scope_ref}</div>
          </div>
          <div className="sm:text-right border-t sm:border-t-0 border-house/10 pt-6 sm:pt-0">
            <div className="font-system text-[10px] text-house/50 tracking-[0.2em] mb-3 uppercase">SEALED AT</div>
            <div className="font-mono text-sm sm:text-base text-house/90 mb-2">{new Date(drop.seal.issued_at).toLocaleString()}</div>
            <div className="font-mono text-[8px] sm:text-[9px] text-house/40 break-all w-full sm:w-64 sm:ml-auto leading-relaxed border border-house/5 bg-white/30 p-2" title={drop.hash}>
              HASH: {drop.hash}
            </div>
          </div>
        </div>

        {drop.seal.signatures_simulated && (
          <div className="mt-12 sm:absolute sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 font-system text-[9px] sm:text-[10px] text-tally/80 tracking-[0.2em] border border-tally/20 bg-tally/5 px-4 py-2 text-center">
            SIMULATED MANIFEST — NO REAL C2PA GENERATED
          </div>
        )}
      </div>
    </div>
  );
}