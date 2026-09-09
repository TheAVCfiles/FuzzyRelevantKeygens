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
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-panel)]/40 to-transparent" />
      
      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, duration: 2, ease: "easeOut" }}
      >
        <motion.h1 
          className="text-[var(--text-light)] font-serif text-[7vw] leading-none tracking-tight mb-[1vw]"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, ease: "linear" }}
        >
          Autography
        </motion.h1>
        
        <motion.p
          className="text-[var(--accent-gold)] font-mono uppercase tracking-[0.2em] text-[1.2vw]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 1.5 }}
        >
          The signature that writes itself.
        </motion.p>
      </motion.div>
      
      <motion.div
        className="absolute bottom-[10vw] max-w-[60vw] text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 6, duration: 1.5 }}
      >
        <p className="text-[var(--text-secondary)] font-serif text-[2vw] leading-relaxed">
          A cinematic, safety-first entertainment response<br/>and podcast-development workspace.
        </p>
      </motion.div>
    </motion.div>
  );
}
