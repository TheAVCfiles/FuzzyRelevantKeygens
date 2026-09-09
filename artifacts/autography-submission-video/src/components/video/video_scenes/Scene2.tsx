import { motion } from 'framer-motion';

export function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 bg-[var(--bg-primary)] flex items-center justify-center p-[8vw]"
      initial={{ clipPath: "circle(0% at 50% 50%)" }}
      animate={{ clipPath: "circle(150% at 50% 50%)" }}
      exit={{ opacity: 0, x: "-10vw" }}
      transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="relative z-10 w-full flex justify-between gap-[5vw]">
        <div className="w-1/2 flex flex-col justify-center">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "10vw" }}
            transition={{ delay: 1, duration: 1 }}
            className="h-[3px] bg-[var(--accent-rust)] mb-[3vw]"
          />
          
          <motion.h2
            className="text-[var(--bg-dark)] font-serif text-[4vw] leading-[1.1] mb-[2vw]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 1 }}
          >
            Orchestrated Intelligence
          </motion.h2>
          <motion.p
             className="text-[var(--text-secondary)] font-serif text-[1.6vw] leading-relaxed"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 2, duration: 1 }}
          >
            Two distinct Google capabilities maintain editorial authority while moving at the speed of open signal.
          </motion.p>
        </div>
        
        <div className="w-1/2 flex flex-col gap-[4vw] justify-center">
          <motion.div 
            className="border-l-4 border-[var(--accent-teal)] pl-[2.5vw] relative bg-white/40 p-[2vw] shadow-sm"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 3, duration: 1, type: "spring", bounce: 0.2 }}
          >
            <motion.div className="absolute left-[-0.7vw] top-[3vw] w-[1.2vw] h-[1.2vw] rounded-full bg-[var(--accent-teal)]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 3.5 }} />
            <h3 className="font-mono text-[var(--accent-teal)] text-[1.1vw] uppercase tracking-widest mb-[1vw] font-bold">@google/adk</h3>
            <p className="font-serif text-[var(--bg-dark)] text-[1.5vw] leading-snug font-medium">
              Official Agent Development Kit orchestrates the read / classify / reconcile / draft agentic analysis flow.
            </p>
          </motion.div>

          <motion.div 
            className="border-l-4 border-[var(--accent-rust)] pl-[2.5vw] relative bg-white/40 p-[2vw] shadow-sm"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 4.5, duration: 1, type: "spring", bounce: 0.2 }}
          >
            <motion.div className="absolute left-[-0.7vw] top-[3vw] w-[1.2vw] h-[1.2vw] rounded-full bg-[var(--accent-rust)]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 5 }} />
            <h3 className="font-mono text-[var(--accent-rust)] text-[1.1vw] uppercase tracking-widest mb-[1vw] font-bold">@google/genai</h3>
            <p className="font-serif text-[var(--bg-dark)] text-[1.5vw] leading-snug font-medium">
              Direct API performs Google Search grounding, structured conversational script generation, and multi-speaker TTS.
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
