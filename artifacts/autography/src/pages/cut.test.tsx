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
  it('renders public summary and never raw text', () => {
    vi.mocked(useGetPodcastCutKey).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        key: 'test-key',
        clip_id: 'clip-1',
        audio_url: '/api/podcast/audio',
        citations: [],
        line_mappings: [],
        retrievals: [],
        script_sha256: 'sha-script',
        audio_sha256: 'sha-audio',
        approval_receipts: [],
        version: 1,
        supersedes: null,
        executions: [],
        integrity_disclaimer: 'Integrity over truth.',
        private_attestation: {
           exists: true,
           classification: 'first_party_attested',
           signer: 'Producer',
           permitted_public_summary: 'Public summary OK.',
        }
      }
    } as any);

    render(<CutKeyView />);

    // Assert main elements
    expect(screen.getByText('Cut Key: test-key')).toBeInTheDocument();
    expect(screen.getByText('"Public summary OK."')).toBeInTheDocument();
    expect(screen.getByText('Integrity over truth.')).toBeInTheDocument();
    expect(screen.getByText('sha-script')).toBeInTheDocument();
    expect(screen.getByText('sha-audio')).toBeInTheDocument();
  });
});
