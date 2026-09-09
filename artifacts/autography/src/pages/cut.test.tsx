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
        adk_execution_id: 'adk-parent-1',
        run_id: 'run-1',
        script_id: 'script-1',
        script_sha256: 'sha-script',
        source_manifest_sha256: 'sha-sources',
        execution_envelope: {
          parent_execution_id: 'adk-parent-1',
          run_id: 'run-1',
          script_id: 'script-1',
          stages: [
            { stage: 'grounded_research', agent: 'source_scout', provider: 'Google Gemini API', framework: 'Google ADK (@google/adk)', model: 'gemini-test', execution_id: 'adk-parent-1', parent_execution_id: 'adk-parent-1', tools: ['googleSearch'], status: 'completed', activity: 'Grounded research.' },
            { stage: 'editorial_synthesis', agent: 'evidence_editor', provider: 'Google Gemini', framework: 'Direct @google/genai', model: 'gemini-test', execution_id: 'editor-1', parent_execution_id: 'adk-parent-1', tools: [], status: 'completed', activity: 'Editorial synthesis.' },
            { stage: 'editorial_synthesis', agent: 'evidence_verifier', provider: 'Google Gemini', framework: 'Direct @google/genai', model: 'gemini-test', execution_id: 'verifier-1', parent_execution_id: 'adk-parent-1', tools: [], status: 'completed', activity: 'Evidence verification.' },
            { stage: 'script_generation', agent: 'script_performer', provider: 'Google Gemini', framework: 'Direct @google/genai', model: 'gemini-test', execution_id: 'script-generation-1', parent_execution_id: 'adk-parent-1', tools: [], status: 'completed', activity: 'Script generation.' },
            { stage: 'media_render', agent: 'audio_performer', provider: 'Google Gemini', framework: 'Direct @google/genai', model: 'gemini-tts-test', execution_id: 'media-1', parent_execution_id: 'adk-parent-1', tools: [], status: 'completed', activity: 'Authorized media rendering.' },
          ],
          authority_boundary: {
            type: 'human_script_approval',
            script_approved_at: '2026-01-01T00:01:00.000Z',
            media_render_authorized_at: '2026-01-01T00:01:00.000Z',
            script_sha256: 'sha-script',
            authority_records: [
              {
                receipt_id: 'authority-script-1',
                authority_record_type: 'SCRIPT_APPROVED',
                reviewer_reference: 'd'.repeat(64),
                decided_at: '2026-01-01T00:01:00.000Z',
                script_sha256: 'sha-script',
                source_run_id: 'run-1',
                policy_version: 'podcast-policy-v1',
              },
              {
                receipt_id: 'authority-audio-1',
                authority_record_type: 'AUDIO_RENDER_AUTHORIZED',
                reviewer_reference: 'd'.repeat(64),
                decided_at: '2026-01-01T00:01:00.000Z',
                script_sha256: 'sha-script',
                source_run_id: 'run-1',
                policy_version: 'podcast-policy-v1',
              },
            ],
            publication_status: 'blocked_until_final_approval',
          },
        },
        source_ids: ['source-1'],
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
    expect(screen.getAllByText('sha-script')).toHaveLength(2);
    expect(screen.getByText('sha-audio')).toBeInTheDocument();
    expect(screen.getByText('sha-manifest')).toBeInTheDocument();
    expect(screen.getByText('adk-parent-1')).toBeInTheDocument();
    expect(screen.getByText('sha-sources')).toBeInTheDocument();
    expect(screen.getByTestId('cut-execution-envelope')).toHaveTextContent('Google ADK (@google/adk)');
    expect(screen.getByTestId('cut-execution-envelope')).toHaveTextContent('gemini-tts-test');
    expect(screen.getByTestId('cut-authority-records')).toHaveTextContent('SCRIPT APPROVED');
    expect(screen.getByTestId('cut-authority-records')).toHaveTextContent('AUDIO RENDER AUTHORIZED');
    expect(screen.getByTestId('cut-execution-envelope')).toHaveTextContent('Publication blocked until final approval');
    expect(screen.getByTestId('cut-execution-envelope')).not.toHaveTextContent('private-reviewer');
    expect(screen.getByTestId('audio-player')).toHaveAttribute('preload', 'metadata');
  });
});
