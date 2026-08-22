import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import {
  getGetPodcastRoomQueryKey,
  useAddPodcastSource,
  useDecidePodcastBrief,
  useCreatePodcastScript,
  useDecidePodcastScript,
  useGeneratePodcastBrief,
  useGetPodcastRoom,
  type PodcastBrief,
  type PodcastConcept,
  type PodcastRoom,
  type PodcastSource,
  type PodcastScriptWorkspace,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0);
}

function statusLabel(status?: string) {
  return (status ?? 'unknown').replaceAll('_', ' ');
}

function evidenceLabel(source: PodcastSource) {
  if (source.access_mode === 'manual_url') return { label: 'manual-only', className: 'text-[#9e3e2d]' };
  if (!source.source_id || source.post_title.toLowerCase().includes('pending')) return { label: 'thin evidence', className: 'text-[#9e3e2d]' };
  return { label: 'retrieved', className: 'text-[#365f67]' };
}

function hasSufficientEvidence(brief: PodcastBrief, sources: PodcastSource[]) {
  if (!brief.source_links?.length) return false;
  return brief.source_links.every((link) => {
    const source = sources.find((item) => item.id === link.source_id);
    return Boolean(
      source &&
      source.access_mode !== 'manual_url' &&
      !source.post_title.toLowerCase().includes('retrieval pending'),
    );
  });
}

function scoreTone(value: number) {
  if (value >= 80) return 'text-[#9e3e2d]';
  if (value >= 60) return 'text-[#365f67]';
  return 'text-[#73675f]';
}

function SourceRow({ source }: { source: PodcastSource }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#c7b9aa] py-4 last:border-b-0" data-testid={`row-source-${source.id}`}>
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#b34b36]">
          <span data-testid={`text-source-platform-${source.id}`}>{source.platform || 'public web'}</span>
          <span className="text-[#a99a8c]">/</span>
          <span className="truncate text-[#73675f]" data-testid={`text-source-community-${source.id}`}>{source.community || 'open signal'}</span>
        </div>
        <p className="line-clamp-2 font-serif text-[17px] leading-[1.25] text-[#201b19]" data-testid={`text-source-title-${source.id}`}>
          {source.post_title || 'Untitled source'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#73675f]">
          <span data-testid={`text-source-time-${source.id}`}>{formatDate(source.timestamp)}</span>
          <span>{formatNumber(source.engagement?.score)} signal</span>
          <span>{formatNumber(source.engagement?.comments)} responses</span>
          <span className="text-[#365f67]">{source.source_id ? `ID ${source.source_id}` : 'source id pending'}</span>
        </div>
      </div>
      <a
        href={source.source_url}
        target="_blank"
        rel="noreferrer"
        className="self-start p-1 text-[#73675f] transition-colors hover:text-[#b34b36]"
        data-testid={`link-source-${source.id}`}
        aria-label={`Open source ${source.post_title || source.id}`}
      >
        <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
      </a>
    </div>
  );
}

function ConceptCard({
  concept,
  sources,
  selected,
  onSelect,
}: {
  concept: PodcastConcept;
  sources: PodcastSource[];
  selected: boolean;
  onSelect: () => void;
}) {
  const compositeScore = Math.round((concept.relevance * 0.4) + (concept.urgency * 0.3) + (concept.engagement * 0.3));
  return (
    <div className={`podcast-focus w-full border text-left ${selected ? 'border-[#b34b36] bg-[#f8f1e8] shadow-[inset_3px_0_0_#b34b36]' : 'border-[#c7b9aa] bg-[#eee7dc]/60'}`} data-testid={`card-concept-${concept.id}`}>
      <button type="button" onClick={onSelect} className="group w-full text-left" data-testid={`button-concept-${concept.id}`}>
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#73675f]">
            <span className="text-[#b34b36]">0{concept.id.length > 2 ? 1 : concept.id}</span>
            <span className="h-px w-5 bg-[#c7b9aa]" />
            <span data-testid={`status-concept-${concept.id}`}>{statusLabel(concept.status)}</span>
          </div>
          <h3 className="font-serif text-[22px] leading-[1.1] tracking-[-0.02em] text-[#201b19]" data-testid={`text-concept-title-${concept.id}`}>
            {concept.title}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#5f554e]" data-testid={`text-concept-summary-${concept.id}`}>
            {concept.summary}
          </p>
        </div>
        <ChevronRight className={`mt-1 h-5 w-5 shrink-0 transition-transform ${selected ? 'translate-x-1 text-[#b34b36]' : 'text-[#a99a8c] group-hover:translate-x-1'}`} strokeWidth={1.5} />
      </div>
      </button>
      <div className="grid grid-cols-3 border-t border-[#c7b9aa] text-[10px] uppercase tracking-[0.08em] text-[#73675f] sm:grid-cols-6">
        <div className="border-r border-[#c7b9aa] px-3 py-3"><span className="block text-[9px]">relevance</span><strong className={`mt-1 block font-mono text-sm ${scoreTone(concept.relevance)}`}>{concept.relevance}</strong></div>
        <div className="border-r border-[#c7b9aa] px-3 py-3"><span className="block text-[9px]">urgency</span><strong className={`mt-1 block font-mono text-sm ${scoreTone(concept.urgency)}`}>{concept.urgency}</strong></div>
        <div className="border-r border-[#c7b9aa] px-3 py-3"><span className="block text-[9px]">engagement</span><strong className={`mt-1 block font-mono text-sm ${scoreTone(concept.engagement)}`}>{concept.engagement}</strong></div>
        <div className="border-r border-[#c7b9aa] px-3 py-3"><span className="block text-[9px]">freshness</span><strong className={`mt-1 block font-mono text-sm ${scoreTone(concept.freshness)}`}>{concept.freshness}</strong></div>
        <div className="border-r border-[#c7b9aa] px-3 py-3"><span className="block text-[9px]">source diversity</span><strong className={`mt-1 block font-mono text-sm ${scoreTone(concept.source_diversity)}`}>{concept.source_diversity}</strong></div>
        <div className="bg-[#2c2927] px-3 py-3 text-[#f0e8de]"><span className="block text-[9px] text-[#baaca0]">desk score</span><strong className="mt-1 block font-mono text-sm text-[#d8a36c]" data-testid={`text-concept-score-${concept.id}`}>{compositeScore}</strong></div>
      </div>
      {selected && <ConceptSourceComparison concept={concept} sources={sources} />}
    </div>
  );
}

function ConceptSourceComparison({ concept, sources }: { concept: PodcastConcept; sources: PodcastSource[] }) {
  const grouped = concept.source_ids.map((id) => sources.find((source) => source.id === id)).filter(Boolean) as PodcastSource[];
  const communities = new Map<string, PodcastSource[]>();
  grouped.forEach((source) => {
    const key = `${source.platform || 'Public web'} · ${source.community || 'open signal'}`;
    communities.set(key, [...(communities.get(key) ?? []), source]);
  });
  return (
    <div className="border-t border-[#c7b9aa] bg-[#f4eee5] p-4 sm:p-5" data-testid={`panel-comparison-${concept.id}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><p className="podcast-kicker">Source comparison</p><h4 className="mt-1 font-serif text-xl text-[#201b19]">How the idea travels</h4></div>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#73675f]">{communities.size} communities · {grouped.length} sources</span>
      </div>
      <p className="mb-4 border-l-2 border-[#365f67] pl-3 text-xs leading-5 text-[#5f554e]">Community signals are directional and not audience-wide measurement. Reddit is one platform in this comparison, not a proxy for everyone.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {[...communities.entries()].map(([community, items]) => (
          <div key={community} className="border border-[#c7b9aa] bg-[#eee7dc]/70 p-3" data-testid={`group-community-${community}`}>
            <div className="mb-2 flex items-center justify-between gap-2"><strong className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#365f67]">{community}</strong><span className="text-[10px] text-[#73675f]">{items.length} signal{items.length === 1 ? '' : 's'}</span></div>
            {items.map((source) => { const evidence = evidenceLabel(source); return <div key={source.id} className="border-t border-[#d4c8bb] py-2.5 first:border-t-0" data-testid={`comparison-source-${source.id}`}><p className="text-sm leading-5 text-[#201b19]">{source.post_title}</p><div className="mt-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.08em]"><span className={evidence.className}>{evidence.label}</span><span className="text-[#73675f]">{formatNumber(source.engagement?.score)} signal</span></div></div>; })}
          </div>
        ))}
      </div>
    </div>
  );
}

function BriefSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#544d48] py-5 last:border-b-0">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">{label}</p>
      {children}
    </section>
  );
}

function BriefPanel({
  brief,
  concept,
  onDecide,
  isDeciding,
  evidenceSufficient,
}: {
  brief: PodcastBrief | null;
  concept?: PodcastConcept;
  onDecide: (decision: 'approve' | 'reject') => void;
  isDeciding: boolean;
  evidenceSufficient: boolean;
}) {
  if (!brief) {
    return (
      <aside className="podcast-panel-dark min-h-[420px] p-5 sm:p-6" data-testid="empty-brief-panel">
        <div className="flex h-full min-h-[370px] flex-col justify-between">
          <div>
            <div className="mb-8 flex items-center justify-between">
              <span className="podcast-kicker !text-[#d8a36c]">Brief desk</span>
              <FileText className="h-5 w-5 text-[#80756c]" strokeWidth={1.5} />
            </div>
            <div className="border-l-2 border-[#b34b36] pl-4">
              <h2 className="font-serif text-3xl leading-tight text-[#f0e8de]">No brief in review.</h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[#b7aaa0]">
                Select a ranked concept, then generate a source-backed brief. Nothing moves to production without a human decision.
              </p>
            </div>
          </div>
          <div className="border-t border-[#4f4944] pt-4 font-mono text-[10px] uppercase leading-5 tracking-[0.1em] text-[#80756c]">
            <span className="text-[#d8a36c]">Gate 01</span> · human approval required<br />
            rendering and publishing are not available here
          </div>
        </div>
      </aside>
    );
  }

  const isDecided = brief.status !== 'draft';
  return (
    <aside className="podcast-panel-dark p-5 sm:p-6" data-testid="panel-brief">
      <div className="flex items-start justify-between gap-4 border-b border-[#4f4944] pb-5">
        <div>
          <p className="podcast-kicker !text-[#d8a36c]">Source-backed brief</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#80756c]" data-testid="text-brief-id">{brief.id}</p>
        </div>
        <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${brief.status === 'approved' ? 'border-[#87a895] text-[#9bc8a9]' : brief.status === 'rejected' ? 'border-[#c27a68] text-[#e39a86]' : 'border-[#d8a36c] text-[#d8a36c]'}`} data-testid="status-brief">
          {brief.status}
        </span>
      </div>
      <div className="py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#80756c]">Suggested title</p>
        <h2 className="mt-2 font-serif text-[28px] leading-[1.1] text-[#f0e8de]" data-testid="text-brief-title">{brief.suggested_title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs leading-5 text-[#b7aaa0]">
          <span>{concept?.title || `Concept ${brief.concept_id}`}</span>
          <span className="text-[#80756c]">·</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#d8a36c]" data-testid="text-brief-generated-mode">{brief.generated_mode.replaceAll('_', ' ')}</span>
        </div>
      </div>
      <div className="border-y border-[#4f4944]">
        <BriefSection label="Topic angle"><p className="text-sm leading-6 text-[#f0e8de]" data-testid="text-brief-topic-angle">{brief.topic_angle}</p></BriefSection>
        <BriefSection label="Audience pain"><p className="text-sm leading-6 text-[#f0e8de]" data-testid="text-brief-audience-pain">{brief.audience_pain}</p></BriefSection>
        <BriefSection label="Why now"><p className="text-sm leading-6 text-[#f0e8de]" data-testid="text-brief-why-now">{brief.why_now}</p></BriefSection>
        <BriefSection label="Key tensions">
          <ul className="space-y-2 text-sm leading-5 text-[#f0e8de]">
            {(brief.key_tensions ?? []).map((tension, index) => <li key={`${tension}-${index}`} className="flex gap-2" data-testid={`text-brief-tension-${index}`}><span className="text-[#d8a36c]">/</span>{tension}</li>)}
          </ul>
        </BriefSection>
        <BriefSection label="Episode spine">
          <ol className="space-y-3 text-sm leading-5 text-[#f0e8de]">
            {(brief.episode_outline ?? []).map((item, index) => (
              <li key={`${item.segment}-${index}`} className="flex gap-3" data-testid={`row-brief-outline-${index}`}>
                <span className="font-mono text-[10px] text-[#d8a36c]">0{index + 1}</span>
                <span><strong className="font-medium">{item.segment}</strong><span className="mt-0.5 block text-[#b7aaa0]">{item.purpose}</span></span>
              </li>
            ))}
          </ol>
        </BriefSection>
        <BriefSection label="Selected source set">
          <p className="text-xs leading-5 text-[#b7aaa0]" data-testid="text-brief-source-set">
            {brief.selected_source_ids?.length ?? brief.source_links?.length ?? 0} sources recorded for this draft · concept {brief.concept_id}
          </p>
        </BriefSection>
      </div>
      <div className="mt-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Evidence trail</p>
        <div className="space-y-2">
          {(brief.source_links ?? []).map((source) => (
            <a key={source.source_id} href={source.url} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 border border-[#4f4944] px-3 py-3 text-xs text-[#d8cbc1] transition-colors hover:border-[#d8a36c]" data-testid={`link-brief-source-${source.source_id}`}>
               <span className="min-w-0 truncate">{source.label || source.source_id}<span className="ml-2 text-[9px] uppercase tracking-[0.08em] text-[#80756c]">retrieved {formatDate(source.retrieved_at)}</span></span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#d8a36c] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} />
            </a>
          ))}
        </div>
      </div>
      {!!brief.risk_notes?.length && (
        <div className="mt-5 border border-[#895948] bg-[#482e29] p-4" data-testid="panel-brief-risks">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#e4a38d]"><CircleAlert className="h-3.5 w-3.5" /> Risk notes</div>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-[#f0d0c4]">
            {brief.risk_notes.map((note, index) => <li key={`${note}-${index}`} data-testid={`text-brief-risk-${index}`}>{note}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Decision gate</p>
        <p className="mb-4 text-xs leading-5 text-[#b7aaa0]">{brief.approval_note || 'Approval only clears this brief for a separately gated script and audio workflow.'}</p>
        {isDecided ? (
          <div className={`flex items-center gap-2 border px-3 py-3 font-mono text-[10px] uppercase tracking-[0.08em] ${brief.status === 'approved' ? 'border-[#577964] text-[#9bc8a9]' : 'border-[#895948] text-[#e39a86]'}`} data-testid="status-decision-final">
            {brief.status === 'approved' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {brief.status === 'approved' ? 'Cleared for separately gated workflow' : 'Rejected — revision required'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="default" size="sm" disabled={isDeciding || !evidenceSufficient} onClick={() => onDecide('approve')} className="bg-[#d8a36c] text-[#2c2927] hover:bg-[#e5b77e] disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-approve-brief" aria-describedby={!evidenceSufficient ? 'approval-evidence-warning' : undefined}>
              {isDeciding ? <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5" />} Approve
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isDeciding} onClick={() => onDecide('reject')} className="border-[#806057] text-[#e4a38d] hover:bg-[#482e29]" data-testid="button-reject-brief">
              <X className="mr-2 h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        )}
        {!isDecided && !evidenceSufficient && (
          <p id="approval-evidence-warning" className="mt-3 border border-[#895948] bg-[#482e29] px-3 py-3 text-xs leading-5 text-[#e4a38d]" data-testid="text-approval-evidence-warning">
            Approval unavailable until evidence trail is sufficient.
          </p>
        )}
      </div>
    </aside>
  );
}

function RoomSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" data-testid="loading-podcast-room">
      <div className="space-y-5">
        <div className="podcast-skeleton h-36 w-full" />
        <div className="podcast-skeleton h-20 w-3/4" />
        {[1, 2, 3].map((item) => <div key={item} className="podcast-skeleton h-40 w-full" />)}
      </div>
      <div className="podcast-skeleton min-h-[520px] w-full" />
    </div>
  );
}

function ScriptWorkspacePanel({
  script,
  onCreate,
  onDecide,
  isCreating,
  isDeciding,
  canCreate,
}: {
  script: PodcastScriptWorkspace | null;
  onCreate: () => void;
  onDecide: (decision: 'approve' | 'reject') => void;
  isCreating: boolean;
  isDeciding: boolean;
  canCreate: boolean;
}) {
  if (!script) {
    return (
      <section className="podcast-panel border-l-2 border-[#365f67] p-5" data-testid="panel-script-gate">
        <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#365f67]" strokeWidth={1.5} /><p className="podcast-kicker">Script workspace / gate 02</p></div>
        <h2 className="mt-2 font-serif text-2xl text-[#201b19]">Brief first. Script second.</h2>
        <p className="mt-3 text-sm leading-6 text-[#5f554e]">Only an approved brief can open this script-only workspace. Every section will retain its source trail, and audio remains blocked until a separate review.</p>
        <Button type="button" className="mt-5 w-full bg-[#365f67] text-[#f0e8de] hover:bg-[#2d5057] disabled:opacity-40" disabled={!canCreate || isCreating} onClick={onCreate} data-testid="button-open-script-workspace">
          {isCreating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
          {isCreating ? 'Opening workspace' : canCreate ? 'Open script workspace' : 'Awaiting brief approval'}
        </Button>
        <p className="mt-3 font-mono text-[9px] uppercase leading-4 tracking-[0.08em] text-[#73675f]">No audio render or publish action is available here</p>
      </section>
    );
  }

  const isDecided = script.status !== 'draft';
  return (
    <section className="podcast-panel-dark p-5 sm:p-6" data-testid="panel-script-workspace">
      <div className="flex items-start justify-between gap-4 border-b border-[#4f4944] pb-5">
        <div><p className="podcast-kicker !text-[#d8a36c]">Script-only workspace</p><p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#80756c]" data-testid="text-script-id">{script.id}</p></div>
        <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${script.status === 'approved' ? 'border-[#87a895] text-[#9bc8a9]' : script.status === 'rejected' ? 'border-[#c27a68] text-[#e39a86]' : 'border-[#d8a36c] text-[#d8a36c]'}`} data-testid="status-script">{script.status}</span>
      </div>
      <h2 className="mt-5 font-serif text-[28px] leading-[1.1] text-[#f0e8de]" data-testid="text-script-title">{script.title}</h2>
      <div className="mt-5 space-y-4 border-y border-[#4f4944] py-2">
        {script.sections.map((section, index) => (
          <div key={`${section.segment}-${index}`} className="border-b border-[#4f4944] py-4 last:border-b-0" data-testid={`section-script-${index}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#c7a481]">{section.segment}</p>
            <p className="mt-2 text-sm leading-6 text-[#f0e8de]">{section.script}</p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#9bc8a9]">sources: {section.source_ids.join(', ')}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 border border-[#577964] bg-[#294338] p-4" data-testid="panel-script-safety">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#b7d7c0]"><ShieldCheck className="h-3.5 w-3.5" /> Safe drafting boundary</div>
        <p className="mt-2 text-xs leading-5 text-[#d4e7d8]">{script.safety_note}</p>
      </div>
      <div className="mt-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Script review gate</p>
        <p className="mb-4 text-xs leading-5 text-[#b7aaa0]">{script.review_note}</p>
        {isDecided ? (
          <div className={`flex items-center gap-2 border px-3 py-3 font-mono text-[10px] uppercase tracking-[0.08em] ${script.status === 'approved' ? 'border-[#577964] text-[#9bc8a9]' : 'border-[#895948] text-[#e39a86]'}`} data-testid="status-script-decision-final">
            {script.status === 'approved' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {script.status === 'approved' ? 'Reviewed — audio remains separately gated' : 'Rejected — revision required'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" disabled={isDeciding} onClick={() => onDecide('approve')} className="bg-[#d8a36c] text-[#2c2927] hover:bg-[#e5b77e]" data-testid="button-approve-script"><ShieldCheck className="mr-2 h-3.5 w-3.5" /> Approve script</Button>
            <Button type="button" variant="outline" size="sm" disabled={isDeciding} onClick={() => onDecide('reject')} className="border-[#806057] text-[#e4a38d] hover:bg-[#482e29]" data-testid="button-reject-script"><X className="mr-2 h-3.5 w-3.5" /> Reject</Button>
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[#4f4944] pt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-[#80756c]"><span>Audio status</span><span className="text-[#e4a38d]" data-testid="status-audio-gate">{statusLabel(script.audio_status)}</span></div>
      <div className="mt-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Attached provenance</p>
       <div className="space-y-2">{script.provenance.map((source) => <a key={source.source_id} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border border-[#4f4944] px-3 py-3 text-xs text-[#d8cbc1] hover:border-[#d8a36c]" data-testid={`link-script-source-${source.source_id}`}><span className="min-w-0 truncate">{source.label}<span className="ml-2 text-[9px] uppercase tracking-[0.08em] text-[#80756c]">retrieved {formatDate(source.retrieved_at)}</span></span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#d8a36c]" /></a>)}</div>
      </div>
    </section>
  );
}

export function Podcast() {
  const queryClient = useQueryClient();
  const roomQuery = useGetPodcastRoom({ query: { queryKey: getGetPodcastRoomQueryKey() } });
  const room = roomQuery.data as PodcastRoom | undefined;
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [brief, setBrief] = useState<PodcastBrief | null>(null);
  const [script, setScript] = useState<PodcastScriptWorkspace | null>(null);
  const [localError, setLocalError] = useState('');

  const concepts = room?.concepts ?? [];
  const sources = room?.sources ?? [];
  const selectedConcept = useMemo(() => concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0], [concepts, selectedConceptId]);

  useEffect(() => {
    if (!selectedConceptId && concepts[0]) setSelectedConceptId(concepts[0].id);
  }, [concepts, selectedConceptId]);

  const addSource = useAddPodcastSource({
    mutation: {
      onSuccess: () => {
        setSourceUrl('');
        setLocalError('');
        queryClient.invalidateQueries({ queryKey: getGetPodcastRoomQueryKey() });
      },
    },
  });
  const generateBrief = useGeneratePodcastBrief({
    mutation: {
      onSuccess: (nextBrief) => {
        setBrief(nextBrief);
        setLocalError('');
      },
    },
  });
  const decideBrief = useDecidePodcastBrief({
    mutation: {
      onSuccess: (nextBrief) => {
        setBrief(nextBrief);
        if (nextBrief.status !== 'approved') setScript(null);
        queryClient.invalidateQueries({ queryKey: getGetPodcastRoomQueryKey() });
      },
    },
  });
  const createScript = useCreatePodcastScript({
    mutation: {
      onSuccess: (nextScript) => { setScript(nextScript); setLocalError(''); },
    },
  });
  const decideScript = useDecidePodcastScript({
    mutation: {
      onSuccess: (nextScript) => { setScript(nextScript); setLocalError(''); },
    },
  });

  const submitSource = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = sourceUrl.trim();
    if (!value || !/^https?:\/\/\S+/i.test(value)) {
      setLocalError('Enter a complete public URL beginning with http:// or https://.');
      return;
    }
    setLocalError('');
    addSource.mutate({ data: { source_url: value } });
  };

  const generate = () => {
    if (!selectedConcept) return;
    setLocalError('');
    generateBrief.mutate({ data: { concept_id: selectedConcept.id, source_ids: selectedConcept.source_ids } });
  };

  const roomError = roomQuery.error ? 'The intelligence room could not be loaded. Try again to reconnect to the source desk.' : '';
  const mutationError = localError || (addSource.error ? 'This source could not be added. Check the URL and try again.' : '') || (generateBrief.error ? 'The brief could not be generated. Your source room is unchanged.' : '') || (decideBrief.error ? 'The decision was not recorded. Nothing was moved forward.' : '') || (createScript.error ? 'Only an approved brief can open a script workspace.' : '') || (decideScript.error ? 'The script review was not recorded.' : '');
  const evidenceSufficient = brief ? hasSufficientEvidence(brief, sources) : false;

  return (
    <div className="podcast-room min-h-[100dvh]">
      <header className="border-b border-[#a99a8c] bg-[#2c2927] px-5 py-5 text-[#f0e8de] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#d8a36c]">
              <span className="h-2 w-2 rounded-full bg-[#b34b36]" />
              Autography / production room
            </div>
            <h1 className="podcast-display text-4xl leading-none sm:text-5xl" data-testid="text-podcast-title">Podcast intelligence</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#b7aaa0]">A source-backed editorial desk for deciding what deserves a human-led episode.</p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#b7aaa0]">
            <span className="h-2 w-2 rounded-full bg-[#87a895]" />
            consented signals only
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
        <div className="mb-7 grid gap-4 border-b border-[#c7b9aa] pb-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="podcast-kicker">Editorial intelligence / 01</p>
            <h2 className="podcast-display mt-2 text-3xl text-[#201b19] sm:text-4xl" data-testid="text-room-heading">What is moving, and why it matters now.</h2>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[#73675f]">
            <span data-testid="text-source-count">{sources.length} sources</span>
            <span className="h-4 w-px bg-[#c7b9aa]" />
            <span data-testid="text-concept-count">{concepts.length} ranked concepts</span>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[#73675f] hover:bg-[#d9cdbf]" onClick={() => roomQuery.refetch()} disabled={roomQuery.isFetching} data-testid="button-refresh-room" aria-label="Refresh intelligence room">
              <RefreshCw className={`h-4 w-4 ${roomQuery.isFetching ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {roomQuery.isLoading ? <RoomSkeleton /> : roomError ? (
          <div className="podcast-panel mx-auto max-w-2xl p-8 text-center" data-testid="error-podcast-room">
            <CircleAlert className="mx-auto h-7 w-7 text-[#b34b36]" strokeWidth={1.5} />
            <h2 className="mt-4 font-serif text-3xl text-[#201b19]">The room is offline.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#73675f]">{roomError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-6 border-[#9e3e2d] text-[#9e3e2d]" onClick={() => roomQuery.refetch()} data-testid="button-retry-podcast-room">Retry connection</Button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="min-w-0">
                <div className="podcast-panel podcast-gridline mb-6 p-5 sm:p-6" data-testid="panel-source-loader">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="podcast-kicker">Bring a source into the room</p>
                      <h2 className="mt-2 font-serif text-2xl text-[#201b19]">Load a public URL. Keep the trail.</h2>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#365f67]"><ShieldCheck className="h-4 w-4" strokeWidth={1.5} /> provenance visible</div>
                  </div>
                  <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={submitSource}>
                    <Input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." aria-label="Source URL" className="h-12 flex-1 border-[#b9aa9b] bg-[#f4eee5] text-[#201b19] placeholder:text-[#998c81]" data-testid="input-source-url" />
                    <Button type="submit" disabled={addSource.isPending} size="default" className="h-12 bg-[#2c2927] text-[#f0e8de] hover:bg-[#413b37]" data-testid="button-add-source">
                      {addSource.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />}
                      {addSource.isPending ? 'Loading source' : 'Load source'}
                    </Button>
                  </form>
                  {mutationError && <p className="mt-3 flex items-center gap-2 text-xs text-[#9e3e2d]" data-testid="status-podcast-error"><CircleAlert className="h-3.5 w-3.5" /> {mutationError}</p>}
                  <p className="mt-3 max-w-2xl font-mono text-[10px] uppercase leading-5 tracking-[0.08em] text-[#73675f]">Consent boundary: URLs are inspected as public signals. Reddit language is summarized, never copied verbatim.</p>
                </div>

                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="podcast-kicker">Ranked concepts</p>
                    <h2 className="mt-1 font-serif text-2xl text-[#201b19]" data-testid="text-ranked-concepts-heading">The editorial shortlist</h2>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#73675f]">relevance × urgency × response</span>
                </div>

                {concepts.length ? (
                  <div className="space-y-3" data-testid="list-concepts">
                    {concepts.map((concept) => <ConceptCard key={concept.id} concept={concept} sources={sources} selected={concept.id === selectedConcept?.id} onSelect={() => { setSelectedConceptId(concept.id); setBrief(null); }} />)}
                  </div>
                ) : (
                  <div className="podcast-panel p-8 text-center" data-testid="empty-concepts">
                    <Target className="mx-auto h-7 w-7 text-[#b34b36]" strokeWidth={1.5} />
                    <h3 className="mt-4 font-serif text-2xl text-[#201b19]">No concepts ranked yet.</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#73675f]">Load a consented public source to start the desk. The room will keep its evidence trail as concepts form.</p>
                  </div>
                )}

                <div className="podcast-panel mt-6 p-5 sm:p-6" data-testid="panel-source-ledger">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="podcast-kicker">Source ledger</p>
                      <h2 className="mt-1 font-serif text-2xl text-[#201b19]">What the room is listening to</h2>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#73675f]">{sources.length ? `retrieved ${formatDate(sources[0]?.retrieved_at)}` : 'awaiting source'}</span>
                  </div>
                  {sources.length ? <div className="mt-2">{sources.map((source) => <SourceRow key={source.id} source={source} />)}</div> : <p className="py-8 text-center text-sm text-[#73675f]" data-testid="empty-sources">No source URLs loaded. The ledger will appear here with provenance and retrieval context.</p>}
                </div>
              </section>

              <div className="space-y-4">
                 <BriefPanel brief={brief} concept={selectedConcept} onDecide={(decision) => brief && decideBrief.mutate({ id: brief.id, data: { decision } })} isDeciding={decideBrief.isPending} evidenceSufficient={evidenceSufficient} />
                 <ScriptWorkspacePanel script={script} canCreate={brief?.status === 'approved'} isCreating={createScript.isPending} isDeciding={decideScript.isPending} onCreate={() => brief && createScript.mutate({ id: brief.id })} onDecide={(decision) => script && decideScript.mutate({ id: script.id, data: { decision } })} />
                <div className="podcast-panel p-5" data-testid="panel-next-action">
                  <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#b34b36]" strokeWidth={1.5} /><p className="podcast-kicker">Next editorial action</p></div>
                  <p className="mt-3 text-sm leading-6 text-[#5f554e]">You are looking at <strong className="font-medium text-[#201b19]">{selectedConcept?.title || 'the shortlist'}</strong>. Generate its brief only when the source trail is sufficient for a producer review.</p>
                  <Button type="button" className="mt-5 w-full bg-[#b34b36] text-[#f9f0e5] hover:bg-[#9e3e2d]" disabled={!selectedConcept || generateBrief.isPending} onClick={generate} data-testid="button-generate-brief">
                    {generateBrief.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" strokeWidth={1.5} />}
                    {generateBrief.isPending ? 'Compiling evidence' : 'Generate source-backed brief'}
                  </Button>
                  <p className="mt-3 text-center font-mono text-[9px] uppercase leading-4 tracking-[0.08em] text-[#73675f]">No script, audio, or publish action in this room</p>
                </div>
                <div className="border-l-2 border-[#365f67] bg-[#dbe4e0]/60 p-4" data-testid="notice-podcast-data">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#365f67]">Data notice</p>
                  <p className="mt-2 text-xs leading-5 text-[#4b5f60]">{room?.data_notice || 'Audience signals are consented public observations. They are directional context, not a measure of every listener.'}</p>
                </div>
                <div className="flex items-center justify-between border-t border-[#c7b9aa] pt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-[#73675f]" data-testid="status-rendering-gate">
                  <span>Rendering status</span>
                  <span className="text-[#9e3e2d]">{statusLabel(room?.rendering_status || 'blocked until approval')}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default Podcast;