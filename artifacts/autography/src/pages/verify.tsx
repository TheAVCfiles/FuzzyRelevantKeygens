import { useState } from "react";
import {
  getGetPodcastCutKeyQueryKey,
  useGetPodcastCutKey,
  useVerifyDrop,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

export function Verify() {
  const [lookup, setLookup] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [submittedCutKey, setSubmittedCutKey] = useState("");

  const verifyMutation = useVerifyDrop();
  const cutKeyQuery = useGetPodcastCutKey(submittedCutKey, {
    query: {
      enabled: Boolean(submittedCutKey),
      queryKey: getGetPodcastCutKeyQueryKey(submittedCutKey),
    },
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookup.trim()) return;
    const value = lookup.trim();
    setHasSearched(true);
    if (value.startsWith("cut-")) {
      setSubmittedCutKey(value);
      return;
    }
    setSubmittedCutKey("");
    verifyMutation.mutate({ data: { lookup: value } });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 w-full min-h-[70vh] animate-in fade-in duration-700">
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center mb-10 sm:mb-16">
          <div className="font-system text-sepia text-[10px] tracking-[0.2em] mb-4 uppercase border border-sepia/30 inline-block px-3 py-1 bg-house/50">PUBLIC REGISTRY</div>
          <h1 className="font-serif text-4xl sm:text-5xl text-oyster mb-5">Artifact Lookup</h1>
          <p className="font-sans text-sepia text-sm sm:text-lg max-w-lg mx-auto">
             Check a Drop ID, payload hash, or podcast Cut Key against the public Autography registry.
          </p>
        </div>

        <form onSubmit={handleVerify} className="w-full flex flex-col sm:flex-row gap-4 mb-12 sm:mb-16 relative z-10">
          <Input 
            className="flex-1 h-14 bg-house/80 border-sepia/50 text-oyster font-mono rounded-none focus-visible:ring-1 focus-visible:ring-brass placeholder:text-sepia/40 px-5 text-sm shadow-inner"
            placeholder="Enter Drop ID, SHA-256 Hash, or Cut Key..."
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
          />
          <Button type="submit" disabled={verifyMutation.isPending || !lookup.trim()} className="w-full sm:w-40 h-14 tracking-[0.15em] bg-brass text-house hover:bg-white transition-colors disabled:opacity-50">
            {verifyMutation.isPending ? "VERIFYING..." : "VERIFY"}
          </Button>
        </form>
        {hasSearched && submittedCutKey && cutKeyQuery.error && (
          <div className="mb-8 border border-tally/40 bg-tally/5 p-4 text-sm leading-6 text-oyster" role="alert">
            No canonical podcast manifest matches that Cut Key.
          </div>
        )}
        {hasSearched && !submittedCutKey && verifyMutation.error && (
          <div className="mb-8 border border-tally/40 bg-tally/5 p-4 text-sm leading-6 text-oyster" role="alert">
            Verification could not be completed. The registry result is unchanged; check the identifier and retry.
          </div>
        )}

        {hasSearched && submittedCutKey && cutKeyQuery.data && (
          <div className="mb-8 w-full border border-brass/40 bg-house/80 p-6 sm:p-8">
            <div className="font-system text-[10px] uppercase tracking-[0.15em] text-brass">Podcast manifest verified</div>
            <p className="mt-3 font-serif text-2xl text-oyster">Exact transcript and audio identity found</p>
            <div className="mt-5 space-y-3 font-mono text-[10px] text-sepia">
              <p className="break-all">Manifest SHA-256: {cutKeyQuery.data.manifest_sha256}</p>
              <p className="break-all">Transcript SHA-256: {cutKeyQuery.data.transcript_sha256}</p>
              <p className="break-all">Audio SHA-256: {cutKeyQuery.data.audio_sha256}</p>
            </div>
            <Link href={`/cut/${cutKeyQuery.data.key}`}>
              <Button variant="outline" className="mt-6 w-full h-12 tracking-[0.15em] border-brass/40 text-brass hover:bg-brass/10">VIEW PODCAST MANIFEST</Button>
            </Link>
          </div>
        )}

        {hasSearched && !submittedCutKey && verifyMutation.data && (
          <div className="w-full border border-sepia/40 p-6 sm:p-10 bg-house/80 shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${verifyMutation.data.status === "SEALED" ? "bg-brass" : "bg-velvet"}`} />
            
            <div className="font-system text-xs sm:text-sm mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sepia/20 pb-6">
              <span className="text-sepia tracking-[0.1em]">REGISTRY STATUS</span>
              {verifyMutation.data.status === "SEALED" ? (
                 <span className="text-brass tracking-[0.15em] font-bold bg-brass/10 px-4 py-2 border border-brass/20 text-center">REGISTERED & UNCHANGED</span>
              ) : (
                <span className="text-velvet tracking-[0.15em] font-bold bg-velvet/10 px-4 py-2 border border-velvet/20 text-center">NOT IN REGISTRY</span>
              )}
            </div>

            {verifyMutation.data.status === "SEALED" && verifyMutation.data.drop && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                  <div>
                    <div className="font-system text-[10px] text-sepia uppercase tracking-[0.15em]">Drop ID</div>
                    <div className="font-mono text-xs sm:text-sm text-oyster mt-2 bg-house p-3 border border-sepia/20 truncate" title={verifyMutation.data.drop.drop_id}>
                      {verifyMutation.data.drop.drop_id}
                    </div>
                  </div>
                  <div>
                    <div className="font-system text-[10px] text-sepia uppercase tracking-[0.15em]">Issued At</div>
                    <div className="font-mono text-xs sm:text-sm text-oyster mt-2 bg-house p-3 border border-sepia/20">
                      {new Date(verifyMutation.data.drop.seal.issued_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <Link href={`/drop/${verifyMutation.data.drop.drop_id}`}>
                    <Button variant="outline" className="w-full h-12 tracking-[0.15em] border-brass/40 text-brass hover:bg-brass/10">VIEW FULL ARTIFACT</Button>
                  </Link>
                </div>
              </div>
            )}
            
            {verifyMutation.data.status === "NOT_IN_REGISTRY" && (
              <div className="pt-2">
                <p className="font-sans text-sm sm:text-base text-oyster/80 leading-relaxed text-center sm:text-left">
                  This identifier or hash does not match any artifact sealed by this authority. 
                  It may be forged, modified, or generated by an unauthorized party.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}