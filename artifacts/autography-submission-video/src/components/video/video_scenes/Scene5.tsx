import { motion } from 'framer-motion';

export function Scene5() {
  return (
    <motion.div
      className="absolute inset-0 bg-[#eee7dc] flex items-center justify-center overflow-hidden"
      initial={{ scale: 1.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ y: "-100%" }}
      transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Audio Waveform Background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 gap-[0.5vw]">
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            className="w-[1vw] bg-[#365f67] rounded-full"
            animate={{
              height: ["2vw", `${Math.random() * 20 + 5}vw`, "2vw"]
            }}
            transition={{
              duration: Math.random() * 1.5 + 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-[75vw] text-center">
        <motion.p
          className="font-mono text-[#b34b36] text-[1vw] uppercase tracking-widest mb-[1.5vw]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          Generative Audio
        </motion.p>
        
        <motion.h2
          className="font-serif text-[#201b19] text-[3.5vw] leading-[1.1] max-w-[60vw] mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
        >
          Direct @google/genai generates fresh dialogue and renders distinct voices for the approved script.
        </motion.h2>

        <div className="flex justify-center gap-[3vw] mt-[5vw]">
          <motion.div
            className="bg-[#f0e8de] border border-[#c7b9aa] p-[3vw] w-[30vw] text-left shadow-xl"
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            transition={{ delay: 4, duration: 1.2, ease: "easeOut" }}
          >
            <p className="font-mono text-[#b34b36] text-[0.8vw] uppercase tracking-widest mb-[0.5vw]">Voice 01 / Kore</p>
            <h3 className="font-serif text-[#201b19] text-[2vw]">FRONT ROW</h3>
            <p className="font-serif text-[#73675f] text-[1.2vw] mt-[1vw] leading-relaxed">
              "We're seeing a massive shift in how these stories break. It's not press releases anymore, it's open signal."
            </p>
            <div className="w-full h-[2px] bg-[#c7b9aa] mt-[2vw] relative overflow-hidden">
              <motion.div 
                className="absolute top-0 left-0 bottom-0 bg-[#b34b36]"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 5.5, duration: 8, ease: "linear" }}
              />
            </div>
          </motion.div>

          <motion.div
            className="bg-[#f0e8de] border border-[#c7b9aa] p-[3vw] w-[30vw] text-left shadow-xl"
            initial={{ opacity: 0, rotateY: -90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            transition={{ delay: 4.5, duration: 1.2, ease: "easeOut" }}
          >
            <p className="font-mono text-[#365f67] text-[0.8vw] uppercase tracking-widest mb-[0.5vw]">Voice 02 / Puck</p>
            <h3 className="font-serif text-[#201b19] text-[2vw]">BACKSTAGE</h3>
            <p className="font-serif text-[#73675f] text-[1.2vw] mt-[1vw] leading-relaxed">
              "Exactly. And looking at the data, the engagement velocity completely bypassed traditional channels."
            </p>
            <div className="w-full h-[2px] bg-[#c7b9aa] mt-[2vw] relative overflow-hidden">
              <motion.div 
                className="absolute top-0 left-0 bottom-0 bg-[#365f67]"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 9.5, duration: 6, ease: "linear" }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
