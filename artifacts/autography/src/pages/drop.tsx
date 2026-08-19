import { useGetDrop } from "@workspace/api-client-react";
import { useParams } from "wouter";

export function DropView() {
  const params = useParams();
  const id = params.id || "";

  const { data: drop, isLoading } = useGetDrop(id, {
    query: { queryKey: ["/api/drop", id], enabled: !!id }
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="font-system text-sepia animate-pulse tracking-[0.1em]">VERIFYING SEAL</div>
      </div>
    );
  }

  if (!drop) return null;

  return (
    <div className="flex-1 flex items-center justify-center p-8 relative">
      <div className="w-full max-w-3xl bg-oyster text-house shadow-2xl p-16 relative">
        
        <div className="absolute top-8 left-8 right-8 flex justify-between items-start">
          <div className="font-system text-xs tracking-widest text-sepia/80">
            ISSUED ARTIFACT
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-brass">{drop.drop_id}</div>
            <div className="font-mono text-xs text-sepia/60">EDITION {drop.edition.number} OF {drop.edition.of}</div>
          </div>
        </div>

        <div className="mt-16 mb-16 text-center">
          <h1 className="font-serif text-5xl mb-12 text-house">{drop.title}</h1>

          <div className="space-y-8 text-left max-w-xl mx-auto">
            {drop.claims.map((claim, idx) => (
              <div key={idx} className="relative">
                <p className="font-sans text-xl text-house leading-relaxed">
                  "{claim.text}"
                </p>
                <div className="mt-2 flex items-center gap-3 font-mono text-[10px]">
                  <span className="bg-house/10 px-2 py-0.5 text-house/70 uppercase">
                    {claim.source_class.replace("_", " ")}
                  </span>
                  <span className="text-brass">{claim.source_ref}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-sepia/30 pt-8 mt-16 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="font-system text-[10px] text-sepia/80 tracking-widest mb-2">SIGNED BY</div>
            <div className="font-sans text-lg">{drop.seal.signed_by}</div>
            <div className="font-mono text-xs text-brass mt-1">{drop.seal.scope_ref}</div>
          </div>
          <div className="text-right">
            <div className="font-system text-[10px] text-sepia/80 tracking-widest mb-2">SEALED AT</div>
            <div className="font-mono text-sm">{new Date(drop.seal.issued_at).toLocaleString()}</div>
            <div className="font-mono text-[10px] text-sepia mt-2 truncate w-48 ml-auto" title={drop.hash}>
              {drop.hash}
            </div>
          </div>
        </div>

        {drop.seal.signatures_simulated && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-system text-[10px] text-sepia/50 tracking-widest">
            SIMULATED MANIFEST — NO REAL C2PA GENERATED
          </div>
        )}
      </div>
    </div>
  );
}
