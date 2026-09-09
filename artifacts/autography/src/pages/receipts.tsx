import { useGetReceipts } from "@workspace/api-client-react";
import { LoadingPanel, ErrorPanel } from "@/components/states";

export function Receipts() {
  const { data: receipts, isLoading, error, refetch } = useGetReceipts({
    query: { queryKey: ["/api/receipts"] }
  });

  if (isLoading) {
    return <LoadingPanel text="LOADING REGISTRY" />;
  }

  if (error) {
    return <ErrorPanel error={error as Error} onRetry={() => refetch()} message="Could not fetch the receipt registry." />;
  }

  if (!receipts) return null;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      <header className="mb-10 sm:mb-12 border-b border-sepia/30 pb-6 sm:pb-8">
        <h1 className="font-system text-2xl sm:text-3xl tracking-[0.1em] text-oyster mb-3 uppercase">Receipt Log</h1>
        <p className="font-sans text-sm sm:text-base text-sepia max-w-2xl">
          Append-only registry of all evaluation runs, refusals, and seals. 
          Every recorded production-desk decision appears here with its actor, result, and rule context.
        </p>
      </header>

      <div className="space-y-4 sm:space-y-6 pb-12">
        {receipts.map((receipt, i) => {
          const isRefusal = receipt.result === "REFUSED";
          const isSealed = receipt.result === "SEALED";
          
          return (
            <div 
              key={i} 
              className={`border p-4 sm:p-6 flex flex-col md:flex-row md:items-center gap-4 sm:gap-6 transition-colors ${
                isRefusal ? "border-velvet bg-velvet/10 hover:bg-velvet/20" : 
                isSealed ? "border-brass bg-brass/5 hover:bg-brass/10" : 
                "border-sepia/30 bg-house/50 hover:bg-house/80"
              }`}
            >
              <div className="flex-col gap-1.5 md:w-56 shrink-0 flex border-b md:border-b-0 md:border-r border-sepia/20 pb-3 md:pb-0 md:pr-4">
                <span className="font-mono text-[10px] sm:text-xs text-sepia">{new Date(receipt.ts).toLocaleString()}</span>
                <span className="font-mono text-xs sm:text-sm text-oyster truncate block w-full" title={receipt.call_id}>{receipt.call_id}</span>
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-system text-xs sm:text-sm tracking-[0.15em] text-oyster uppercase">{receipt.action}</span>
                  <span className="font-mono text-[9px] text-sepia px-2 py-1 bg-house border border-sepia/20">ACTOR: {receipt.actor}</span>
                </div>
                
                {receipt.rule_fired && (
                  <div className="font-sans text-xs sm:text-sm text-velvet font-medium mt-2 bg-velvet/10 inline-block px-3 py-1.5 border border-velvet/20">
                    RULE FIRED: {receipt.rule_fired}
                  </div>
                )}
              </div>

              <div className="md:w-40 shrink-0 md:text-right mt-2 md:mt-0 bg-house/50 md:bg-transparent p-3 md:p-0 border md:border-0 border-sepia/20 text-center md:text-right">
                <span className={`font-system text-base sm:text-lg tracking-[0.15em] font-bold ${
                  isRefusal ? "text-velvet" : 
                  isSealed ? "text-brass" : 
                  "text-oyster"
                }`}>
                  {receipt.result}
                </span>
              </div>
            </div>
          )
        })}
        
        {receipts.length === 0 && (
          <div className="text-center p-12 sm:p-24 border border-dashed border-sepia/40 bg-house/40 mt-8">
            <span className="font-system text-sepia tracking-[0.15em] text-sm">NO RECEIPTS RECORDED</span>
            <p className="font-mono text-[10px] text-sepia/60 mt-4 max-w-xs mx-auto">
              Decisions will appear here once actions are taken in the PR room.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}