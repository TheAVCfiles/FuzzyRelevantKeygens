import { useEffect, useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';
import {
  getGetPodcastLiveSnapshotQueryKey,
  useCreatePodcastDevelopment,
  useGetPodcastLiveSnapshot,
  useRecordPodcastDevelopmentValidation,
  type PodcastDevelopmentPlan,
  type PodcastFormatVariant,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';

type DevelopmentStudioProps = {
  conceptId: string;
  sourceIds: string[];
  expectedRunId?: string;
  audience: 'consumers' | 'clients' | 'users';
  useCase: 'recap' | 'development' | 'publicity' | 'audience_strategy' | 'cultural_context';
  onPlanChange: (plan: PodcastDevelopmentPlan | null) => void;
};

function readable(value: string) {
  return value.replaceAll('_', ' ');
}

function errorFields(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) return [];
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || !('missing_fields' in data)) return [];
  const fields = (data as { missing_fields?: unknown }).missing_fields;
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === 'string') : [];
}

function Methodology({ variant }: { variant: PodcastFormatVariant }) {
  return (
    <div className="mt-4 border-t border-[#4f4944] pt-4" data-testid={`methodology-${variant.id}`}>
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#c7a481]">Transparent methodology</p>
      <div className="mt-3 grid gap-2">
        {variant.methodology_factors.map((factor) => (
          <div key={factor.id} className="grid grid-cols-[94px_1fr_32px] items-center gap-2">
            <span className="truncate text-[10px] text-[#b7aaa0]">{factor.label}</span>
            <span className="h-1.5 bg-[#4f4944]">
              <span className="block h-full bg-[#d8a36c]" style={{ width: `${factor.score}%` }} />
            </span>
            <strong className="text-right font-mono text-[10px] font-medium text-[#f0e8de]">{factor.score}</strong>
            <span className="col-span-3 text-[10px] leading-4 text-[#8f837a]">
              {factor.evidence} <span className="text-[#c7a481]">Limit: {factor.uncertainty}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="border border-[#46696e] bg-[#20383c] p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#a8d0c9]">Testable hypotheses</p>
          {variant.hypotheses.map((hypothesis) => (
            <p key={hypothesis.metric} className="mt-2 text-[10px] leading-4 text-[#c5d8d5]">
              <strong className="text-[#f0e8de]">{readable(hypothesis.metric)}:</strong> {hypothesis.statement}
              <span className="mt-1 block text-[#9bc8a9]">Test: {hypothesis.validation_method}</span>
            </p>
          ))}
        </div>
        <div className="border border-[#895948] bg-[#482e29] p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#e4a38d]">Tradeoff & risks</p>
          <p className="mt-2 text-[10px] leading-4 text-[#f0d0c4]">{variant.tradeoff}</p>
          {variant.risks.map((risk) => <p key={risk} className="mt-1 text-[10px] leading-4 text-[#dcb8ac]">/ {risk}</p>)}
        </div>
      </div>
    </div>
  );
}

function DevelopmentStudio({
  conceptId,
  sourceIds,
  expectedRunId,
  audience,
  useCase,
  onPlanChange,
}: DevelopmentStudioProps) {
  const snapshotQuery = useGetPodcastLiveSnapshot({
    query: {
      queryKey: getGetPodcastLiveSnapshotQueryKey(),
      staleTime: 15_000,
      refetchOnMount: true,
    },
  });
  const createDevelopment = useCreatePodcastDevelopment();
  const validateDevelopment = useRecordPodcastDevelopmentValidation();
  const [plan, setPlan] = useState<PodcastDevelopmentPlan | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string | null>(null);
  const [expandedFormatId, setExpandedFormatId] = useState<string | null>(null);

  useEffect(() => {
    setPlan(null);
    setSelectedFormatId(null);
    setSelectedArchetypeId(null);
    setExpandedFormatId(null);
    onPlanChange(null);
  }, [conceptId, sourceIds.join(','), audience, useCase, onPlanChange]);

  useEffect(() => {
    if (expectedRunId && snapshotQuery.data?.source_id !== expectedRunId) {
      void snapshotQuery.refetch();
    }
  }, [expectedRunId, snapshotQuery.data?.source_id]);

  const createPlan = () => {
    createDevelopment.mutate(
      { data: { concept_id: conceptId, source_ids: sourceIds, audience, use_case: useCase } },
      {
        onSuccess: (nextPlan) => {
          setPlan(nextPlan);
          setExpandedFormatId(nextPlan.format_variants[0]?.id ?? null);
          onPlanChange(nextPlan);
        },
      },
    );
  };

  const decide = (decision: 'validate' | 'reject') => {
    if (!plan || !selectedArchetypeId || !selectedFormatId) return;
    validateDevelopment.mutate(
      {
        id: plan.id,
        data: {
          decision,
          archetype_id: selectedArchetypeId,
          format_id: selectedFormatId,
        },
      },
      {
        onSuccess: (nextPlan) => {
          setPlan(nextPlan);
          onPlanChange(nextPlan);
        },
      },
    );
  };

  const resetSelections = () => {
    setSelectedFormatId(null);
    setSelectedArchetypeId(null);
    setExpandedFormatId(plan?.format_variants[0]?.id ?? null);
    validateDevelopment.reset();
  };
  const retryCurrentRun = () => {
    setPlan(null);
    setSelectedFormatId(null);
    setSelectedArchetypeId(null);
    setExpandedFormatId(null);
    createDevelopment.reset();
    validateDevelopment.reset();
    onPlanChange(null);
    void snapshotQuery.refetch();
  };
  const refreshedSnapshot = expectedRunId && snapshotQuery.data?.source_id !== expectedRunId
    ? undefined
    : snapshotQuery.data;
  const snapshot = plan?.source_snapshot ?? refreshedSnapshot;
  const validationMissingFields = [
    ...(!snapshot ? [expectedRunId ? `current compatible signal snapshot for run ${expectedRunId}` : 'current compatible signal snapshot'] : []),
    ...(!sourceIds.length ? ['selected source IDs'] : []),
    ...(plan?.status === 'draft' && !selectedFormatId ? ['selected episode format'] : []),
    ...(plan?.status === 'draft' && !selectedArchetypeId ? ['selected fictional editorial lens'] : []),
    ...errorFields(createDevelopment.error),
    ...errorFields(validateDevelopment.error),
  ];
  const uniqueMissingFields = [...new Set(validationMissingFields)];
  const error = snapshotQuery.error
    ? 'The bounded signal snapshot could not be refreshed.'
    : createDevelopment.error
      ? 'Development options could not be created. The source selection is unchanged.'
      : validateDevelopment.error
        ? 'The episode angle selection could not be recorded.'
        : '';

  return (
    <section className="podcast-panel-dark overflow-hidden" data-testid="panel-development-studio">
      <div className="border-b border-[#4f4944] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-[#d8a36c]" strokeWidth={1.5} />
          <p className="podcast-kicker !text-[#d8a36c]">Hit development studio / gate 00</p>
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl text-[#f0e8de]">Build the episode hypothesis.</h2>
            <p className="mt-2 text-xs leading-5 text-[#b7aaa0]">
              Choose a fictional editorial lens and episode format for the live search before Gemini writes the conversation.
            </p>
          </div>
          {plan && (
            <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${plan.status === 'validated' ? 'border-[#87a895] text-[#9bc8a9]' : plan.status === 'rejected' ? 'border-[#c27a68] text-[#e39a86]' : 'border-[#d8a36c] text-[#d8a36c]'}`} data-testid="status-development">
              {plan.status}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="border border-[#4f4944] bg-[#221f1d] p-4" data-testid="panel-live-snapshot">
          <div className="flex items-center justify-between gap-3 border-b border-[#4f4944] pb-3">
            <div className="flex items-center gap-2">
              <Activity className={`h-3.5 w-3.5 ${snapshot?.source_mode === 'approved_live' ? 'text-[#9bc8a9]' : 'text-[#d8a36c]'}`} />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#c7a481]">Signal snapshot</span>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => snapshotQuery.refetch()} disabled={snapshotQuery.isFetching} className="h-7 px-2 text-[#b7aaa0] hover:bg-[#393431] hover:text-[#f0e8de]" data-testid="button-refresh-live-snapshot">
              <RefreshCw className={`mr-1.5 h-3 w-3 ${snapshotQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          {snapshotQuery.isLoading ? (
            <p className="mt-4 flex items-center gap-2 text-xs text-[#b7aaa0]"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Refreshing approved source boundary…</p>
          ) : snapshot ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div><p className="font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]">Source mode</p><p className="mt-1 text-[#f0e8de]" data-testid="text-snapshot-mode">{readable(snapshot.source_mode)}</p></div>
                <div><p className="font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]">Freshness</p><p className="mt-1 text-[#f0e8de]">{snapshot.freshness}</p></div>
                <div><p className="font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]">Window</p><p className="mt-1 text-[#f0e8de]">{new Date(snapshot.observation_window.start).toLocaleDateString()}–{new Date(snapshot.observation_window.end).toLocaleDateString()}</p></div>
                <div><p className="font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]">Aggregate only</p><p className="mt-1 text-[#f0e8de]">{snapshot.aggregate_observations.toLocaleString()} observations</p></div>
              </div>
              <div className="mt-3 border-t border-[#4f4944] pt-3 font-mono text-[9px] uppercase leading-4 tracking-[.08em] text-[#80756c]">
                <span className={snapshot.source_mode === 'approved_live' ? 'text-[#9bc8a9]' : 'text-[#d8a36c]'}>{snapshot.signal_label}</span>
                <span className="block">consent: {snapshot.consent_reference ?? 'not applicable to fixture'} · policy: {snapshot.policy_review_reference ?? 'fixture boundary'}</span>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[#b7aaa0]">{snapshot.data_notice}</p>
            </>
          ) : null}
        </div>

        {!plan ? (
          <Button type="button" className="mt-4 w-full bg-[#d8a36c] text-[#2c2927] hover:bg-[#e5b77e]" disabled={!sourceIds.length || createDevelopment.isPending || snapshotQuery.isLoading} onClick={createPlan} data-testid="button-create-development-plan">
            {createDevelopment.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
            {createDevelopment.isPending ? 'Building cited variants' : 'Develop five episode formats'}
          </Button>
        ) : (
          <div className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-[10px] leading-4 text-[#b7aaa0]">{plan.methodology_note}</p>
            <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#c7a481]">01 / compare cited formats</p>
            <div className="mt-3 space-y-2">
              {plan.format_variants.map((variant) => {
                const selected = selectedFormatId === variant.id;
                const expanded = expandedFormatId === variant.id;
                return (
                  <div key={variant.id} className={`border ${selected ? 'border-[#d8a36c]' : 'border-[#4f4944]'}`} data-testid={`development-format-${variant.id}`}>
                    <button type="button" disabled={plan.status !== 'draft'} onClick={() => { setSelectedFormatId(variant.id); setExpandedFormatId(variant.id); }} className="w-full bg-[#221f1d] p-3 text-left disabled:cursor-default">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-serif text-lg text-[#f0e8de]">{variant.title}</p><p className="mt-1 text-[10px] leading-4 text-[#b7aaa0]">{variant.premise}</p></div>
                        <span className="shrink-0 border border-[#4f4944] px-1.5 py-1 font-mono text-[8px] uppercase text-[#c7a481]">{readable(variant.format)}</span>
                      </div>
                      <p className="mt-2 font-mono text-[9px] uppercase leading-4 tracking-[.06em] text-[#9bc8a9]">{variant.citation_ids.length} citations · {variant.forecast_label}</p>
                    </button>
                    <button type="button" className="flex w-full items-center justify-between border-t border-[#4f4944] px-3 py-2 font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]" onClick={() => setExpandedFormatId(expanded ? null : variant.id)}>
                      {expanded ? 'Hide evidence model' : 'Inspect evidence model'}<ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && <div className="bg-[#2c2927] p-3"><Methodology variant={variant} /></div>}
                  </div>
                );
              })}
            </div>

            <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.12em] text-[#c7a481]">02 / choose a fictional editorial lens</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {plan.archetypes.map((archetype) => (
                <button key={archetype.id} type="button" disabled={plan.status !== 'draft'} onClick={() => setSelectedArchetypeId(archetype.id)} className={`border p-3 text-left disabled:cursor-default ${selectedArchetypeId === archetype.id ? 'border-[#d8a36c] bg-[#39312a]' : 'border-[#4f4944] bg-[#221f1d]'}`} data-testid={`development-archetype-${archetype.id}`}>
                  <p className="font-serif text-base text-[#f0e8de]">{archetype.label}</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#b7aaa0]">{archetype.point_of_view}</p>
                  <p className="mt-2 border-t border-[#4f4944] pt-2 text-[9px] leading-4 text-[#d8a36c]">{archetype.non_impersonation_disclosure}</p>
                </button>
              ))}
            </div>

            {plan.status === 'draft' && (
              <div className="mt-5 border-t border-[#4f4944] pt-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" disabled={!selectedFormatId || !selectedArchetypeId || validateDevelopment.isPending} onClick={() => decide('validate')} className="bg-[#d8a36c] text-[#2c2927] disabled:opacity-40" data-testid="button-validate-development">
                    <ShieldCheck className="mr-2 h-3.5 w-3.5" />Use this episode angle
                  </Button>
                  <Button type="button" variant="outline" disabled={!selectedFormatId || !selectedArchetypeId || validateDevelopment.isPending} onClick={() => decide('reject')} className="border-[#806057] text-[#e4a38d] disabled:opacity-40" data-testid="button-reject-development">
                    <X className="mr-2 h-3.5 w-3.5" />Clear angle
                  </Button>
                </div>
                {uniqueMissingFields.length > 0 && (
                  <div className="mt-3 border border-[#895948] bg-[#482e29] p-3 text-[#f0d0c4]" data-testid="notice-development-missing-fields">
                    <p className="font-mono text-[9px] uppercase tracking-[.1em] text-[#e4a38d]">Episode setup needs these fields</p>
                    <ul className="mt-2 space-y-1 text-[10px] leading-4">
                      {uniqueMissingFields.map((field) => <li key={field}>/ {readable(field)}</li>)}
                    </ul>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={retryCurrentRun} className="border-[#a8d0c9] text-[#a8d0c9]" data-testid="button-retry-development-run">
                        <RefreshCw className="mr-1.5 h-3 w-3" />Retry current run
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={resetSelections} className="border-[#d8a36c] text-[#d8a36c]" data-testid="button-reset-development-selections">
                        Reset selections
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {plan.status === 'validated' && (
              <div className="mt-5 border border-[#577964] bg-[#294338] p-3 text-xs leading-5 text-[#d4e7d8]" data-testid="notice-development-validated">
                <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.1em] text-[#9bc8a9]"><Check className="h-3.5 w-3.5" />Episode angle selected</p>
                <p className="mt-2">{plan.decision_note}</p>
                <p className="mt-2 text-[10px] text-[#9bc8a9]">Measurement record {plan.measurement_record.id} · aggregate validation only</p>
              </div>
            )}
            {plan.status === 'rejected' && <p className="mt-5 border border-[#895948] bg-[#482e29] p-3 text-xs text-[#e4a38d]">{plan.decision_note}</p>}
          </div>
        )}
        {error && (
          <div className="mt-3 border border-[#895948] bg-[#482e29] p-3 text-xs text-[#e4a38d]" role="alert">
            <p>{error}</p>
            {uniqueMissingFields.length > 0 && <p className="mt-2 font-mono text-[9px] uppercase tracking-[.08em]">Missing: {uniqueMissingFields.map(readable).join(', ')}</p>}
            <Button type="button" size="sm" variant="outline" onClick={retryCurrentRun} className="mt-3 border-[#a8d0c9] text-[#a8d0c9]" data-testid="button-retry-development-error">
              <RefreshCw className="mr-1.5 h-3 w-3" />Retry current run
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export { DevelopmentStudio };

if (false) {
(() => {

function readable(value: string) {
  return value.replaceAll('_', ' ');
}

function errorFields(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) return [];
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || !('missing_fields' in data)) return [];
  const fields = (data as { missing_fields?: unknown }).missing_fields;
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === 'string') : [];
}

function Methodology({ variant }: { variant: PodcastFormatVariant }) {
  return (
    <div className="mt-4 border-t border-[#4f4944] pt-4" data-testid={`methodology-${variant.id}`}>
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#c7a481]">Transparent methodology</p>
      <div className="mt-3 grid gap-2">
        {variant.methodology_factors.map((factor) => (
          <div key={factor.id} className="grid grid-cols-[94px_1fr_32px] items-center gap-2">
            <span className="truncate text-[10px] text-[#b7aaa0]">{factor.label}</span>
            <span className="h-1.5 bg-[#4f4944]">
              <span className="block h-full bg-[#d8a36c]" style={{ width: `${factor.score}%` }} />
            </span>
            <strong className="text-right font-mono text-[10px] font-medium text-[#f0e8de]">{factor.score}</strong>
            <span className="col-span-3 text-[10px] leading-4 text-[#8f837a]">
              {factor.evidence} <span className="text-[#c7a481]">Limit: {factor.uncertainty}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="border border-[#46696e] bg-[#20383c] p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#a8d0c9]">Testable hypotheses</p>
          {variant.hypotheses.map((hypothesis) => (
            <p key={hypothesis.metric} className="mt-2 text-[10px] leading-4 text-[#c5d8d5]">
              <strong className="text-[#f0e8de]">{readable(hypothesis.metric)}:</strong> {hypothesis.statement}
              <span className="mt-1 block text-[#9bc8a9]">Test: {hypothesis.validation_method}</span>
            </p>
          ))}
        </div>
        <div className="border border-[#895948] bg-[#482e29] p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#e4a38d]">Tradeoff & risks</p>
          <p className="mt-2 text-[10px] leading-4 text-[#f0d0c4]">{variant.tradeoff}</p>
          {variant.risks.map((risk) => <p key={risk} className="mt-1 text-[10px] leading-4 text-[#dcb8ac]">/ {risk}</p>)}
        </div>
      </div>
    </div>
  );
}

function DevelopmentStudioDuplicate({
  conceptId,
  sourceIds,
  expectedRunId,
  audience,
  useCase,
  onPlanChange,
}: DevelopmentStudioProps) {
  const snapshotQuery = useGetPodcastLiveSnapshot({
    query: {
      queryKey: getGetPodcastLiveSnapshotQueryKey(),
      staleTime: 15_000,
      refetchOnMount: true,
    },
  });
  const createDevelopment = useCreatePodcastDevelopment();
  const validateDevelopment = useRecordPodcastDevelopmentValidation();
  const [plan, setPlan] = useState<PodcastDevelopmentPlan | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string | null>(null);
  const [expandedFormatId, setExpandedFormatId] = useState<string | null>(null);

  useEffect(() => {
    setPlan(null);
    setSelectedFormatId(null);
    setSelectedArchetypeId(null);
    setExpandedFormatId(null);
    onPlanChange(null);
  }, [conceptId, sourceIds.join(','), audience, useCase, onPlanChange]);

  useEffect(() => {
    if (expectedRunId && snapshotQuery.data?.source_id !== expectedRunId) {
      void snapshotQuery.refetch();
    }
  }, [expectedRunId, snapshotQuery.data?.source_id]);

  const createPlan = () => {
    createDevelopment.mutate(
      { data: { concept_id: conceptId, source_ids: sourceIds, audience, use_case: useCase } },
      {
        onSuccess: (nextPlan) => {
          setPlan(nextPlan);
          setExpandedFormatId(nextPlan.format_variants[0]?.id ?? null);
          onPlanChange(nextPlan);
        },
      },
    );
  };

  const decide = (decision: 'validate' | 'reject') => {
    if (!plan || !selectedArchetypeId || !selectedFormatId) return;
    validateDevelopment.mutate(
      {
        id: plan.id,
        data: {
          decision,
          archetype_id: selectedArchetypeId,
          format_id: selectedFormatId,
        },
      },
      {
        onSuccess: (nextPlan) => {
          setPlan(nextPlan);
          onPlanChange(nextPlan);
        },
      },
    );
  };

  const resetSelections = () => {
    setSelectedFormatId(null);
    setSelectedArchetypeId(null);
    setExpandedFormatId(plan?.format_variants[0]?.id ?? null);
    validateDevelopment.reset();
  };
  const retryCurrentRun = () => {
    setPlan(null);
    setSelectedFormatId(null);
    setSelectedArchetypeId(null);
    setExpandedFormatId(null);
    createDevelopment.reset();
    validateDevelopment.reset();
    onPlanChange(null);
    void snapshotQuery.refetch();
  };
  const refreshedSnapshot = expectedRunId && snapshotQuery.data?.source_id !== expectedRunId
    ? undefined
    : snapshotQuery.data;
  const snapshot = plan?.source_snapshot ?? refreshedSnapshot;
  const validationMissingFields = [
    ...(!snapshot ? [expectedRunId ? `current compatible signal snapshot for run ${expectedRunId}` : 'current compatible signal snapshot'] : []),
    ...(!sourceIds.length ? ['selected source IDs'] : []),
    ...(plan?.status === 'draft' && !selectedFormatId ? ['selected episode format'] : []),
    ...(plan?.status === 'draft' && !selectedArchetypeId ? ['selected fictional editorial lens'] : []),
    ...errorFields(createDevelopment.error),
    ...errorFields(validateDevelopment.error),
  ];
  const uniqueMissingFields = [...new Set(validationMissingFields)];
  const error = snapshotQuery.error
    ? 'The bounded signal snapshot could not be refreshed.'
    : createDevelopment.error
      ? 'Development options could not be created. The source selection is unchanged.'
      : validateDevelopment.error
        ? 'The episode angle selection could not be recorded.'
        : '';

  return (
    <section className="podcast-panel-dark overflow-hidden" data-testid="panel-development-studio">
      <div className="border-b border-[#4f4944] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-[#d8a36c]" strokeWidth={1.5} />
          <p className="podcast-kicker !text-[#d8a36c]">Hit development studio / gate 00</p>
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl text-[#f0e8de]">Build the episode hypothesis.</h2>
            <p className="mt-2 text-xs leading-5 text-[#b7aaa0]">
              Choose a fictional editorial lens and episode format for the live search before Gemini writes the conversation.
            </p>
          </div>
          {plan && (
            <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${plan.status === 'validated' ? 'border-[#87a895] text-[#9bc8a9]' : plan.status === 'rejected' ? 'border-[#c27a68] text-[#e39a86]' : 'border-[#d8a36c] text-[#d8a36c]'}`} data-testid="status-development">
              {plan.status}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="border border-[#4f4944] bg-[#221f1d] p-4" data-testid="panel-live-snapshot">
          <div className="flex items-center justify-between gap-3 border-b border-[#4f4944] pb-3">
            <div className="flex items-center gap-2">
              <Activity className={`h-3.5 w-3.5 ${snapshot?.source_mode === 'approved_live' ? 'text-[#9bc8a9]' : 'text-[#d8a36c]'}`} />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#c7a481]">Signal snapshot</span>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => snapshotQuery.refetch()} disabled={snapshotQuery.isFetching} className="h-7 px-2 text-[#b7aaa0] hover:bg-[#393431] hover:text-[#f0e8de]" data-testid="button-refresh-live-snapshot">
              <RefreshCw className={`mr-1.5 h-3 w-3 ${snapshotQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          {snapshotQuery.isLoading ? (
            <p className="mt-4 flex items-center gap-2 text-xs text-[#b7aaa0]"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Refreshing approved source boundary…</p>
          ) : snapshot ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div><p className="font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]">Source mode</p><p className="mt-1 text-[#f0e8de]" data-testid="text-snapshot-mode">{readable(snapshot.source_mode)}</p></div>
                <div><p className="font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]">Freshness</p><p className="mt-1 text-[#f0e8de]">{snapshot.freshness}</p></div>
                <div><p className="font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]">Window</p><p className="mt-1 text-[#f0e8de]">{new Date(snapshot.observation_window.start).toLocaleDateString()}–{new Date(snapshot.observation_window.end).toLocaleDateString()}</p></div>
                <div><p className="font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]">Aggregate only</p><p className="mt-1 text-[#f0e8de]">{snapshot.aggregate_observations.toLocaleString()} observations</p></div>
              </div>
              <div className="mt-3 border-t border-[#4f4944] pt-3 font-mono text-[9px] uppercase leading-4 tracking-[.08em] text-[#80756c]">
                <span className={snapshot.source_mode === 'approved_live' ? 'text-[#9bc8a9]' : 'text-[#d8a36c]'}>{snapshot.signal_label}</span>
                <span className="block">consent: {snapshot.consent_reference ?? 'not applicable to fixture'} · policy: {snapshot.policy_review_reference ?? 'fixture boundary'}</span>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[#b7aaa0]">{snapshot.data_notice}</p>
            </>
          ) : null}
        </div>

        {!plan ? (
          <Button type="button" className="mt-4 w-full bg-[#d8a36c] text-[#2c2927] hover:bg-[#e5b77e]" disabled={!sourceIds.length || createDevelopment.isPending || snapshotQuery.isLoading} onClick={createPlan} data-testid="button-create-development-plan">
            {createDevelopment.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
            {createDevelopment.isPending ? 'Building cited variants' : 'Develop five episode formats'}
          </Button>
        ) : (
          <div className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-[10px] leading-4 text-[#b7aaa0]">{plan.methodology_note}</p>
            <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#c7a481]">01 / compare cited formats</p>
            <div className="mt-3 space-y-2">
              {plan.format_variants.map((variant) => {
                const selected = selectedFormatId === variant.id;
                const expanded = expandedFormatId === variant.id;
                return (
                  <div key={variant.id} className={`border ${selected ? 'border-[#d8a36c]' : 'border-[#4f4944]'}`} data-testid={`development-format-${variant.id}`}>
                    <button type="button" disabled={plan.status !== 'draft'} onClick={() => { setSelectedFormatId(variant.id); setExpandedFormatId(variant.id); }} className="w-full bg-[#221f1d] p-3 text-left disabled:cursor-default">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-serif text-lg text-[#f0e8de]">{variant.title}</p><p className="mt-1 text-[10px] leading-4 text-[#b7aaa0]">{variant.premise}</p></div>
                        <span className="shrink-0 border border-[#4f4944] px-1.5 py-1 font-mono text-[8px] uppercase text-[#c7a481]">{readable(variant.format)}</span>
                      </div>
                      <p className="mt-2 font-mono text-[9px] uppercase leading-4 tracking-[.06em] text-[#9bc8a9]">{variant.citation_ids.length} citations · {variant.forecast_label}</p>
                    </button>
                    <button type="button" className="flex w-full items-center justify-between border-t border-[#4f4944] px-3 py-2 font-mono text-[8px] uppercase tracking-[.1em] text-[#80756c]" onClick={() => setExpandedFormatId(expanded ? null : variant.id)}>
                      {expanded ? 'Hide evidence model' : 'Inspect evidence model'}<ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && <div className="bg-[#2c2927] p-3"><Methodology variant={variant} /></div>}
                  </div>
                );
              })}
            </div>

            <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.12em] text-[#c7a481]">02 / choose a fictional editorial lens</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {plan.archetypes.map((archetype) => (
                <button key={archetype.id} type="button" disabled={plan.status !== 'draft'} onClick={() => setSelectedArchetypeId(archetype.id)} className={`border p-3 text-left disabled:cursor-default ${selectedArchetypeId === archetype.id ? 'border-[#d8a36c] bg-[#39312a]' : 'border-[#4f4944] bg-[#221f1d]'}`} data-testid={`development-archetype-${archetype.id}`}>
                  <p className="font-serif text-base text-[#f0e8de]">{archetype.label}</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#b7aaa0]">{archetype.point_of_view}</p>
                  <p className="mt-2 border-t border-[#4f4944] pt-2 text-[9px] leading-4 text-[#d8a36c]">{archetype.non_impersonation_disclosure}</p>
                </button>
              ))}
            </div>

            {plan.status === 'draft' && (
              <div className="mt-5 border-t border-[#4f4944] pt-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" disabled={!selectedFormatId || !selectedArchetypeId || validateDevelopment.isPending} onClick={() => decide('validate')} className="bg-[#d8a36c] text-[#2c2927] disabled:opacity-40" data-testid="button-validate-development">
                    <ShieldCheck className="mr-2 h-3.5 w-3.5" />Use this episode angle
                  </Button>
                  <Button type="button" variant="outline" disabled={!selectedFormatId || !selectedArchetypeId || validateDevelopment.isPending} onClick={() => decide('reject')} className="border-[#806057] text-[#e4a38d] disabled:opacity-40" data-testid="button-reject-development">
                    <X className="mr-2 h-3.5 w-3.5" />Clear angle
                  </Button>
                </div>
                {uniqueMissingFields.length > 0 && (
                  <div className="mt-3 border border-[#895948] bg-[#482e29] p-3 text-[#f0d0c4]" data-testid="notice-development-missing-fields">
                    <p className="font-mono text-[9px] uppercase tracking-[.1em] text-[#e4a38d]">Episode setup needs these fields</p>
                    <ul className="mt-2 space-y-1 text-[10px] leading-4">
                      {uniqueMissingFields.map((field) => <li key={field}>/ {readable(field)}</li>)}
                    </ul>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={retryCurrentRun} className="border-[#a8d0c9] text-[#a8d0c9]" data-testid="button-retry-development-run">
                        <RefreshCw className="mr-1.5 h-3 w-3" />Retry current run
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={resetSelections} className="border-[#d8a36c] text-[#d8a36c]" data-testid="button-reset-development-selections">
                        Reset selections
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {plan.status === 'validated' && (
              <div className="mt-5 border border-[#577964] bg-[#294338] p-3 text-xs leading-5 text-[#d4e7d8]" data-testid="notice-development-validated">
                <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.1em] text-[#9bc8a9]"><Check className="h-3.5 w-3.5" />Episode angle selected</p>
                <p className="mt-2">{plan.decision_note}</p>
                <p className="mt-2 text-[10px] text-[#9bc8a9]">Measurement record {plan.measurement_record.id} · aggregate validation only</p>
              </div>
            )}
            {plan.status === 'rejected' && <p className="mt-5 border border-[#895948] bg-[#482e29] p-3 text-xs text-[#e4a38d]">{plan.decision_note}</p>}
          </div>
        )}
        {error && (
          <div className="mt-3 border border-[#895948] bg-[#482e29] p-3 text-xs text-[#e4a38d]" role="alert">
            <p>{error}</p>
            {uniqueMissingFields.length > 0 && <p className="mt-2 font-mono text-[9px] uppercase tracking-[.08em]">Missing: {uniqueMissingFields.map(readable).join(', ')}</p>}
            <Button type="button" size="sm" variant="outline" onClick={retryCurrentRun} className="mt-3 border-[#a8d0c9] text-[#a8d0c9]" data-testid="button-retry-development-error">
              <RefreshCw className="mr-1.5 h-3 w-3" />Retry current run
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
})();
}