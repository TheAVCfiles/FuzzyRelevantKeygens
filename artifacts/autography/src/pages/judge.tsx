import {
  getGetPodcastJudgeManifestQueryKey,
  useGetPodcastJudgeManifest,
} from '@workspace/api-client-react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  FileText,
  Fingerprint,
  LoaderCircle,
  Mic2,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Workflow,
  Lock,
  GitBranch,
  Video,
  ExternalLink
} from 'lucide-react';
import { Link } from 'wouter';

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
    second: '2-digit',
    timeZoneName: 'short'
  }).format(date);
}

export function JudgeView() {
  const { data: manifest, isLoading, error } = useGetPodcastJudgeManifest({
    query: {
      queryKey: getGetPodcastJudgeManifestQueryKey(),
      retry: false,
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-house text-oyster">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-velvet border-t-tally" />
          <LoaderCircle className="h-8 w-8 animate-pulse text-brass" strokeWidth={1} />
        </div>
        <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-sepia animate-pulse">
          Establishing secure downlink...
        </div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-house p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-tally mb-6" strokeWidth={1} />
        <h1 className="font-serif text-3xl text-oyster">Telemetry Offline</h1>
        <p className="mt-4 max-w-md text-sm text-sepia">
          No active, valid, non-synthetic approved Cut Key is available. AUTOGRAPHY refuses to fabricate judge evidence.
        </p>
        <Link href="/" className="mt-8 font-mono text-xs uppercase tracking-[0.16em] text-brass hover:text-oyster transition-colors">
          Return to Deck
        </Link>
      </div>
    );
  }

  const sourceMetadata = manifest.source_metadata ?? [];
  const claimSupport = manifest.claim_support ?? [];
  const approvalRecords = manifest.approval_records ?? [];
  const executionEnvelope = manifest.execution_envelope ?? [];
  const transportLabels = [...new Set(
    executionEnvelope
      .map((execution) => execution.transport
        ? `${execution.transport.api.replaceAll('_', ' ')} / ${execution.transport.auth.replaceAll('_', ' ')}`
        : null)
      .filter((value): value is string => Boolean(value)),
  )];

  return (
    <div className="min-h-[100dvh] bg-house text-oyster overflow-x-hidden selection:bg-velvet selection:text-oyster relative">
      <div className="fixed inset-0 pointer-events-none opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMTIwZTBmIj48L3JlY3Q+CjxwYXRoIGQ9Ik0wIDBMNCA0Wk00IDBMMCA0WiIgc3Ryb2tlPSIjM2ExZjJiIiBzdHJva2Utd2lkdGg9IjEiPjwvcGF0aD4KPC9zdmc+')] z-0 mix-blend-screen" />
      
      {/* Top Header / Diagnostic Bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-sepia/30 bg-house/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-serif text-xl tracking-[0.1em] text-brass hover:text-oyster transition-colors relative z-10">AUTOGRAPHY</Link>
          <div className="hidden h-4 w-[1px] bg-sepia/50 sm:block" />
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-2 w-2 rounded-full tally-light animate-pulse" />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tally">System Live</span>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.15em] text-sepia relative z-10">
          <span className="hidden md:inline-block">Public Cut Key: {manifest.key.slice(0, 12)}...</span>
          <span className="flex items-center gap-2 text-oyster">
            <ShieldCheck className="h-3 w-3 text-brass" /> Manifest validated
          </span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 relative z-10">
        
        {/* Title Sequence */}
        <div className="mb-8 lg:mb-12 max-w-3xl opacity-0" style={{ animation: 'fadeInUp 0.8s ease-out forwards' }}>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-tally mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Production Control Room
          </h2>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-oyster leading-tight tracking-tight">
            Cryptographic proof of a human decision.
          </h1>
          <p className="mt-6 text-sm leading-relaxed text-sepia font-sans max-w-2xl">
            This is the public verification surface for AUTOGRAPHY. It provides absolute visibility into the boundaries of synthetic intelligence and the enforcement of human authority in media production.
          </p>
        </div>

        <section className="mb-8 border border-brass/35 bg-[#191515] p-5 sm:p-6 lg:mb-12" data-testid="judge-zero-context-walkthrough">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-sepia/20 pb-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-tally">No account or product context required</p>
              <h2 className="mt-2 font-serif text-2xl text-oyster">Judge this build in four checks</h2>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-brass">
              Manifest v{manifest.manifest_version ?? 'legacy'} · Read-only public evidence
            </span>
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['01', 'Grounding', 'Open each public source and compare its declared support boundary and uncertainty to the transcript citation map.'],
              ['02', 'Execution', 'Confirm Google ADK performed source scouting and inspect the recorded Developer API or Vertex AI transport.'],
              ['03', 'Approval', 'Confirm SCRIPT APPROVED and AUDIO RENDER AUTHORIZED are separate hashed human records.'],
              ['04', 'Artifact', 'Play the audio, open the canonical Cut Key, and compare the transcript, audio, and manifest hashes.'],
            ].map(([step, label, detail]) => (
              <li key={step} className="border border-sepia/25 bg-house p-4">
                <span className="font-mono text-[9px] tracking-[0.15em] text-brass">{step}</span>
                <strong className="mt-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-oyster">{label}</strong>
                <p className="mt-2 text-[11px] leading-5 text-sepia">{detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8 items-start">
          
          {/* Left Column: Tech Stack & Compliance */}
          <div className="lg:col-span-4 flex flex-col gap-6 opacity-0" style={{ animation: 'fadeInUp 0.8s ease-out 0.2s forwards' }}>
            
            {/* Tech Stack */}
            <section className="border border-sepia/30 bg-[#151111] p-5 sm:p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Server className="h-24 w-24 text-brass" />
              </div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-brass mb-6 flex items-center gap-2 border-b border-sepia/20 pb-3">
                <Terminal className="h-3 w-3" /> Technological Implementation
              </h3>
              
              <ul className="space-y-5 relative z-10">
                <li className="flex gap-4">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass/10 border border-brass/20">
                    <CheckCircle2 className="h-3 w-3 text-brass" />
                  </div>
                  <div>
                    <h4 className="font-mono text-[11px] uppercase tracking-[0.1em] text-oyster">Hosted on Replit</h4>
                    <p className="mt-1 text-[11px] text-sepia leading-relaxed">Deployed and scaled instantly via Replit Deployments as the primary infrastructure partner.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass/10 border border-brass/20">
                    <CheckCircle2 className="h-3 w-3 text-brass" />
                  </div>
                  <div>
                    <h4 className="font-mono text-[11px] uppercase tracking-[0.1em] text-oyster">Gemini Transport Recorded</h4>
                    <p className="mt-1 text-[11px] text-sepia leading-relaxed">
                      {transportLabels.length ? transportLabels.join(' · ') : 'Transport was not recorded on this retained legacy manifest.'}
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass/10 border border-brass/20">
                    <CheckCircle2 className="h-3 w-3 text-brass" />
                  </div>
                  <div>
                    <h4 className="font-mono text-[11px] uppercase tracking-[0.1em] text-oyster">Replit Agent Accelerated</h4>
                    <p className="mt-1 text-[11px] text-sepia leading-relaxed">Rapid prototyping and codebase generation guided by Replit's native agentic development.</p>
                  </div>
                </li>
              </ul>
            </section>

            {/* Compliance Checklist */}
            <section className="border border-sepia/30 bg-[#191515] p-5 sm:p-6 shadow-lg">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-oyster mb-4 border-b border-sepia/20 pb-3">
                Stage One Compliance
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-house p-3 border border-sepia/20 hover:border-sepia/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <Server className="h-4 w-4 text-sepia" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-sepia">Hosted on Replit</span>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-brass bg-brass/10 px-2 py-1">Active</span>
                </div>
                <div className="flex items-center justify-between bg-house p-3 border border-sepia/20 hover:border-sepia/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-sepia" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-sepia">Gemini API Transport</span>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-brass bg-brass/10 px-2 py-1">Runtime</span>
                </div>
                <div className="flex items-center justify-between bg-house p-3 border border-sepia/20 hover:border-sepia/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <Terminal className="h-4 w-4 text-sepia" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-sepia">Built with Replit Agent</span>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-brass bg-brass/10 px-2 py-1">Used</span>
                </div>
                <div className="flex items-center justify-between bg-house p-3 border border-sepia/20 hover:border-sepia/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-4 w-4 text-sepia" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-sepia">Functioning Web App</span>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-brass bg-brass/10 px-2 py-1">Active</span>
                </div>
                <div className="flex items-center justify-between bg-house p-3 border border-sepia/20 hover:border-sepia/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-4 w-4 text-sepia" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-sepia">Req: Open-Source Repo</span>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-sepia bg-house border border-sepia/30 px-2 py-1">Required</span>
                </div>
                <div className="flex items-center justify-between bg-house p-3 border border-sepia/20 hover:border-sepia/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <Video className="h-4 w-4 text-sepia" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-sepia">Req: Demo Video</span>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-sepia bg-house border border-sepia/30 px-2 py-1">Required</span>
                </div>
              </div>
            </section>

            {executionEnvelope.length ? (
              <section className="border border-sepia/30 bg-[#151111] p-5 sm:p-6" data-testid="judge-execution-envelope">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-brass mb-4 border-b border-sepia/20 pb-3">
                  ADK Execution Envelope
                </h3>
                <p className="mb-4 text-[11px] leading-5 text-sepia">Safe evidence only. Prompts, model output, credentials, project IDs, and regions are excluded.</p>
                <div className="space-y-3">
                  {executionEnvelope.map((execution) => (
                    <article key={execution.execution_id} className="border border-sepia/25 bg-house p-3">
                      <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em]">
                        <span className="text-oyster">{execution.agent.replaceAll('_', ' ')}</span>
                        <span className="text-brass">{execution.status}</span>
                      </div>
                      <p className="mt-2 text-[10px] text-sepia">{execution.framework ?? 'Legacy runtime'} · {execution.model}</p>
                      <p className="mt-1 font-mono text-[9px] text-sepia">
                        {execution.transport ? `${execution.transport.api.replaceAll('_', ' ')} · ${execution.transport.auth.replaceAll('_', ' ')}` : 'Transport not recorded'}
                      </p>
                      <p className="mt-1 font-mono text-[9px] text-sepia">Tools · {execution.tools.length ? execution.tools.join(', ') : 'none'}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* Middle Column: The Manifest & Audio */}
          <div className="lg:col-span-5 flex flex-col gap-6 opacity-0" style={{ animation: 'fadeInUp 0.8s ease-out 0.4s forwards' }}>
            
            {/* The Cut Key Artifact */}
            <section className="border border-sepia/30 bg-[#1a1516] p-5 sm:p-6 shadow-2xl relative">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brass/0 via-brass/40 to-brass/0 opacity-50" />
              <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-brass mb-6 flex items-center gap-2 border-b border-sepia/20 pb-3">
                <Activity className="h-3 w-3" /> Quality of the Idea
              </h3>
              
              <div className="flex items-center justify-between pb-4 mb-5">
                <h4 className="font-mono text-[10px] uppercase tracking-[0.15em] text-oyster flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-sepia" /> Cryptographic Cut Key
                </h4>
                <span className="font-mono text-[9px] text-sepia tracking-[0.1em]">{formatDate(manifest.generated_at)}</span>
              </div>

              <div className="bg-[#120E0F] border border-sepia/20 p-4 mb-6 relative overflow-hidden group">
                <p className="relative font-mono text-xs sm:text-sm text-oyster break-all leading-relaxed tracking-wider selection:bg-brass selection:text-house">
                  {manifest.key}
                </p>
              </div>

              {/* Audio Player */}
              <div className="mb-6 bg-[#151111] border border-sepia/20 p-4">
                <h4 className="font-mono text-[9px] uppercase tracking-[0.15em] text-brass mb-3 flex items-center gap-2">
                  <Mic2 className="h-3 w-3" /> Approved Audio Sample
                </h4>
                <div className="bg-house border border-sepia/30 p-2 shadow-inner">
                  <audio
                    controls
                    preload="metadata"
                    src={manifest.audio_url}
                    className="w-full h-10 [&::-webkit-media-controls-panel]:bg-oyster [&::-webkit-media-controls-panel]:rounded-none"
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </div>

              {/* Disclosure & Lineage */}
              <div className="space-y-5 font-mono text-[10px] text-sepia tracking-[0.05em] leading-relaxed border-t border-sepia/20 pt-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="uppercase text-oyster tracking-[0.1em] block mb-1">Provider & Model</span>
                    <span className="text-brass bg-brass/10 px-1.5 py-0.5 rounded-sm inline-block">
                      {manifest.production.provider} / {manifest.production.model} {manifest.production.synthetic ? '(Synthetic)' : ''}
                    </span>
                  </div>
                  <div>
                    <span className="uppercase text-oyster tracking-[0.1em] block mb-1">Format Disclosure</span>
                    {manifest.format_disclosure}
                  </div>
                </div>
                
                <div>
                  <span className="uppercase text-oyster tracking-[0.1em] block mb-1">Voice Disclosure</span>
                  <div className="bg-house border border-sepia/20 p-3 text-[9px] leading-relaxed">
                    {manifest.voice_disclosure}
                  </div>
                </div>
                
                <div>
                  <span className="uppercase text-oyster tracking-[0.1em] block mb-2">Source Lineage ({manifest.source_ids.length} Signals)</span>
                  <div className="flex flex-wrap gap-2">
                    {manifest.source_ids.map((id: string) => (
                      <span key={id} className="border border-sepia/40 bg-house px-2 py-1 text-[9px] text-oyster shadow-sm">
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
                {sourceMetadata.length ? (
                  <div data-testid="judge-source-metadata">
                    <span className="uppercase text-oyster tracking-[0.1em] block mb-2">Public Source Metadata & Declared Boundaries</span>
                    <div className="space-y-3">
                      {sourceMetadata.map((source) => (
                        <article key={source.id} className="border border-sepia/25 bg-house p-3">
                          <a href={source.url} target="_blank" rel="noreferrer" className="text-oyster underline decoration-sepia underline-offset-4">{source.title}</a>
                          <p className="mt-2 text-[9px] text-brass">{source.id} · {source.classification.replaceAll('_', ' ')}</p>
                          <p className="mt-2 text-[10px] normal-case tracking-normal text-sepia">Declared support boundary: {source.what_it_supports}</p>
                          <p className="mt-2 text-[10px] normal-case tracking-normal text-[#e4a38d]">Still uncertain: {source.what_remains_uncertain}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Hashes */}
              <div className="mt-6 pt-5 border-t border-sepia/30 space-y-4">
                <div className="bg-[#120E0F] p-3 border border-sepia/10">
                  <h4 className="font-mono text-[9px] uppercase tracking-[0.15em] text-sepia">Audio SHA-256</h4>
                  <p className="font-mono text-[10px] text-brass break-all mt-1 opacity-80">{manifest.audio_sha256}</p>
                </div>
                <div className="bg-[#120E0F] p-3 border border-sepia/10">
                  <h4 className="font-mono text-[9px] uppercase tracking-[0.15em] text-sepia">Manifest SHA-256</h4>
                  <p className="font-mono text-[10px] text-brass break-all mt-1 opacity-80">{manifest.manifest_sha256}</p>
                </div>
                <Link href={`/cut/${manifest.key}`} className="flex w-full items-center justify-center gap-2 border border-brass/50 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.15em] text-brass transition-colors hover:bg-brass hover:text-house">
                  Open canonical public Cut Key <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </section>
          </div>

          {/* Right Column: Workflow, Safety & Transcript */}
          <div className="lg:col-span-3 flex flex-col gap-6 opacity-0" style={{ animation: 'fadeInUp 0.8s ease-out 0.6s forwards' }}>
            
            {/* Safety Hold */}
            <section className="border border-tally/40 bg-velvet/30 p-5 sm:p-6 shadow-[0_0_40px_rgba(255,45,31,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-tally/10 blur-3xl rounded-full" />
              <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-brass mb-6 flex items-center gap-2 border-b border-tally/20 pb-3 relative z-10">
                <Workflow className="h-3 w-3" /> Potential Impact
              </h3>
              
              <h4 className="font-mono text-[10px] uppercase tracking-[0.15em] text-tally mb-3 flex items-center gap-2 relative z-10">
                <Lock className="h-3 w-3" /> Illustrative Velvet Rope refusal
              </h4>
              <p className="text-[11px] text-oyster font-sans leading-relaxed mb-4 relative z-10">
                This example shows the deterministic policy path outside Gemini; it is not presented as a runtime receipt from this Cut Key. The rule cannot be relaxed by a model response.
              </p>
              <div className="mb-4 border-l-2 border-tally bg-[#120E0F] p-4 font-mono text-[10px] uppercase leading-6 tracking-[0.08em] text-oyster relative z-10">
                <strong className="block text-tally">Human Hold</strong>
                <span className="block text-sepia">R5 · no source document supports a claim about another person</span>
                <span className="block text-brass">Nothing was published.</span>
              </div>
              <div className="bg-[#120E0F] border border-tally/30 p-4 relative z-10">
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-tally mb-2">
                  <ShieldAlert className="h-3 w-3" /> Integrity Not Truth
                </div>
                <p className="font-mono text-[9px] text-sepia leading-relaxed">
                  {manifest.integrity_disclaimer}
                </p>
              </div>
            </section>

            {/* Workflow & House Voices */}
            <section className="border border-sepia/30 bg-[#151111] p-5 sm:p-6">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-brass mb-6 flex items-center gap-2 border-b border-sepia/20 pb-3">
                <Cpu className="h-3 w-3" /> Design
              </h3>
              
              <h4 className="font-mono text-[10px] uppercase tracking-[0.15em] text-oyster mb-2 flex items-center gap-2">
                Media Workflow
              </h4>
              <p className="text-[11px] text-sepia font-sans leading-relaxed mb-5">
                A real media production workflow with separate, attributable human decisions before every downstream artifact.
              </p>

              <ol className="mb-6 grid grid-cols-2 gap-2 font-mono text-[9px] uppercase tracking-[0.08em]">
                {[
                  ['00', 'Development'],
                  ['01', 'Brief'],
                  ['02', 'Script'],
                  ['04', 'Audio'],
                ].map(([gate, label]) => (
                  <li key={gate} className="border border-sepia/25 bg-house px-3 py-2">
                    <span className="block text-brass">Gate {gate}</span>
                    <span className="mt-1 block text-oyster">{label}</span>
                    <span className="mt-1 block text-sepia">Human approval</span>
                  </li>
                ))}
              </ol>

              {approvalRecords.length ? (
                <div className="mb-6 space-y-2" data-testid="judge-approval-records">
                  {approvalRecords.map((record) => (
                    <article key={record.record_sha256} className="border border-sepia/25 bg-house p-3 font-mono text-[9px] text-sepia">
                      <p className="text-oyster">{record.record_type.replaceAll('_', ' ')}</p>
                      <p className="mt-1">Reviewer ref · {record.reviewer_reference.slice(0, 16)}…</p>
                      <p className="mt-1 break-all">Subject · {record.subject_sha256}</p>
                      <p className="mt-1 break-all text-brass">Record · {record.record_sha256}</p>
                    </article>
                  ))}
                </div>
              ) : null}
              
              <div className="space-y-4">
                <div className="border-l-2 border-brass pl-3 bg-brass/5 py-2 pr-2">
                  <h4 className="font-mono text-[10px] uppercase tracking-[0.1em] text-brass mb-1">FRONT ROW</h4>
                  <p className="text-[10px] text-sepia leading-snug">The inquisitive, structural house voice. Pushes for clarification.</p>
                </div>
                <div className="border-l-2 border-oyster pl-3 bg-oyster/5 py-2 pr-2">
                  <h4 className="font-mono text-[10px] uppercase tracking-[0.1em] text-oyster mb-1">BACKSTAGE</h4>
                  <p className="text-[10px] text-sepia leading-snug">The analytical, contextual house voice. Delivers verified intelligence.</p>
                </div>
              </div>
            </section>

            {/* Transcript Preview */}
            <section className="border border-sepia/30 bg-[#151111] flex-1 flex flex-col overflow-hidden min-h-[300px]">
              <div className="p-4 border-b border-sepia/30 bg-house/80 flex items-center justify-between">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-sepia flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Transcript Segment
                </h3>
              </div>
              <div className="p-4 flex-1 bg-[#120e0f] overflow-y-auto max-h-[400px]">
                <pre className="font-mono text-[10px] text-oyster whitespace-pre-wrap leading-relaxed opacity-90 font-medium">
                  {manifest.transcript}
                </pre>
              </div>
              <div className="p-3 border-t border-sepia/30 bg-house/80">
                <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-sepia break-all flex flex-col gap-1">
                  <span>SHA256:</span>
                  <span className="text-brass opacity-70">{manifest.transcript_sha256}</span>
                </p>
              </div>
              {claimSupport.length ? (
                <div className="border-t border-sepia/30 bg-[#151111] p-4" data-testid="judge-claim-support">
                  <h4 className="font-mono text-[9px] uppercase tracking-[0.12em] text-brass">Transcript Citation Map · Lineage, Not Independent Fact-Check</h4>
                  <div className="mt-3 space-y-3">
                    {claimSupport.map((claim) => (
                      <article key={claim.claim_id} className="border-l border-brass/50 pl-3">
                        <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-sepia">
                          {claim.claim_id} · {claim.classification.replaceAll('_', ' ')} · {claim.source_ids.join(', ')}
                        </p>
                        <p className="mt-1 text-[10px] leading-5 text-oyster">{claim.speaker}: {claim.claim_text}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

          </div>

        </div>
      </main>
    </div>
  );
}
