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
    expect(screen.getByTestId('audio-player')).toHaveAttribute('preload', 'metadata');
  });
});
