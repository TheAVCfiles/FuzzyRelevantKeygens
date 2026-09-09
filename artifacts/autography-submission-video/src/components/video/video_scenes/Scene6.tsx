import { motion } from 'framer-motion';

export function Scene6() {
  return (
    <motion.div
      className="absolute inset-0 bg-[#201b19] flex items-center p-[8vw]"
      initial={{ y: "100%" }}
      animate={{ y: "0%" }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-screen blur-sm" 
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/verify.jpg)` }} 
      />
      <div className="absolute inset-0 border-[1vw] border-[#482e29] pointer-events-none z-0" />
      
      <div className="relative z-10 w-full flex items-center justify-between gap-[5vw]">
        <div className="w-5/12">
          <motion.h2
            className="font-serif text-[#f0e8de] text-[4vw] leading-[1.1] mb-[2vw]"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 1 }}
          >
            The Cut Key
          </motion.h2>
          
          <motion.p
            className="font-mono text-[#d8a36c] text-[1.2vw] uppercase tracking-widest mb-[3vw]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            Public Integrity Manifest
          </motion.p>
          
          <motion.p
            className="font-serif text-[#b7aaa0] text-[1.6vw] leading-snug"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
          >
            A signed-out manifest exposing privacy-safe lineage, exact citations, human approvals, and cryptographic hashes. ADK handles analysis, but publishing requires human deterministic approval.
          </motion.p>
        </div>
        
        <div className="w-1/2 relative">
          <motion.div
            className="w-full bg-[#151210]/90 backdrop-blur-md border border-[#365f67] p-[3vw] shadow-2xl"
            initial={{ opacity: 0, rotate: 2, y: 50 }}
            animate={{ opacity: 1, rotate: 0, y: 0 }}
            transition={{ delay: 3, type: "spring", stiffness: 100, damping: 20 }}
          >
            <div className="flex justify-between items-center border-b border-[#365f67]/30 pb-[1.5vw] mb-[1.5vw]">
              <span className="font-mono text-[1vw] text-[#f0e8de] uppercase tracking-widest">Hash Verification</span>
              <span className="font-mono text-[0.8vw] text-[#9bc8a9] border border-[#577964] bg-[#577964]/20 px-[1vw] py-[0.5vw] uppercase">Valid</span>
            </div>
            
            <div className="font-mono text-[1.2vw] text-[#d8a36c] leading-loose">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 4, duration: 0.5 }}
              >
                <span className="text-[#80756c]">artifact_id:</span> drop_8f9a2b1
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 4.5, duration: 0.5 }}
              >
                <span className="text-[#80756c]">evidence:</span> retrieved_live
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 5, duration: 0.5 }}
              >
                <span className="text-[#80756c]">approvals:</span> 3/3_human_gate
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 5.5, duration: 0.5 }}
              >
                <span className="text-[#80756c]">policy_engine:</span> velvet_rope_passed
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 6, duration: 0.5 }}
                className="mt-[1vw] break-all"
              >
                <span className="text-[#80756c]">sha256:</span> a94a8fe5ccb19ba61c4c0873d391e987982fbbd3
              </motion.div>
            </div>
            
            <motion.div
              className="mt-[2.5vw] border-t border-[#365f67]/30 pt-[1.5vw]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 7 }}
            >
              <span className="font-serif italic text-[#b7aaa0] text-[1.4vw]">Is this real? Public registry lookup confirms origin.</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
