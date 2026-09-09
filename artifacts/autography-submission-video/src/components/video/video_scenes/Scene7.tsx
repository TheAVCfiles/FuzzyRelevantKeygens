import { motion } from 'framer-motion';

export function Scene7() {
  return (
    <motion.div
      className="absolute inset-0 bg-[#f0e8de] flex flex-col items-center justify-center"
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: "blur(20px)" }}
      transition={{ duration: 2, ease: "easeOut" }}
    >
      <video 
        src={`${import.meta.env.BASE_URL}videos/outro_bg.mp4`}
        autoPlay 
        muted 
        loop 
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-multiply"
      />
      <motion.div
        className="w-[70vw] text-center relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 1.5 }}
      >
        <h2 className="font-serif text-[#201b19] text-[7vw] leading-none mb-[2vw]">
          Autography
        </h2>
        
        <div className="h-[2px] w-[30vw] bg-[#c7a481] mx-auto mb-[5vw]" />
        
        <div className="flex flex-col gap-[2vw]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 1 }}
            className="font-mono text-[#5f554e] text-[1.4vw] flex items-center justify-center gap-[2vw]"
          >
            <span className="uppercase tracking-[0.2em] text-[#365f67] w-[6vw] text-right">Repo</span>
            <span className="text-left w-[40vw]">github.com/TheAVCfiles/FuzzyRelevantKeygens</span>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3, duration: 1 }}
            className="font-mono text-[#5f554e] text-[1.4vw] flex items-center justify-center gap-[2vw]"
          >
            <span className="uppercase tracking-[0.2em] text-[#b34b36] w-[6vw] text-right">App</span>
            <span className="text-left w-[40vw]">fuzzy-relevant-keygens.replit.app</span>
          </motion.div>
        </div>
        
        <motion.div
          className="mt-[6vw] inline-block border border-[#201b19] px-[3vw] py-[1.5vw] bg-[#eee7dc]/90 backdrop-blur-md"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 4.5, duration: 1 }}
        >
          <p className="font-serif text-[#201b19] text-[1.8vw]">Built with @google/adk and @google/genai.</p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
