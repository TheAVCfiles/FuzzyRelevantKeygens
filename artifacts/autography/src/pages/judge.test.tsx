import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { JudgeView } from './judge';

vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('@workspace/api-client-react', () => ({
  getGetPodcastJudgeManifestQueryKey: () => ['/podcast/judge-manifest'],
  useGetPodcastJudgeManifest: vi.fn(),
}));

import { useGetPodcastJudgeManifest } from '@workspace/api-client-react';

describe('JudgeView', () => {
  it('renders an approved public manifest as a read-only judging walkthrough', () => {
    vi.mocked(useGetPodcastJudgeManifest).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        key: 'cut-approved',
        clip_id: 'clip-approved',
        audio_url: '/api/podcast/cut-keys/cut-approved/audio',
        manifest_sha256: 'a'.repeat(64),
        transcript: 'FRONT ROW: What changed? BACKSTAGE: Here is the sourced context.',
        transcript_sha256: 'b'.repeat(64),
        source_ids: ['public-source-1', 'public-source-2'],
        manifest_version: 2,
        source_metadata: [
          {
            id: 'public-source-1',
            url: 'https://example.test/source-1',
            title: 'Approved public source 1',
            retrieved_at: '2026-09-09T00:00:00.000Z',
            source_type: 'public_web',
            classification: 'source_backed',
            policy_reference: 'podcast-current-context-policy-v1',
            aggregate_summary: 'A bounded aggregate source summary.',
            evidence_gaps: ['Intent remains unknown.'],
            what_it_supports: 'The format pattern was publicly documented.',
            what_remains_uncertain: 'The source cannot establish intent.',
          },
          {
            id: 'public-source-2',
            url: 'https://example.test/source-2',
            title: 'Approved public source 2',
            retrieved_at: '2026-09-09T00:00:00.000Z',
            source_type: 'public_web',
            classification: 'unresolved',
            policy_reference: 'podcast-current-context-policy-v1',
            aggregate_summary: 'A second bounded aggregate source summary.',
            evidence_gaps: ['Representativeness remains unknown.'],
            what_it_supports: 'A second public pattern signal.',
            what_remains_uncertain: 'The signal is not representative of all viewers.',
          },
        ],
        claim_support: [
          {
            claim_id: 'claim-01',
            segment: 'evidence',
            speaker: 'BACKSTAGE',
            claim_text: 'Here is the sourced context.',
            source_ids: ['public-source-1', 'public-source-2'],
            classification: 'source_backed',
          },
        ],
        approval_records: [
          {
            record_type: 'SCRIPT_APPROVED',
            artifact_type: 'script',
            artifact_id: 'script-approved',
            reviewer_reference: 'd'.repeat(64),
            decided_at: '2026-09-09T00:00:00.000Z',
            subject_sha256: 'e'.repeat(64),
            record_sha256: 'f'.repeat(64),
          },
          {
            record_type: 'AUDIO_RENDER_AUTHORIZED',
            artifact_type: 'audio',
            artifact_id: 'script-approved',
            reviewer_reference: '1'.repeat(64),
            decided_at: '2026-09-09T00:01:00.000Z',
            subject_sha256: '2'.repeat(64),
            record_sha256: '3'.repeat(64),
          },
        ],
        execution_envelope: [
          {
            agent: 'source_scout',
            provider: 'Google Gemini API',
            framework: 'Google ADK (@google/adk)',
            model: 'gemini-3.6-flash',
            execution_id: 'adk-judge-evidence',
            tools: ['googleSearch'],
            latency_ms: 42,
            status: 'completed',
            activity: 'Executed grounded search.',
            transport: { api: 'gemini_developer_api', auth: 'api_key' },
          },
        ],
        generated_at: '2026-09-09T00:00:00.000Z',
        production: { synthetic: false, provider: 'Google Gemini', model: 'gemini-2.5-flash-tts' },
        voice_disclosure: 'FRONT ROW: Gemini Kore; BACKSTAGE: Gemini Puck; no cloning.',
        format_disclosure: 'Approved evidence-backed performed sample.',
        audio_sha256: 'c'.repeat(64),
        integrity_disclaimer: 'This manifest proves integrity, not the truth of every source.',
      },
    } as any);

    render(<JudgeView />);

    expect(screen.getByText('Technological Implementation')).toBeInTheDocument();
    expect(screen.getByText('Potential Impact')).toBeInTheDocument();
    expect(screen.getByText('Quality of the Idea')).toBeInTheDocument();
    expect(screen.getByText('Design')).toBeInTheDocument();
    expect(screen.getByText('Human Hold')).toBeInTheDocument();
    expect(screen.getByText('Judge this build in four checks')).toBeInTheDocument();
    expect(screen.getByText(/Manifest v2 · Read-only public evidence/i)).toBeInTheDocument();
    expect(screen.getByText('Approval')).toBeInTheDocument();
    expect(screen.getByTestId('judge-execution-envelope')).toHaveTextContent('Google ADK');
    expect(screen.getAllByText(/gemini developer api/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('judge-approval-records')).toHaveTextContent('SCRIPT APPROVED');
    expect(screen.getByTestId('judge-approval-records')).toHaveTextContent('AUDIO RENDER AUTHORIZED');
    expect(screen.getByTestId('judge-source-metadata')).toHaveTextContent('Approved public source 1');
    expect(screen.getByTestId('judge-claim-support')).toHaveTextContent('public-source-1');
    expect(screen.getByText(/no source document supports a claim about another person/i)).toBeInTheDocument();
    expect(screen.getAllByText('FRONT ROW').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BACKSTAGE').length).toBeGreaterThan(0);
    expect(screen.getByText(/Google Gemini \/ gemini-2\.5-flash-tts/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open canonical public Cut Key/i })).toHaveAttribute('href', '/cut/cut-approved');
    expect(screen.getByText('Req: Open-Source Repo')).toBeInTheDocument();
    expect(screen.getByText('Req: Demo Video')).toBeInTheDocument();
    expect(document.querySelector('audio')).toHaveAttribute('preload', 'metadata');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});