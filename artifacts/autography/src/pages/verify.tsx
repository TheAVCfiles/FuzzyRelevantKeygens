import { useState } from "react";
import { useVerifyDrop } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

export function Verify() {
  const [lookup, setLookup] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const verifyMutation = useVerifyDrop();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookup.trim()) return;
    verifyMutation.mutate({ data: { lookup: lookup.trim() } }, {
      onSettled: () => setHasSearched(true)
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full">
      <div className="w-full text-center mb-12">
        <h1 className="font-serif text-4xl text-oyster mb-4">Registry Lookup</h1>
        <p className="font-sans text-sepia text-lg">Verify the authenticity of an artifact.</p>
      </div>

      <form onSubmit={handleVerify} className="w-full flex gap-4 mb-12">
        <Input 
          className="flex-1 h-12 bg-house border-sepia text-oyster font-mono rounded-none focus-visible:ring-brass placeholder:text-sepia/50"
          placeholder="Enter Drop ID or SHA-256 Hash..."
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
        />
        <Button type="submit" disabled={verifyMutation.isPending} className="w-32 tracking-[0.1em]">
          VERIFY
        </Button>
      </form>

      {hasSearched && verifyMutation.data && (
        <div className="w-full border border-sepia p-8 bg-house/50">
          <div className="font-system text-sm mb-6 flex items-center justify-between">
            <span className="text-sepia">STATUS</span>
            {verifyMutation.data.status === "SEALED" ? (
              <span className="text-brass tracking-[0.1em] font-bold">SEALED & AUTHENTIC</span>
            ) : (
              <span className="text-velvet tracking-[0.1em] font-bold">NOT IN REGISTRY</span>
            )}
          </div>

          {verifyMutation.data.status === "SEALED" && verifyMutation.data.drop && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 border-t border-sepia/30 pt-6">
                <div>
                  <div className="font-system text-[10px] text-sepia uppercase">Drop ID</div>
                  <div className="font-mono text-sm text-oyster mt-1">{verifyMutation.data.drop.drop_id}</div>
                </div>
                <div>
                  <div className="font-system text-[10px] text-sepia uppercase">Issued At</div>
                  <div className="font-mono text-sm text-oyster mt-1">
                    {new Date(verifyMutation.data.drop.seal.issued_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <Link href={`/drop/${verifyMutation.data.drop.drop_id}`}>
                  <Button variant="outline" className="w-full tracking-[0.1em]">VIEW ARTIFACT</Button>
                </Link>
              </div>
            </div>
          )}
          
          {verifyMutation.data.status === "NOT_IN_REGISTRY" && (
            <div className="border-t border-velvet/30 pt-6">
              <p className="font-sans text-oyster/80">
                This identifier or hash does not match any artifact sealed by this authority.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
