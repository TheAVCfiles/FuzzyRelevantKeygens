import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CutKeyView } from './cut';

vi.mock('wouter', () => ({
  useParams: () => ({ key: 'test-key' }),
  Link: ({ children }: any) => <a>{children}</a>,
}));

vi.mock('@workspace/api-client-react', () => ({
  useGetPodcastCutKey: vi.fn(),
  getGetPodcastCutKeyQueryKey: () => ['test-key'],
}));

import { useGetPodcastCutKey } from '@workspace/api-client-react';

describe('CutKeyView', () => {
  it('renders the bounded public podcast manifest', () => {
    vi.mocked(useGetPodcastCutKey).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        key: 'test-key',
        clip_id: 'clip-1',
        audio_url: '/api/podcast/audio',
        manifest_sha256: 'sha-manifest',
        transcript: 'Exact transcript.',
        transcript_sha256: 'sha-script',
        source_ids: ['source-1'],
        manifest_version: 2,
        source_metadata: [{
          id: 'source-1',
          url: 'https://example.test/source-1',
          title: 'Public source one',
          retrieved_at: '2026-01-01T00:00:00.000Z',
          source_type: 'public_web',
          classification: 'source_backed',
          policy_reference: 'policy-v1',
          aggregate_summary: 'Aggregate summary.',
          evidence_gaps: ['Intent is unknown.'],
          what_it_supports: 'A bounded public claim.',
          what_remains_uncertain: 'Intent is unknown.',
        }],
        claim_support: [{
          claim_id: 'claim-01',
          segment: 'evidence',
          speaker: 'FRONT ROW',
          claim_text: 'Exact transcript.',
          source_ids: ['source-1'],
          classification: 'source_backed',
        }],
        approval_records: [{
          record_type: 'SCRIPT_APPROVED',
          artifact_type: 'script',
          artifact_id: 'script-1',
          reviewer_reference: 'a'.repeat(64),
          decided_at: '2026-01-01T00:00:00.000Z',
          subject_sha256: 'b'.repeat(64),
          record_sha256: 'c'.repeat(64),
        }],
        execution_envelope: [{
          agent: 'source_scout',
          provider: 'Google Gemini API',
          framework: 'Google ADK (@google/adk)',
          model: 'gemini-3.6-flash',
          execution_id: 'execution-1',
          tools: ['googleSearch'],
          latency_ms: 40,
          status: 'completed',
          activity: 'Grounded search.',
          transport: { api: 'gemini_developer_api', auth: 'api_key' },
        }],
        generated_at: '2026-01-01T00:00:00.000Z',
        production: { synthetic: true, provider: 'Google Gemini', model: 'Gemini TTS' },
        voice_disclosure: 'Synthetic house voices.',
        format_disclosure: 'Performed sample.',
        audio_sha256: 'sha-audio',
        integrity_disclaimer: 'Integrity over truth.',
      }
    } as any);

    render(<CutKeyView />);

    // Assert main elements
    expect(screen.getByText('Cut Key: test-key')).toBeInTheDocument();
    expect(screen.getByText('Exact transcript.')).toBeInTheDocument();
    expect(screen.getByText('Integrity over truth.')).toBeInTheDocument();
    expect(screen.getByText('sha-script')).toBeInTheDocument();
    expect(screen.getByText('sha-audio')).toBeInTheDocument();
    expect(screen.getByText('sha-manifest')).toBeInTheDocument();
    expect(screen.getByText('Public source one')).toBeInTheDocument();
    expect(screen.getByTestId('cut-claim-support')).toHaveTextContent('source-1');
    expect(screen.getByTestId('cut-approval-records')).toHaveTextContent('SCRIPT APPROVED');
    expect(screen.getByTestId('cut-execution-envelope')).toHaveTextContent('Google ADK');
    expect(screen.getByTestId('audio-player')).toHaveAttribute('preload', 'metadata');
  });
});
