import { motion } from 'framer-motion';

export function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-dark)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <video 
        src={`${import.meta.env.BASE_URL}videos/cinematic_bg.mp4`}
        autoPlay 
        muted 
        loop 
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-panel)]/40 to-[var(--bg-dark)]/80" />
      
      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, duration: 2, ease: "easeOut" }}
      >
        <motion.h1 
          className="text-[var(--text-light)] font-serif text-[8vw] leading-none tracking-tight mb-[2vw]"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, ease: "linear" }}
        >
          Autography
        </motion.h1>
        
        <motion.div
          className="bg-[var(--accent-teal)] px-[1.5vw] py-[0.5vw] mb-[2vw]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 2.5, type: "spring", stiffness: 100, damping: 20 }}
        >
          <p className="text-[var(--bg-primary)] font-mono uppercase tracking-[0.2em] text-[1.4vw] font-bold">
            Live Signal to Spoken Story
          </p>
        </motion.div>
        
        <motion.p
          className="text-[var(--accent-gold)] font-mono uppercase tracking-[0.2em] text-[1.2vw]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.5, duration: 1.5 }}
        >
          Trend to Tape in Minutes.
        </motion.p>
      </motion.div>
      
      <motion.div
        className="absolute bottom-[8vw] max-w-[70vw] text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 5.5, duration: 1.5 }}
      >
        <p className="text-[var(--text-light)] font-serif text-[2.2vw] leading-snug drop-shadow-lg">
          Live Google Searches and trending talk become an immediate, <br/>
          <span className="text-[var(--accent-bright-gold)] italic">natural-sounding two-host podcast clip.</span>
        </p>
      </motion.div>
    </motion.div>
  );
}
