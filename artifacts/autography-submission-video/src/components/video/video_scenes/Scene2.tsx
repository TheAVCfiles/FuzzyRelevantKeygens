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
            className="h-[2px] bg-[var(--accent-rust)] mb-[3vw]"
          />
          
          <motion.h2
            className="text-[var(--bg-dark)] font-serif text-[3.5vw] leading-[1.1] mb-[2vw]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 1 }}
          >
            Orchestrated Intelligence
          </motion.h2>
          <motion.p
             className="text-[var(--text-secondary)] font-serif text-[1.4vw] leading-relaxed"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 2, duration: 1 }}
          >
            Autography combines two distinct Google capabilities to maintain editorial authority while moving at the speed of open signal.
          </motion.p>
        </div>
        
        <div className="w-1/2 flex flex-col gap-[3vw] justify-center">
          <motion.div 
            className="border-l-2 border-[var(--accent-teal)] pl-[2vw] relative"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 3, duration: 1 }}
          >
            <motion.div className="absolute left-[-0.6vw] top-[0.3vw] w-[1vw] h-[1vw] rounded-full bg-[var(--accent-teal)]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 3.5 }} />
            <h3 className="font-mono text-[var(--accent-teal)] text-[1vw] uppercase tracking-widest mb-[1vw]">Google Agent Development Kit</h3>
            <p className="font-serif text-[var(--bg-dark)] text-[1.6vw] leading-snug">
              Official ADK orchestrates the read / classify / reconcile / draft analysis flow.
            </p>
          </motion.div>

          <motion.div 
            className="border-l-2 border-[var(--accent-rust)] pl-[2vw] relative"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 4.5, duration: 1 }}
          >
            <motion.div className="absolute left-[-0.6vw] top-[0.3vw] w-[1vw] h-[1vw] rounded-full bg-[var(--accent-rust)]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 5 }} />
            <h3 className="font-mono text-[var(--accent-rust)] text-[1vw] uppercase tracking-widest mb-[1vw]">Direct @google/genai</h3>
            <p className="font-serif text-[var(--bg-dark)] text-[1.6vw] leading-snug">
              Remains responsible for Search-grounded podcast research, structured brief/script generation, and multi-speaker TTS.
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
