import { useEffect, useState } from 'react';
import { useParams, Link } from 'wouter';
import {
  Activity,
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  FileAudio,
  FileText,
  Link as LinkIcon,
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

function formatLatency(ms?: number) {
  if (!ms) return '0s';
  return (ms / 1000).toFixed(1) + 's';
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
    citations,
    line_mappings,
    approval_receipts,
    version,
    supersedes,
    superseded_by,
    executions,
    integrity_disclaimer,
    private_attestation,
    script_sha256,
    audio_sha256,
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
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#80756c] text-right">
            <span>Version {version}</span>
            {supersedes && <span className="block mt-1">Supersedes {supersedes}</span>}
            {superseded_by && <span className="block mt-1">Superseded by {superseded_by}</span>}
          </div>
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
          </section>

          {private_attestation.permitted_public_summary && (
            <section className="border border-[#46696e] bg-[#20383c] p-5 sm:p-6" data-testid="cut-attestation">
               <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#a8d0c9]">
                <ShieldCheck className="h-4 w-4" /> Publisher Attestation
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#c5d8d5]">
                "{private_attestation.permitted_public_summary}"
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[#8ea8a2]">
                 <span className="flex items-center gap-1 font-medium"><Check className="h-3 w-3" /> Attested by {private_attestation.signer || 'Verified Session'}</span>
              </div>
            </section>
          )}

          <section data-testid="cut-transcript">
             <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Annotated Transcript</h2>
             <div className="space-y-4">
               {line_mappings.map((line, idx) => (
                 <div key={idx} className="border border-[#4f4944] bg-[#221f1d] p-4 text-sm" data-testid={`cut-line-${idx}`}>
                   <div className="mb-2 flex items-center justify-between border-b border-[#3a3532] pb-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#80756c]">
                     <span className="text-[#d8a36c]">{line.speaker}</span>
                     <span>{line.classification.replaceAll('_', ' ')}</span>
                   </div>
                   <p className="leading-6 text-[#f0e8de]">{line.text}</p>
                   {line.source_ids.length > 0 && (
                     <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#80756c]">
                       <span>Sources:</span>
                       {line.source_ids.map(id => (
                         <span key={id} className="border border-[#4f4944] px-1.5 py-0.5">{id}</span>
                       ))}
                     </div>
                   )}
                 </div>
               ))}
             </div>
             <div className="mt-4 border-t border-[#4f4944] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#b7aaa0]">Script SHA-256</p>
              <p className="mt-1 break-all font-mono text-[10px] text-[#80756c]">{script_sha256}</p>
            </div>
          </section>
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

          <section data-testid="cut-citations">
             <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Citations</h2>
             <div className="space-y-2">
               {citations.map((citation) => (
                 <a
                   key={citation.id}
                   href={citation.url}
                   target="_blank"
                   rel="noreferrer"
                   className="group block border border-[#4f4944] bg-[#221f1d] p-3 transition-colors hover:border-[#d8a36c]"
                 >
                   <p className="line-clamp-2 text-sm leading-5 text-[#f0e8de] group-hover:text-[#d8a36c]">{citation.title}</p>
                   <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#80756c]">
                     <span className="truncate">{citation.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                     <ExternalLink className="h-3 w-3 shrink-0" />
                   </div>
                   <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#80756c]">
                     retrieved {formatDate(citation.retrieved_at)}
                   </div>
                 </a>
               ))}
             </div>
          </section>

          <section data-testid="cut-approvals">
             <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Chain of Approval</h2>
             <div className="space-y-2">
               {approval_receipts.map((receipt, idx) => (
                 <div key={idx} className="flex items-start justify-between gap-3 border border-[#4f4944] bg-[#221f1d] p-3 text-[10px] uppercase tracking-[0.08em]">
                   <div>
                     <p className="font-medium text-[#d8a36c]">{receipt.stage} Gate</p>
                     <p className="mt-1 text-[#b7aaa0]">{receipt.reviewer}</p>
                   </div>
                   <div className="text-right text-[#80756c]">
                     <p><Check className="inline h-3 w-3 text-[#9bc8a9]" /> cleared</p>
                     <p className="mt-1">{formatDate(receipt.decided_at)}</p>
                   </div>
                 </div>
               ))}
             </div>
          </section>

          <section data-testid="cut-executions">
             <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Agent Executions</h2>
             <div className="space-y-2">
               {executions.map((exec) => (
                 <div key={exec.execution_id} className="border border-[#4f4944] bg-[#221f1d] p-3 text-xs leading-5">
                   <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.08em]">
                     <span className="text-[#a8d0c9]">{exec.agent.replaceAll('_', ' ')}</span>
                     <span className={exec.status === 'completed' ? 'text-[#9bc8a9]' : 'text-[#e4a38d]'}>{exec.status}</span>
                   </div>
                   <div className="mt-2 text-[#b7aaa0]">
                     <span className="text-[#f0e8de]">{exec.model}</span> ({exec.provider})
                   </div>
                   {exec.tools.length > 0 && (
                     <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#80756c]">
                       Tools: {exec.tools.join(', ')}
                     </div>
                   )}
                   <div className="mt-2 flex items-center gap-2 font-mono text-[9px] uppercase text-[#80756c]">
                      <Activity className="h-3 w-3" /> {formatLatency(exec.latency_ms)}
                   </div>
                 </div>
               ))}
             </div>
          </section>

        </div>
      </div>
    </div>
  );
}
