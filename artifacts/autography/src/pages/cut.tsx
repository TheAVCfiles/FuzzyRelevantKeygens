import { useParams, Link } from 'wouter';
import {
  CircleAlert,
  FileAudio,
  FileText,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useGetPodcastCutKey, getGetPodcastCutKeyQueryKey } from '@workspace/api-client-react';

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function CutKeyView() {
  const params = useParams();
  const key = params.key as string;
  const cutKeyQuery = useGetPodcastCutKey(key, {
    query: {
      enabled: !!key,
      queryKey: getGetPodcastCutKeyQueryKey(key),
    },
  });

  const cutKey = cutKeyQuery.data;

  if (cutKeyQuery.isLoading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center p-8 text-[#d8a36c]">
        <LoaderCircle className="h-8 w-8 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  if (cutKeyQuery.error || !cutKey) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <CircleAlert className="mx-auto h-12 w-12 text-[#9e3e2d]" strokeWidth={1.5} />
        <h1 className="mt-5 font-serif text-3xl text-[#f0e8de]">Manifest not found</h1>
        <p className="mt-3 text-sm leading-6 text-[#b7aaa0]">
          The Cut Key link may be invalid or the manifest has been revoked.
        </p>
      </div>
    );
  }

  const {
    audio_url,
    integrity_disclaimer,
    transcript,
    transcript_sha256,
    audio_sha256,
    source_ids,
    generated_at,
    production,
    voice_disclosure,
    format_disclosure,
    manifest_sha256,
    manifest_version,
    source_metadata,
    claim_support,
    approval_records,
    execution_envelope,
  } = cutKey;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="border-b border-[#4f4944] pb-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#d8a36c]">
              <ShieldCheck className="h-4 w-4" /> Validated public manifest
            </div>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl text-[#f0e8de]">Cut Key: {key}</h1>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#80756c]">Canonical podcast manifest</span>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section className="border border-[#4f4944] bg-[#221f1d] p-5 sm:p-6" data-testid="cut-audio">
            <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">
              <FileAudio className="h-4 w-4" /> Synthesized Audio Sample
            </h2>
            <audio
              controls
              preload="metadata"
              src={audio_url}
              className="mt-4 w-full"
              data-testid="audio-player"
            >
              Your browser does not support the audio element.
            </audio>
            <div className="mt-4 border-t border-[#4f4944] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#b7aaa0]">Audio SHA-256</p>
              <p className="mt-1 break-all font-mono text-[10px] text-[#80756c]">{audio_sha256}</p>
            </div>
            <div className="mt-4 space-y-2 text-xs leading-5 text-[#b7aaa0]">
              <p>{voice_disclosure}</p>
              <p>{format_disclosure}</p>
              <p>Generated {formatDate(generated_at)} · {production.provider} / {production.model}</p>
            </div>
          </section>

          <section data-testid="cut-transcript">
             <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Annotated Transcript</h2>
             <pre className="whitespace-pre-wrap border border-[#4f4944] bg-[#221f1d] p-4 font-sans text-sm leading-6 text-[#f0e8de]">{transcript}</pre>
             <div className="mt-4 border-t border-[#4f4944] pt-4">
               <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#b7aaa0]">Transcript SHA-256</p>
               <p className="mt-1 break-all font-mono text-[10px] text-[#80756c]">{transcript_sha256}</p>
            </div>
          </section>
          {claim_support?.length ? (
            <section data-testid="cut-claim-support">
              <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Transcript Citation Map · Lineage, Not Independent Fact-Check</h2>
              <div className="space-y-3">
                {claim_support.map((claim) => (
                  <article key={claim.claim_id} className="border border-[#4f4944] bg-[#221f1d] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#c7a481]">
                      <span>{claim.claim_id} · {claim.segment.replaceAll('_', ' ')}</span>
                      <span>{claim.classification.replaceAll('_', ' ')}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#f0e8de]">{claim.speaker}: {claim.claim_text}</p>
                    <p className="mt-3 font-mono text-[9px] text-[#80756c]">Cited sources: {claim.source_ids.join(', ')}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="space-y-8">
          <section data-testid="cut-disclaimer">
             <div className="border border-[#895948] bg-[#482e29] p-4">
                <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#e4a38d]">
                  <ShieldAlert className="h-4 w-4" /> Integrity, Not Truth
                </h2>
                <p className="mt-3 text-xs leading-5 text-[#f0d0c4]">
                  {integrity_disclaimer}
                </p>
             </div>
          </section>

           <section data-testid="cut-source-ids">
             <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Public Source Metadata</h2>
             {source_metadata?.length ? (
               <div className="space-y-3">
                 {source_metadata.map((source) => (
                   <article key={source.id} className="border border-[#4f4944] bg-[#221f1d] p-3">
                     <a className="text-sm text-[#f0e8de] underline decoration-[#80756c] underline-offset-4" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                     <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#c7a481]">{source.id} · {source.classification.replaceAll('_', ' ')}</p>
                      <p className="mt-2 text-xs leading-5 text-[#b7aaa0]">Declared support boundary: {source.what_it_supports}</p>
                     <p className="mt-2 text-xs leading-5 text-[#e4a38d]">Uncertain: {source.what_remains_uncertain}</p>
                   </article>
                 ))}
               </div>
             ) : (
               <div className="flex flex-wrap gap-2">{source_ids.map((id) => <span key={id} className="border border-[#4f4944] px-2 py-1 font-mono text-[9px] text-[#b7aaa0]">{id}</span>)}</div>
             )}
           </section>
           {approval_records?.length ? (
             <section data-testid="cut-approval-records">
               <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Approval Records</h2>
               <div className="space-y-2">
                 {approval_records.map((record) => (
                   <article key={record.record_sha256} className="border border-[#4f4944] p-3 font-mono text-[9px] text-[#b7aaa0]">
                     <p className="text-[#f0e8de]">{record.record_type.replaceAll('_', ' ')}</p>
                     <p className="mt-1 break-all">Subject {record.subject_sha256}</p>
                     <p className="mt-1 break-all">Record {record.record_sha256}</p>
                   </article>
                 ))}
               </div>
             </section>
           ) : null}
           {execution_envelope?.length ? (
             <section data-testid="cut-execution-envelope">
               <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Execution Envelope</h2>
               <div className="space-y-2">
                 {execution_envelope.map((execution) => (
                   <article key={execution.execution_id} className="border border-[#4f4944] p-3 text-xs text-[#b7aaa0]">
                     <p className="text-[#f0e8de]">{execution.framework ?? 'Legacy runtime'} · {execution.agent.replaceAll('_', ' ')}</p>
                     <p className="mt-1 font-mono text-[9px]">
                       {execution.transport ? `${execution.transport.api.replaceAll('_', ' ')} · ${execution.transport.auth.replaceAll('_', ' ')}` : 'Transport not recorded'}
                     </p>
                   </article>
                 ))}
               </div>
             </section>
           ) : null}
           <section>
             <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Manifest SHA-256</h2>
             <p className="break-all font-mono text-[10px] text-[#80756c]">{manifest_sha256}</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#80756c]">Manifest version {manifest_version ?? 'legacy'}</p>
           </section>

        </div>
      </div>
    </div>
  );
}
