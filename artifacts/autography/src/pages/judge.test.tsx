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