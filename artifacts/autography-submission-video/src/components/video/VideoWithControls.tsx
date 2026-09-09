import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { SCENE_DETAILS } from './sceneMeta';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const PROGRESS_TICK_MS = 60;

function formatPlaybackTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function announceSceneSelection(index: number, sceneKeys: string[]) {
  const key = sceneKeys[index];
  const details = SCENE_DETAILS[key];
  if (!details?.filePath) return;
  window.parent.postMessage(
    {
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: {
        sceneIndex: index,
        sceneCount: sceneKeys.length,
        sceneTitle: details.title || key,
        filePath: details.filePath,
        lineNumber: 1,
      },
    },
    '*',
  );
}

function PlaybackStatus({
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  paused,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  paused: boolean;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [tick]);

  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed(elapsedBaseRef.current + (performance.now() - start));
    }, PROGRESS_TICK_MS);
    return () => {
      window.clearInterval(id);
      elapsedBaseRef.current += performance.now() - start;
    };
  }, [tick, paused]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(
    totalDuration,
    activeStartTime + Math.min(elapsed, activeDuration),
  );

  return (
    <>
      <div className="flex-1 flex items-center gap-1.5">
        {sceneKeys.map((key, index) => {
          const isActive = index === activeIndex;
          const fill = isActive ? progress * 100 : 0;
          return (
            <button
              key={key}
              onClick={() => onJumpTo(index)}
              className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-4 hover:bg-white/25 transition-all relative min-h-[12px]"
              aria-label={`Jump to scene ${index + 1}`}
              aria-current={isActive ? 'true' : undefined}
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/90 rounded-full transition-[width] duration-100"
                style={{ width: `${fill}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="text-xl text-white/60 font-mono tabular-nums shrink-0">
        {activeIndex + 1}/{sceneKeys.length}
      </div>
      <div
        className="min-w-[11ch] text-right text-xl text-white/80 font-mono tabular-nums shrink-0"
        role="timer"
        aria-label={`Playback time ${formatPlaybackTime(totalElapsed)} of ${formatPlaybackTime(totalDuration)}`}
      >
        {formatPlaybackTime(totalElapsed)} / {formatPlaybackTime(totalDuration)}
      </div>
    </>
  );
}

function ControlBar({
  visible,
  collapsed,
  locked,
  paused,
  muted,
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  onTogglePause,
  onToggleLock,
  onToggleMuted,
  onJumpTo,
  onToggleCollapsed,
}: {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  paused: boolean;
  muted: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  onTogglePause: () => void;
  onToggleLock: () => void;
  onToggleMuted: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
}) {
  const buttonClass = 'w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0';
  return (
    <div
      className={`flex items-center gap-3 bg-black/60 backdrop-blur-sm px-5 py-4 transition-all duration-200 ease-out ${
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <button onClick={onTogglePause} className={buttonClass} title={paused ? 'Play' : 'Pause'} aria-label={paused ? 'Play' : 'Pause'}>
        {paused ? <Play className="w-8 h-8" /> : <Pause className="w-8 h-8" />}
      </button>
      <button
        onClick={onToggleLock}
        className={`${buttonClass} ${locked ? 'text-white bg-white/15' : ''}`}
        title={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-pressed={locked}
      >
        <Repeat className="w-8 h-8" />
      </button>
      <button onClick={onToggleMuted} className={buttonClass} title={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
      </button>
      <div className="w-px self-stretch bg-white/15" aria-hidden="true" />
      <PlaybackStatus
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        activeStartTime={activeStartTime}
        totalDuration={totalDuration}
        tick={tick}
        paused={paused}
        onJumpTo={onJumpTo}
      />
      <button
        onClick={onToggleCollapsed}
        className={buttonClass}
        title={collapsed ? 'Show controls' : 'Hide controls'}
        aria-label={collapsed ? 'Show controls' : 'Hide controls'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}
      </button>
    </div>
  );
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const {
    sceneKeys,
    activeIndex,
    locked,
    paused,
    mountKey,
    tick,
    durations,
    activeDuration,
    activeStartTime,
    totalDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
    togglePause,
  } = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);

  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    announceSceneSelection(index, sceneKeys);
  }, [jumpTo, sceneKeys]);

  useEffect(() => {
    if (!paused) return;
    const frozen = document
      .getAnimations()
      .filter((animation) => animation.playState === 'running');
    frozen.forEach((animation) => animation.pause());
    return () => frozen.forEach((animation) => animation.play());
  }, [paused]);

  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
  }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      if (!value) {
        setHovering(false);
        setTapPinned(false);
      }
      return !value;
    });
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      const sensor = sensorRef.current;
      if (sensor && !sensor.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
  }, [collapsed, tapPinned]);

  if (!isIframed) return <VideoTemplate />;

  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative w-full h-screen">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        paused={paused}
        muted={muted}
        onSceneChange={onSceneChange}
      />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="flex-1 w-full" aria-hidden="true" />
        <ControlBar
          visible={barVisible}
          collapsed={collapsed}
          locked={locked}
          paused={paused}
          muted={muted}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          activeStartTime={activeStartTime}
          totalDuration={totalDuration}
          tick={tick}
          onTogglePause={togglePause}
          onToggleLock={toggleLock}
          onToggleMuted={() => setMuted((value) => !value)}
          onJumpTo={handleJumpTo}
          onToggleCollapsed={handleToggleCollapsed}
        />
      </div>
    </div>
  );
}