import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileText,
  Headphones,
  LoaderCircle,
  Plus,
  Search,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  Activity,
  History,
} from 'lucide-react';
import {
  getGetPodcastRoomQueryKey,
  getGetPodcastScriptByBriefQueryKey,
  useAddPodcastSource,
  useCreatePodcastFilterPreset,
  useDeletePodcastFilterPreset,
  useDecidePodcastBrief,
  useCreatePodcastScript,
  useCreatePodcastReleaseKit,
  useDecidePodcastAudio,
  useGeneratePodcastAudio,
  useDecidePodcastScript,
  useGeneratePodcastBrief,
  useSearchPodcastContexts,
  useGetPodcastScriptByBrief,
  useGetPodcastRoom,
  useRenamePodcastFilterPreset,
  useResetPodcastDemo,
  useAttestPodcastCuttingRoom,
  type PodcastBrief,
  type PodcastConcept,
  type PodcastFilterPreset,
  type PodcastRoom,
  type PodcastSource,
  type PodcastScriptWorkspace,
  type PodcastReleaseKit,
  type PodcastAudioClip,
  type PodcastContextSearchResponse,
  type PodcastDevelopmentPlan,
  type PodcastDecisionHistoryEntry,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DevelopmentStudio } from './podcast/DevelopmentStudio';

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
  if (source.access_mode === 'approved_live') return { label: 'approved live', className: 'text-[#365f67]' };
  if (source.access_mode === 'fixture') return { label: 'synthetic fixture', className: 'text-[#73675f]' };
  if (source.access_mode === 'public_url') return { label: 'legacy / unverified', className: 'text-[#9e3e2d]' };
  if (!source.source_id || source.post_title.toLowerCase().includes('pending')) return { label: 'thin evidence', className: 'text-[#9e3e2d]' };
  return { label: 'retrieved', className: 'text-[#365f67]' };
}

function hasSufficientEvidence(brief: PodcastBrief, sources: PodcastSource[]) {
  if (!brief.source_links?.length) return false;
  return brief.source_links.every((link) => {
    const source = sources.find((item) => item.id === link.source_id);
    return Boolean(
      source &&
      (source.access_mode === 'approved_live' || source.access_mode === 'fixture') &&
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
  const evidence = evidenceLabel(source);
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
          <span className={evidence.className}>{evidence.label}</span>
        </div>
        {source.access_mode === 'approved_live' && (
          <div className="mt-2 border-l-2 border-[#365f67] pl-3 text-[11px] leading-5 text-[#5f554e]">
            <p>Approved live result · {source.source_class?.replaceAll('_', ' ')} · policy {source.policy_reference}</p>
            {!!source.evidence_gaps?.length && <p className="text-[#9e3e2d]">Gap: {source.evidence_gaps.join(' ')}</p>}
          </div>
        )}
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
  onVisibleSourcesChange,
  presets,
  onSavePreset,
  onRenamePreset,
  onDeletePreset,
}: {
  concept: PodcastConcept;
  sources: PodcastSource[];
  selected: boolean;
  onSelect: () => void;
  onVisibleSourcesChange: (sourceIds: string[]) => void;
  presets: PodcastFilterPreset[];
  onSavePreset: (platforms: string[], communities: string[]) => void;
  onRenamePreset: (preset: PodcastFilterPreset) => void;
  onDeletePreset: (preset: PodcastFilterPreset) => void;
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
          <div className="mt-4 grid gap-3 border-t border-[#d4c8bb] pt-4 text-xs leading-5 text-[#5f554e] sm:grid-cols-3" data-testid={`panel-insight-gap-${concept.id}`}>
            <div><p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#365f67]">Observed now</p><p className="mt-1">{concept.observed_signal}</p></div>
            <div><p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#365f67]">Supported context</p><p className="mt-1">{concept.supported_context}</p></div>
            <div><p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#b34b36]">Route next</p><p className="mt-1 font-medium text-[#201b19]">{concept.next_reviewer} · {concept.recommended_route.replaceAll('_', ' ')}</p></div>
          </div>
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
      {selected && <ConceptSourceComparison concept={concept} sources={sources} onVisibleSourcesChange={onVisibleSourcesChange} presets={presets} onSavePreset={onSavePreset} onRenamePreset={onRenamePreset} onDeletePreset={onDeletePreset} />}
    </div>
  );
}

function ConceptSourceComparison({
  concept,
  sources,
  onVisibleSourcesChange,
  presets,
  onSavePreset,
  onRenamePreset,
  onDeletePreset,
}: {
  concept: PodcastConcept;
  sources: PodcastSource[];
  onVisibleSourcesChange: (sourceIds: string[]) => void;
  presets: PodcastFilterPreset[];
  onSavePreset: (platforms: string[], communities: string[]) => void;
  onRenamePreset: (preset: PodcastFilterPreset) => void;
  onDeletePreset: (preset: PodcastFilterPreset) => void;
}) {
  const grouped = concept.source_ids.map((id) => sources.find((source) => source.id === id)).filter(Boolean) as PodcastSource[];
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [communityFilters, setCommunityFilters] = useState<string[]>([]);
  const availablePlatforms = [...new Set(grouped.map((source) => source.platform || 'Public web'))];
  const availableCommunities = [...new Set(grouped.map((source) => source.community || 'open signal'))];
  const filtered = grouped.filter((source) => {
    const platform = source.platform || 'Public web';
    const community = source.community || 'open signal';
    return (!platforms.length || platforms.includes(platform)) && (!communityFilters.length || communityFilters.includes(community));
  });
  const groups = new Map<string, PodcastSource[]>();
  filtered.forEach((source) => {
    const key = `${source.platform || 'Public web'} · ${source.community || 'open signal'}`;
    groups.set(key, [...(groups.get(key) ?? []), source]);
  });
  useEffect(() => {
    onVisibleSourcesChange(filtered.map((source) => source.id));
  }, [filtered.map((source) => source.id).join(','), onVisibleSourcesChange]);
  const toggle = (value: string, current: string[], update: (next: string[]) => void) => {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  const hasFilter = platforms.length > 0 || communityFilters.length > 0;
  const applyPreset = (preset: PodcastFilterPreset) => {
    setPlatforms(preset.platforms.filter((item) => availablePlatforms.includes(item)));
    setCommunityFilters(preset.communities.filter((item) => availableCommunities.includes(item)));
  };
  return (
    <div className="border-t border-[#c7b9aa] bg-[#f4eee5] p-4 sm:p-5" data-testid={`panel-comparison-${concept.id}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><p className="podcast-kicker">Source comparison</p><h4 className="mt-1 font-serif text-xl text-[#201b19]">How the idea travels</h4></div>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#73675f]" data-testid={`text-comparison-count-${concept.id}`}>{groups.size} communities · showing {filtered.length} of {grouped.length} sources</span>
      </div>
      <p className="mb-4 border-l-2 border-[#365f67] pl-3 text-xs leading-5 text-[#5f554e]">Community signals are directional and not audience-wide measurement. Reddit is one platform in this comparison, not a proxy for everyone.</p>
      <div className="mb-4 space-y-3 border border-[#c7b9aa] bg-[#eee7dc]/60 p-3" data-testid={`filters-comparison-${concept.id}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 font-mono text-[9px] uppercase tracking-[0.1em] text-[#73675f]">Platform</span>
          {availablePlatforms.map((platform) => (
            <button key={platform} type="button" onClick={() => toggle(platform, platforms, setPlatforms)} aria-pressed={platforms.includes(platform)} className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em] transition-colors ${platforms.includes(platform) ? 'border-[#365f67] bg-[#365f67] text-[#f4eee5]' : 'border-[#b8a99b] text-[#5f554e] hover:border-[#365f67]'}`} data-testid={`filter-platform-${concept.id}-${platform}`}>
              {platform}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 font-mono text-[9px] uppercase tracking-[0.1em] text-[#73675f]">Community</span>
          {availableCommunities.map((community) => (
            <button key={community} type="button" onClick={() => toggle(community, communityFilters, setCommunityFilters)} aria-pressed={communityFilters.includes(community)} className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em] transition-colors ${communityFilters.includes(community) ? 'border-[#b34b36] bg-[#b34b36] text-[#f4eee5]' : 'border-[#b8a99b] text-[#5f554e] hover:border-[#b34b36]'}`} data-testid={`filter-community-${concept.id}-${community}`}>
              {community}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em]">
          <span className={hasFilter ? 'text-[#b34b36]' : 'text-[#73675f]'} data-testid={`text-comparison-filter-${concept.id}`}>
            {hasFilter ? `Active filter · ${filtered.length} of ${grouped.length} sources visible` : `All ${grouped.length} sources visible`}
          </span>
          {hasFilter && <button type="button" onClick={() => { setPlatforms([]); setCommunityFilters([]); }} className="text-[#365f67] underline underline-offset-2" data-testid={`button-clear-filters-${concept.id}`}>Clear filters</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[#c7b9aa] pt-3">
          <span className="w-20 font-mono text-[9px] uppercase tracking-[0.1em] text-[#73675f]">Presets</span>
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center border border-[#b8a99b]">
              <button type="button" onClick={() => applyPreset(preset)} className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#365f67] hover:bg-[#e4dbd0]" data-testid={`button-apply-preset-${preset.id}`}>{preset.name}</button>
              <button type="button" onClick={() => onRenamePreset(preset)} className="border-l border-[#b8a99b] px-1.5 py-1 text-[#73675f] hover:text-[#b34b36]" aria-label={`Rename preset ${preset.name}`} data-testid={`button-rename-preset-${preset.id}`}>rename</button>
              <button type="button" onClick={() => onDeletePreset(preset)} className="border-l border-[#b8a99b] px-1.5 py-1 text-[#73675f] hover:text-[#b34b36]" aria-label={`Remove preset ${preset.name}`} data-testid={`button-delete-preset-${preset.id}`}>×</button>
            </div>
          ))}
          <button type="button" disabled={!hasFilter} onClick={() => onSavePreset(platforms, communityFilters)} className="border border-[#365f67] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#365f67] hover:bg-[#dce7e5] disabled:cursor-not-allowed disabled:opacity-40" data-testid={`button-save-preset-${concept.id}`}>+ save current</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[...groups.entries()].map(([community, items]) => (
          <div key={community} className="border border-[#c7b9aa] bg-[#eee7dc]/70 p-3" data-testid={`group-community-${community}`}>
            <div className="mb-2 flex items-center justify-between gap-2"><strong className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#365f67]">{community}</strong><span className="text-[10px] text-[#73675f]">{items.length} signal{items.length === 1 ? '' : 's'}</span></div>
            {items.map((source) => { const evidence = evidenceLabel(source); return <div key={source.id} className="border-t border-[#d4c8bb] py-2.5 first:border-t-0" data-testid={`comparison-source-${source.id}`}><p className="text-sm leading-5 text-[#201b19]">{source.post_title}</p><div className="mt-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.08em]"><span className={evidence.className}>{evidence.label}</span><span className="text-[#73675f]">{formatNumber(source.engagement?.score)} signal</span></div></div>; })}
          </div>
        ))}
      </div>
      {!filtered.length && <p className="border border-dashed border-[#b8a99b] p-5 text-center text-sm text-[#73675f]" data-testid={`empty-comparison-${concept.id}`}>No sources match this selection. Clear a filter to restore the comparison.</p>}
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

function DecisionHistoryPanel({ entries }: { entries: PodcastDecisionHistoryEntry[] }) {
  return (
    <section className="podcast-panel p-5" data-testid="panel-decision-history">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="podcast-kicker">Decision history</p>
          <h2 className="mt-1 font-serif text-2xl text-[#201b19]">Review trail</h2>
        </div>
        <History className="h-5 w-5 text-[#365f67]" strokeWidth={1.5} />
      </div>
      <p className="mt-2 text-xs leading-5 text-[#73675f]">
        Read-only brief and script decisions for the selected workspace.
      </p>
      {entries.length ? (
        <ol className="mt-4 space-y-3" data-testid="list-decision-history">
          {entries.map((entry, index) => (
            <li key={`${entry.artifact_type}-${entry.artifact_id}-${entry.decided_at}-${index}`} className="border-l-2 border-[#365f67] bg-[#eee7dc]/70 px-3 py-3" data-testid={`decision-history-${index}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#201b19]">
                  {entry.artifact_type} · {entry.decision}
                </strong>
                <time className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#73675f]" dateTime={entry.decided_at}>
                  {new Date(entry.decided_at).toLocaleString()}
                </time>
              </div>
              <p className="mt-2 text-xs text-[#5f554e]">
                Reviewer <span className="font-medium text-[#201b19]">{entry.reviewer}</span>
              </p>
              <p className="mt-1 break-all font-mono text-[9px] uppercase tracking-[0.07em] text-[#73675f]">
                {entry.artifact_id}
              </p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#9e3e2d]">
                Artifact creation boundary · none
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 border border-dashed border-[#b8a99b] p-4 text-center text-xs leading-5 text-[#73675f]" data-testid="empty-decision-history">
          No brief or script decisions have been recorded for this workspace.
        </p>
      )}
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
        {brief.editorial_archetype && brief.selected_format && (
          <BriefSection label="Validated development hypothesis">
            <p className="text-sm text-[#f0e8de]" data-testid="text-brief-archetype">{brief.editorial_archetype.label} · {statusLabel(brief.selected_format.format)}</p>
            <p className="mt-2 text-xs leading-5 text-[#b7aaa0]">{brief.editorial_archetype.non_impersonation_disclosure}</p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[.08em] text-[#d8a36c]">{brief.selected_format.forecast_label}</p>
          </BriefSection>
        )}
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

function ProtectedAudioPlayer({ clip }: { clip: PodcastAudioClip }) {
  const [objectUrl, setObjectUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let nextUrl = '';
    fetch(clip.audio_url, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Audio stream returned ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        nextUrl = URL.createObjectURL(blob);
        setObjectUrl(nextUrl);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Audio unavailable');
      });
    return () => {
      controller.abort();
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [clip.audio_url]);

  if (error) return <p className="mt-3 text-xs text-[#e4a38d]">{error}</p>;
  if (!objectUrl) return <p className="mt-3 flex items-center gap-2 text-xs text-[#c5d8d5]"><LoaderCircle className="h-3 w-3 animate-spin" />Loading protected audio…</p>;
  return <audio className="mt-3 w-full" controls preload="metadata" src={objectUrl} data-testid="audio-podcast-clip">Your browser does not support audio playback.</audio>;
}

function ScriptWorkspacePanel({
  script,
  onCreate,
  onDecide,
  isCreating,
  isDeciding,
  canCreate,
  releaseKit,
  onCreateReleaseKit,
  isCreatingReleaseKit,
  audioClip,
  onAudioDecision,
  onGenerateAudio,
  isDecidingAudio,
  isGeneratingAudio,
}: {
  script: PodcastScriptWorkspace | null;
  onCreate: () => void;
  onDecide: (decision: 'approve' | 'reject') => void;
  isCreating: boolean;
  isDeciding: boolean;
  canCreate: boolean;
  releaseKit: PodcastReleaseKit | null;
  onCreateReleaseKit: () => void;
  isCreatingReleaseKit: boolean;
  audioClip: PodcastAudioClip | null;
  onAudioDecision: (decision: 'approve' | 'reject') => void;
  onGenerateAudio: () => void;
  isDecidingAudio: boolean;
  isGeneratingAudio: boolean;
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
        <div><p className="podcast-kicker !text-[#d8a36c]">Performed sample script</p><p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#80756c]" data-testid="text-script-id">{script.id}</p></div>
        <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${script.status === 'approved' ? 'border-[#87a895] text-[#9bc8a9]' : script.status === 'rejected' ? 'border-[#c27a68] text-[#e39a86]' : 'border-[#d8a36c] text-[#d8a36c]'}`} data-testid="status-script">{script.status}</span>
      </div>
      {script.compatibility_normalized && (
        <div className="mt-4 border border-[#6b9698] bg-[#20383c] px-3 py-2.5 text-xs leading-5 text-[#c5d8d5]" role="status" data-testid="notice-compatibility-normalized">
          This older workspace was safely upgraded to the current format. Your approval status and audio gates are unchanged.
        </div>
      )}
      <h2 className="mt-5 font-serif text-[28px] leading-[1.1] text-[#f0e8de]" data-testid="text-script-title">{script.title}</h2>
      <div className="mt-5 space-y-4 border-y border-[#4f4944] py-2">
        {script.sections.map((section, index) => (
          <div key={`${section.segment}-${index}`} className="border-b border-[#4f4944] py-4 last:border-b-0" data-testid={`section-script-${index}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#c7a481]">{section.segment}</p>
             <p className="mt-2 whitespace-pre-line text-base leading-7 text-[#f0e8de]">{section.script}</p>
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
      <div className="mt-5 border border-[#365f67] bg-[#20383c] p-4" data-testid="panel-release-kit-gate">
        <div className="flex items-center justify-between gap-3">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a8d0c9]">Release desk / gate 03</p><p className="mt-1 font-serif text-xl text-[#f0e8de]">Package the episode</p></div>
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#d8a36c]">{releaseKit ? 'staged' : 'not prepared'}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#c5d8d5]">Prepare titles, notes, chapters, promotion drafts, accessibility notes, and a receipt-ready provenance summary. Audio and publishing remain blocked.</p>
        {!releaseKit && (
          <Button type="button" size="sm" disabled={script.status !== 'approved' || isCreatingReleaseKit} onClick={onCreateReleaseKit} className="mt-4 bg-[#d8a36c] text-[#2c2927] hover:bg-[#e5b77e] disabled:opacity-40" data-testid="button-create-release-kit">
            {isCreatingReleaseKit ? <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="mr-2 h-3.5 w-3.5" />}
            {isCreatingReleaseKit ? 'Preparing release kit' : script.status === 'approved' ? 'Prepare release kit' : 'Awaiting script approval'}
          </Button>
        )}
        {releaseKit && <div className="mt-4 border-t border-[#46696e] pt-4" data-testid="panel-release-kit">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a8d0c9]">Title options</p>
          <div className="mt-2 flex flex-wrap gap-2">{releaseKit.title_options.map((title, index) => <span key={`${title}-${index}`} className="border border-[#6b9698] px-2 py-1 text-xs text-[#f0e8de]">{title}</span>)}</div>
          <p className="mt-4 text-sm leading-6 text-[#f0e8de]">{releaseKit.episode_description}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#a8d0c9]">Chapters</p><ul className="mt-2 space-y-1 text-xs text-[#c5d8d5]">{releaseKit.chapters.map((chapter) => <li key={chapter.label}><span className="text-[#d8a36c]">{chapter.timing}</span> · {chapter.label}</li>)}</ul></div>
            <div><p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#a8d0c9]">Promotion drafts</p><ul className="mt-2 space-y-1 text-xs text-[#c5d8d5]">{releaseKit.promotion_copy.map((item) => <li key={item.channel}><span className="text-[#d8a36c]">{item.channel}:</span> {item.copy}</li>)}</ul></div>
          </div>
          <div className="mt-4 border-t border-[#46696e] pt-3 text-xs leading-5 text-[#c5d8d5]"><strong className="font-medium text-[#f0e8de]">Next reviewer:</strong> {releaseKit.next_reviewer}<br /><strong className="font-medium text-[#f0e8de]">Audio:</strong> {statusLabel(releaseKit.audio_status)} · <strong className="font-medium text-[#f0e8de]">Publishing:</strong> {statusLabel(releaseKit.publishing_status)}</div>
          <div className="mt-4 border-t border-[#46696e] pt-4" data-testid="panel-audio-studio">
            <div className="flex items-center gap-2"><Headphones className="h-4 w-4 text-[#d8a36c]" /><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a8d0c9]">Listening studio / gate 04</p></div>
             <p className="mt-2 text-xs leading-5 text-[#c5d8d5]">A human must clear the original synthetic house-host performance before this approved sample can be rendered. It performs the script itself—never production instructions. Publishing remains blocked.</p>
            {script.audio_status === 'awaiting_audio_approval' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" disabled={isDecidingAudio} onClick={() => onAudioDecision('approve')} className="bg-[#d8a36c] text-[#2c2927]" data-testid="button-approve-audio">Approve audio</Button>
                <Button size="sm" variant="outline" disabled={isDecidingAudio} onClick={() => onAudioDecision('reject')} className="border-[#806057] text-[#e4a38d]" data-testid="button-reject-audio">Reject</Button>
              </div>
            )}
            {script.audio_status === 'ready_to_generate' && (
              <Button size="sm" disabled={isGeneratingAudio} onClick={onGenerateAudio} className="mt-3 w-full bg-[#b34b36] text-[#f9f0e5]" data-testid="button-generate-audio">
                {isGeneratingAudio ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Headphones className="mr-2 h-4 w-4" />}
                 {isGeneratingAudio ? 'Performing sample' : 'Generate performed sample'}
              </Button>
            )}
            {script.audio_status === 'rejected' && <p className="mt-3 border border-[#895948] px-3 py-2 text-xs text-[#e4a38d]">Audio rejected. No file was rendered.</p>}
            {audioClip && (
              <div className="mt-4 border border-[#6b9698] bg-[#182d30] p-3" data-testid="audio-player-ready">
                 <div className="flex items-center justify-between gap-3"><strong className="font-serif text-lg text-[#f0e8de]">Performed sample ready</strong><span className="font-mono text-[9px] uppercase text-[#9bc8a9]">{audioClip.duration_seconds}s · WAV</span></div>
                <ProtectedAudioPlayer clip={audioClip} />
                <p className="mt-3 text-[11px] leading-5 text-[#c5d8d5]">{audioClip.voice_disclosure}</p>
                <details className="mt-2 text-xs text-[#c5d8d5]"><summary className="cursor-pointer font-mono text-[9px] uppercase tracking-[.1em] text-[#d8a36c]">Transcript & provenance</summary><p className="mt-2 leading-5">{audioClip.transcript}</p><p className="mt-2 text-[#9bc8a9]">{audioClip.provenance_summary}</p></details>
                {audioClip.cut_key && (
                  <div className="mt-4 border-t border-[#46696e] pt-4">
                    <Link href={`/cut/${audioClip.cut_key}`} className="inline-flex items-center gap-2 border border-[#d8a36c] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#d8a36c] transition-colors hover:bg-[#d8a36c] hover:text-[#182d30]" data-testid="link-cut-key">
                      Open Public Cut Key <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>}
      </div>
      <div className="mt-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7a481]">Attached provenance</p>
       <div className="space-y-2">{script.provenance.map((source) => <a key={source.source_id} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border border-[#4f4944] px-3 py-3 text-xs text-[#d8cbc1] hover:border-[#d8a36c]" data-testid={`link-script-source-${source.source_id}`}><span className="min-w-0 truncate">{source.label}<span className="ml-2 text-[9px] uppercase tracking-[0.08em] text-[#80756c]">retrieved {formatDate(source.retrieved_at)}</span></span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#d8a36c]" /></a>)}</div>
      </div>
    </section>
  );
}

import {
  type PodcastGroundedRun,
  type PodcastGroundingSource,
  type PodcastAgentExecution,
} from '@workspace/api-client-react';

function formatLatency(ms?: number) {
  if (!ms) return '0s';
  return (ms / 1000).toFixed(1) + 's';
}

function GroundedRunDesk({
  run,
  onAttest,
  isAttesting,
}: {
  run: PodcastGroundedRun;
  onAttest: (decision: 'add' | 'decline', data: any) => void;
  isAttesting: boolean;
}) {
  const [attested, setAttested] = useState(false);
  const [rawText, setRawText] = useState('');
  const [publicSummary, setPublicSummary] = useState('');
  const [authorizedUses, setAuthorizedUses] = useState<string[]>(['development']);

  const toggleUse = (use: string) => {
    setAuthorizedUses(current =>
      current.includes(use) ? current.filter(u => u !== use) : [...current, use]
    );
  };

  const handleAttest = (decision: 'add' | 'decline') => {
    if (decision === 'add') {
      onAttest('add', {
        decision: 'add',
        raw_text: rawText || undefined,
        permitted_public_summary: publicSummary || undefined,
        authorized_uses: authorizedUses.length > 0 ? authorizedUses : undefined,
      });
    } else {
      onAttest('decline', { decision: 'decline' });
    }
  };

  return (
    <section className="podcast-panel mb-6 overflow-hidden border-[#365f67]" data-testid="panel-grounded-run">
      <div className="bg-[#20383c] p-5 text-[#f0e8de] sm:p-6 border-b border-[#46696e]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#a8d0c9]" />
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a8d0c9]">Run Context</p>
            </div>
            <h2 className="mt-2 font-serif text-3xl">Grounded Query Desk</h2>
          </div>
          <div className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] ${run.runtime_status === 'Failed' ? 'border-[#e4a38d] text-[#e4a38d]' : run.runtime_status === 'Live Gemini' ? 'border-[#a8d0c9] text-[#a8d0c9]' : 'border-[#d8a36c] text-[#d8a36c]'}`} data-testid="status-runtime">
            {run.runtime_status}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <h3 className="font-serif text-xl text-[#201b19]">Grounded sources & gaps</h3>
          <p className="mt-2 text-sm leading-6 text-[#5f554e]">{run.grounding_support}</p>

          <div className="mt-4 space-y-3">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#365f67]">Retrieved Sources</h4>
            {run.sources.map(source => (
              <div key={source.id} className="border border-[#c7b9aa] bg-[#eee7dc]/70 p-3 text-sm">
                <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-[#201b19] hover:text-[#b34b36] hover:underline">{source.title}</a>
                <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-[#73675f]">
                  <span className="text-[#365f67]">{source.classification.replaceAll('_', ' ')}</span>
                  <span>{formatDate(source.retrieved_at)}</span>
                </div>
                {source.what_remains_uncertain && (
                  <p className="mt-2 border-t border-[#d4c8bb] pt-2 text-[11px] leading-5 text-[#9e3e2d]">Gap: {source.what_remains_uncertain}</p>
                )}
                <p className="mt-2 text-[11px] leading-5 text-[#5f554e]">{source.aggregate_summary}</p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#365f67]">
                  {source.source_identifier} · policy {source.policy_reference} · consent {source.consent_reference ?? 'not applicable'}
                </p>
              </div>
            ))}
          </div>

          {run.uncertainties.length > 0 && (
            <div className="mt-5 border border-[#895948] bg-[#482e29] p-4 text-[#f0d0c4]">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#e4a38d]">Uncertainties</h4>
              <ul className="mt-2 space-y-1 text-xs leading-5">
                {run.uncertainties.map((u, idx) => (
                  <li key={idx}>/ {u}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#365f67]">Agent Executions</h4>
            <div className="mt-3 space-y-2">
              {run.agent_executions.map(exec => (
                <div key={exec.execution_id} className="border border-[#c7b9aa] bg-[#f4eee5] p-3 text-xs">
                  <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.1em]">
                    <span className="text-[#201b19] font-semibold">{exec.agent.replaceAll('_', ' ')}</span>
                    <span className={exec.status === 'completed' ? 'text-[#365f67]' : 'text-[#9e3e2d]'}>{exec.status}</span>
                  </div>
                  {exec.activity && <p className="mt-1 text-[#5f554e]">{exec.activity}</p>}
                  <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-[#73675f]">
                    <span>{exec.model}</span>
                    <span>{formatLatency(exec.latency_ms)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[#46696e] bg-[#20383c] p-4" data-testid="panel-attestation">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#a8d0c9]">
              <ShieldCheck className="h-3.5 w-3.5" /> Cutting-room Context
            </div>
            <p className="mt-2 text-xs leading-5 text-[#c5d8d5]">
              Add private attestation to bridge gaps in the public signal, or decline to proceed with public context only.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#8ea8a2]">Private Raw Text (Optional)</span>
                <textarea
                  className="mt-1 w-full border border-[#46696e] bg-[#182d30] p-2 text-xs text-[#f0e8de] placeholder-[#46696e]"
                  rows={2}
                  placeholder="Only visible to production agents..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#8ea8a2]">Permitted Public Summary (Optional)</span>
                <textarea
                  className="mt-1 w-full border border-[#46696e] bg-[#182d30] p-2 text-xs text-[#f0e8de] placeholder-[#46696e]"
                  rows={2}
                  placeholder="Appears on Cut Key..."
                  value={publicSummary}
                  onChange={(e) => setPublicSummary(e.target.value)}
                />
              </label>
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#8ea8a2]">Authorized Uses</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['development', 'script_context', 'public_summary'].map(use => (
                    <button
                      key={use}
                      type="button"
                      onClick={() => toggleUse(use)}
                      className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] ${authorizedUses.includes(use) ? 'border-[#a8d0c9] bg-[#a8d0c9] text-[#182d30]' : 'border-[#46696e] text-[#8ea8a2]'}`}
                    >
                      {use.replaceAll('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" disabled={isAttesting} onClick={() => handleAttest('add')} className="bg-[#a8d0c9] text-[#182d30] hover:bg-[#8ea8a2]" data-testid="button-attest-add">
                {isAttesting ? <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />} Add context
              </Button>
              <Button type="button" variant="outline" disabled={isAttesting} onClick={() => handleAttest('decline')} className="border-[#46696e] text-[#a8d0c9] hover:bg-[#182d30]" data-testid="button-attest-decline">
                Decline
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Podcast() {
  const queryClient = useQueryClient();
  const roomQuery = useGetPodcastRoom({ query: { queryKey: getGetPodcastRoomQueryKey() } });
  const room = roomQuery.data as PodcastRoom | undefined;
  const scriptWorkspaceQuery = useGetPodcastScriptByBrief(room?.selected_brief_id ?? '', {
    query: {
      queryKey: getGetPodcastScriptByBriefQueryKey(room?.selected_brief_id ?? ''),
      enabled: Boolean(room?.selected_brief_id),
      staleTime: 0,
    },
  });
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [isDevValidated, setIsDevValidated] = useState(false);
  const [developmentPlan, setDevelopmentPlan] = useState<PodcastDevelopmentPlan | null>(null);
  const [visibleSourceIds, setVisibleSourceIds] = useState<string[]>([]);
  const [brief, setBrief] = useState<PodcastBrief | null>(null);
  const [script, setScript] = useState<PodcastScriptWorkspace | null>(null);
  const [searchQuery, setSearchQuery] = useState('What context did the final cut leave out?');
  const [searchAudience, setSearchAudience] = useState<'consumers' | 'clients' | 'users'>('consumers');
  const [searchUseCase, setSearchUseCase] = useState<'recap' | 'development' | 'publicity' | 'audience_strategy' | 'cultural_context'>('recap');
  const [searchProvider, setSearchProvider] = useState<'google_public_web'>('google_public_web');
  const [searchWindow, setSearchWindow] = useState<'past_24_hours' | 'past_7_days' | 'past_30_days'>('past_7_days');
  const [searchResult, setSearchResult] = useState<PodcastContextSearchResponse | null>(null);
  const [searchInFlight, setSearchInFlight] = useState(false);
  const [localError, setLocalError] = useState('');

  const concepts = searchInFlight ? [] : searchResult?.results.map((item) => item.concept) ?? room?.concepts ?? [];
  const searchedSources = searchInFlight ? [] : searchResult?.results.flatMap((item) => item.sources) ?? [];
  const sources = [...new Map([...(room?.sources ?? []), ...searchedSources].map((source) => [source.id, source])).values()];
  const selectedConcept = useMemo(() => concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0], [concepts, selectedConceptId]);
  const createPreset = useCreatePodcastFilterPreset({
    mutation: {
      onSuccess: () => {
        setLocalError('');
        queryClient.invalidateQueries({ queryKey: getGetPodcastRoomQueryKey() });
      },
    },
  });
  const renamePreset = useRenamePodcastFilterPreset({
    mutation: {
      onSuccess: () => {
        setLocalError('');
        queryClient.invalidateQueries({ queryKey: getGetPodcastRoomQueryKey() });
      },
    },
  });
  const deletePreset = useDeletePodcastFilterPreset({
    mutation: {
      onSuccess: () => {
        setLocalError('');
        queryClient.invalidateQueries({ queryKey: getGetPodcastRoomQueryKey() });
      },
    },
  });
  const handleVisibleSourcesChange = useCallback((sourceIds: string[]) => {
    setVisibleSourceIds((current) => current.join(',') === sourceIds.join(',') ? current : sourceIds);
  }, []);
  const handleDevelopmentPlanChange = useCallback((nextPlan: PodcastDevelopmentPlan | null) => {
    setDevelopmentPlan(nextPlan);
    setIsDevValidated(nextPlan?.status === 'validated');
  }, []);

  useEffect(() => {
    if (!selectedConceptId && concepts[0]) {
      setSelectedConceptId(concepts[0].id);
      setVisibleSourceIds(concepts[0].source_ids);
      setIsDevValidated(false);
      setDevelopmentPlan(null);
    }
  }, [concepts, selectedConceptId]);

  useEffect(() => {
    if (scriptWorkspaceQuery.data) {
      setScript(scriptWorkspaceQuery.data);
      return;
    }
    if (!room?.selected_brief_id || scriptWorkspaceQuery.error) setScript(null);
  }, [room?.selected_brief_id, scriptWorkspaceQuery.data, scriptWorkspaceQuery.error]);

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
      onSuccess: (nextScript) => {
        setScript(nextScript);
        setLocalError('');
        queryClient.invalidateQueries({ queryKey: getGetPodcastRoomQueryKey() });
      },
    },
  });
  const createReleaseKit = useCreatePodcastReleaseKit({
    mutation: {
      onSuccess: (releaseKit) => {
        setScript((current) => current ? { ...current, release_kit: releaseKit } : current);
        setLocalError('');
      },
    },
  });
  const searchContexts = useSearchPodcastContexts({
    mutation: {
      onMutate: () => {
        setSearchInFlight(true);
        setSearchResult(null);
        setSelectedConceptId(null);
        setVisibleSourceIds([]);
        setIsDevValidated(false);
        setDevelopmentPlan(null);
        setBrief(null);
        setScript(null);
        setLocalError('');
      },
      onSuccess: (result) => {
        setSearchResult(result);
        queryClient.invalidateQueries({ queryKey: getGetPodcastRoomQueryKey() });
        const first = result.results[0]?.concept;
        if (first) {
          setSelectedConceptId(first.id);
          setVisibleSourceIds(first.source_ids);
          setIsDevValidated(false);
          setDevelopmentPlan(null);
          setBrief(null);
          setScript(null);
        }
        setLocalError('');
      },
      onSettled: () => setSearchInFlight(false),
    },
  });
  const decideAudio = useDecidePodcastAudio({
    mutation: { onSuccess: (nextScript) => { setScript(nextScript); setLocalError(''); } },
  });
  const generateAudio = useGeneratePodcastAudio({
    mutation: {
      onSuccess: (clip) => {
        setScript((current) => current ? { ...current, audio_status: 'generated', audio_clip: clip, release_kit: current.release_kit ? { ...current.release_kit, audio_status: 'generated' } : null } : current);
        setLocalError('');
      },
    },
  });

  const resetDemo = useResetPodcastDemo({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetPodcastRoomQueryKey() });
        setSearchResult(null);
        setSearchQuery(data.pre_staged_input.query || 'What context did the final cut leave out?');
        setSearchProvider(data.pre_staged_input.provider);
        setSearchWindow(data.pre_staged_input.window);
        setSelectedConceptId(null);
        setVisibleSourceIds([]);
        setDevelopmentPlan(null);
        setBrief(null);
        setScript(null);
        setLocalError('');
      },
    },
  });

  const attestContext = useAttestPodcastCuttingRoom({
    mutation: {
      onSuccess: () => {
        setLocalError('');
      },
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
    if (!selectedConcept || developmentPlan?.status !== 'validated') return;
    setLocalError('');
    generateBrief.mutate({
      data: {
        concept_id: selectedConcept.id,
        source_ids: visibleSourceIds,
        development_plan_id: developmentPlan.id,
      },
    });
  };

  const roomError = roomQuery.error ? 'The intelligence room could not be loaded. Try again to reconnect to the source desk.' : '';
  const mutationError = localError || (searchContexts.error ? 'The context search could not be completed. The previous saved room is restored and no new results were approved.' : '') || (addSource.error ? 'This source could not be added. Check the URL and try again.' : '') || (createPreset.error ? 'This comparison preset could not be saved.' : '') || (renamePreset.error ? 'This comparison preset could not be renamed.' : '') || (deletePreset.error ? 'This comparison preset could not be removed.' : '') || (generateBrief.error ? 'The brief could not be generated. Your source room is unchanged.' : '') || (decideBrief.error ? 'The decision was not recorded. Nothing was moved forward.' : '') || (createScript.error ? 'Only an approved brief can open a script workspace.' : '') || (decideScript.error ? 'The script review was not recorded.' : '') || (createReleaseKit.error ? 'The release kit could not be prepared. Audio and publishing remain blocked.' : '') || (decideAudio.error ? 'The audio decision was not recorded.' : '') || (generateAudio.error ? 'The house voice could not render this clip. The approval and source trail are unchanged.' : '') || (scriptWorkspaceQuery.error && room?.selected_brief_id ? 'The saved script workspace could not be retrieved. It may no longer be approved.' : '');
  const evidenceSufficient = brief ? hasSufficientEvidence(brief, sources) : false;

  return (
    <div className="podcast-room min-h-[100dvh] overflow-x-hidden">
      <header className="border-b border-[#a99a8c] bg-[#2c2927] px-5 py-5 text-[#f0e8de] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#d8a36c]">
              <span className="h-2 w-2 rounded-full bg-[#b34b36]" />
              Autography / production room
            </div>
            <h1 className="podcast-display text-4xl leading-none sm:text-5xl" data-testid="text-podcast-title">Podcast hit development</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#b7aaa0]">A source-backed studio for testing what could earn attention—without promising popularity or surrendering human control.</p>
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
            <Button type="button" variant="outline" size="sm" className="h-8 border-[#c7b9aa] text-[#73675f] hover:bg-[#d9cdbf]" onClick={() => resetDemo.mutate()} disabled={resetDemo.isPending} data-testid="button-reset-demo">
              {resetDemo.isPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />} Reset Demo
            </Button>
            <span className="h-4 w-px bg-[#c7b9aa]" />
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
                <div className="podcast-panel mb-6 overflow-hidden border-[#9f8b78]" data-testid="panel-context-search">
                  <div className="bg-[#2c2927] p-5 text-[#f0e8de] sm:p-6">
                    <div className="flex items-center gap-2"><Search className="h-4 w-4 text-[#d8a36c]" /><p className="podcast-kicker !text-[#d8a36c]">Entertainment context search</p></div>
                    <h2 className="mt-2 font-serif text-3xl">Search beyond the reaction.</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b7aaa0]">Rank public-community patterns, trade context, interviews, audience research, and expert commentary into an auditable editorial package.</p>
                  </div>
                  <form className="grid min-w-0 gap-3 bg-[#f4eee5] p-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]" onSubmit={(event) => { event.preventDefault(); searchContexts.mutate({ data: { query: searchQuery.trim(), audience: searchAudience, use_case: searchUseCase, provider: searchProvider, window: searchWindow } }); }}>
                    <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} minLength={2} required className="h-11 min-w-0 border-[#b9aa9b] bg-[#fffaf2] text-[#201b19]" aria-label="Entertainment context search" data-testid="input-context-search" />
                    <select value={searchAudience} onChange={(event) => setSearchAudience(event.target.value as typeof searchAudience)} className="h-11 min-w-0 w-full border border-[#b9aa9b] bg-[#fffaf2] px-3 text-sm text-[#201b19]" aria-label="Audience"><option value="consumers">Consumers</option><option value="clients">Clients</option><option value="users">Users</option></select>
                    <select value={searchUseCase} onChange={(event) => setSearchUseCase(event.target.value as typeof searchUseCase)} className="h-11 min-w-0 w-full border border-[#b9aa9b] bg-[#fffaf2] px-3 text-sm text-[#201b19]" aria-label="Use case"><option value="recap">Recap</option><option value="development">Development</option><option value="publicity">Publicity</option><option value="audience_strategy">Audience strategy</option><option value="cultural_context">Cultural context</option></select>
                    <select value={searchProvider} onChange={(event) => setSearchProvider(event.target.value as typeof searchProvider)} className="h-11 min-w-0 w-full border border-[#b9aa9b] bg-[#fffaf2] px-3 text-sm text-[#201b19]" aria-label="Approved current-source provider" data-testid="select-current-provider"><option value="google_public_web">Google public web · approved</option></select>
                    <select value={searchWindow} onChange={(event) => setSearchWindow(event.target.value as typeof searchWindow)} className="h-11 min-w-0 w-full border border-[#b9aa9b] bg-[#fffaf2] px-3 text-sm text-[#201b19]" aria-label="Current context window" data-testid="select-current-window"><option value="past_24_hours">Past 24 hours</option><option value="past_7_days">Past 7 days</option><option value="past_30_days">Past 30 days</option></select>
                    <Button type="submit" disabled={searchContexts.isPending} className="h-11 bg-[#b34b36] text-[#fffaf2]" data-testid="button-search-contexts">{searchContexts.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Search</Button>
                  </form>
                  {searchResult && <div className="border-t border-[#c7b9aa] px-5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-[#365f67]" data-testid="status-context-search">{searchResult.results.length} ranked packages · {searchResult.provider.replaceAll('_', ' ')} · {searchResult.window.replaceAll('_', ' ')} · policy {searchResult.policy_reference}</div>}
                  {searchContexts.error && <div className="border-t border-[#c7b9aa] px-5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-[#9e3e2d]" data-testid="status-context-search-failed">Search failed · previous saved room restored · no new results approved</div>}
                </div>
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
                     {concepts.map((concept) => <ConceptCard key={concept.id} concept={concept} sources={sources} presets={room?.filter_presets ?? []} selected={concept.id === selectedConcept?.id} onSelect={() => { setSelectedConceptId(concept.id); setVisibleSourceIds(concept.source_ids); setBrief(null); setScript(null); setIsDevValidated(false); setDevelopmentPlan(null); }} onVisibleSourcesChange={handleVisibleSourcesChange} onSavePreset={(platforms, communities) => { const name = window.prompt('Name this comparison preset'); if (name?.trim()) createPreset.mutate({ data: { name: name.trim(), platforms, communities } }); }} onRenamePreset={(preset) => { const name = window.prompt('Rename comparison preset', preset.name); if (name?.trim()) renamePreset.mutate({ id: preset.id, data: { name: name.trim() } }); }} onDeletePreset={(preset) => { if (window.confirm(`Remove preset “${preset.name}”?`)) deletePreset.mutate({ id: preset.id }); }} />)}
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
                {searchResult?.grounded_run && (
                  <GroundedRunDesk
                    run={searchResult.grounded_run}
                    onAttest={(decision, data) => attestContext.mutate({ id: searchResult.grounded_run.id, data })}
                    isAttesting={attestContext.isPending}
                  />
                )}
                {selectedConcept && (
                  <DevelopmentStudio
                    conceptId={selectedConcept.id}
                    sourceIds={visibleSourceIds}
                    audience={searchAudience}
                    useCase={searchUseCase}
                    onPlanChange={handleDevelopmentPlanChange}
                  />
                )}
                 <BriefPanel brief={brief} concept={selectedConcept} onDecide={(decision) => brief && decideBrief.mutate({ id: brief.id, data: { decision } })} isDeciding={decideBrief.isPending} evidenceSufficient={evidenceSufficient} />
                  <ScriptWorkspacePanel script={script} releaseKit={script?.release_kit ?? null} audioClip={script?.audio_clip ?? null} canCreate={brief?.status === 'approved'} isCreating={createScript.isPending} isDeciding={decideScript.isPending} isCreatingReleaseKit={createReleaseKit.isPending} isDecidingAudio={decideAudio.isPending} isGeneratingAudio={generateAudio.isPending} onCreate={() => brief && createScript.mutate({ id: brief.id })} onCreateReleaseKit={() => script && createReleaseKit.mutate({ id: script.id })} onDecide={(decision) => script && decideScript.mutate({ id: script.id, data: { decision } })} onAudioDecision={(decision) => script && decideAudio.mutate({ id: script.id, data: { decision } })} onGenerateAudio={() => script && generateAudio.mutate({ id: script.id })} />
                 <DecisionHistoryPanel entries={room?.decision_history ?? []} />
                <div className="podcast-panel p-5" data-testid="panel-next-action">
                  <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#b34b36]" strokeWidth={1.5} /><p className="podcast-kicker">Next editorial action</p></div>
                  <p className="mt-3 text-sm leading-6 text-[#5f554e]">You are looking at <strong className="font-medium text-[#201b19]">{selectedConcept?.title || 'the shortlist'}</strong>. Synthesize the development plan first, then generate its brief only when the source trail is sufficient for a producer review.</p>
                  <Button type="button" className="mt-5 w-full bg-[#b34b36] text-[#f9f0e5] hover:bg-[#9e3e2d] disabled:opacity-40" disabled={!selectedConcept || !visibleSourceIds.length || generateBrief.isPending || !isDevValidated} onClick={generate} data-testid="button-generate-brief">
                    {generateBrief.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" strokeWidth={1.5} />}
                    {generateBrief.isPending ? 'Compiling evidence' : isDevValidated ? 'Generate source-backed brief' : 'Development plan validation required'}
                  </Button>
                  <p className="mt-3 text-center font-mono text-[9px] uppercase leading-4 tracking-[0.08em] text-[#73675f]">Dev plan → brief → script → audio approval → listen · publishing stays blocked</p>
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