import { useGetReceipts } from "@workspace/api-client-react";

export function Receipts() {
  const { data: receipts, isLoading } = useGetReceipts({
    query: { queryKey: ["/api/receipts"] }
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="font-system text-sepia animate-pulse tracking-[0.1em]">LOADING LOG</div>
      </div>
    );
  }

  if (!receipts) return null;

  return (
    <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full">
      <div className="mb-12">
        <h1 className="font-system text-2xl tracking-[0.1em] text-oyster mb-2">RECEIPT LOG</h1>
        <p className="font-sans text-sepia">Append-only registry of all evaluation runs, refusals, and seals.</p>
      </div>

      <div className="space-y-4">
        {receipts.map((receipt, i) => {
          const isRefusal = receipt.result === "REFUSED";
          const isSealed = receipt.result === "SEALED";
          
          return (
            <div 
              key={i} 
              className={`border p-6 flex flex-col sm:flex-row sm:items-center gap-6 ${
                isRefusal ? "border-velvet bg-velvet/10" : 
                isSealed ? "border-brass bg-brass/5" : 
                "border-sepia/30 bg-house/50"
              }`}
            >
              <div className="flex-col gap-1 sm:w-48 shrink-0 flex">
                <span className="font-mono text-xs text-sepia">{new Date(receipt.ts).toISOString()}</span>
                <span className="font-mono text-sm text-oyster truncate">{receipt.call_id}</span>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-system text-sm tracking-[0.1em] text-oyster uppercase">{receipt.action}</span>
                  <span className="font-mono text-xs text-sepia px-2 py-0.5 bg-house">ACTOR: {receipt.actor}</span>
                </div>
                
                {receipt.rule_fired && (
                  <div className="font-sans text-sm text-velvet font-bold mt-2">
                    {receipt.rule_fired}
                  </div>
                )}
              </div>

              <div className="sm:w-32 shrink-0 sm:text-right">
                <span className={`font-system text-lg tracking-[0.1em] ${
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
          <div className="text-center p-12 border border-sepia/30">
            <span className="font-system text-sepia tracking-[0.1em]">NO RECEIPTS RECORDED</span>
          </div>
        )}
      </div>
    </div>
  );
}
