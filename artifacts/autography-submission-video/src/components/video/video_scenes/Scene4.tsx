import { motion } from 'framer-motion';

export function Scene4() {
  return (
    <motion.div
      className="absolute inset-0 bg-[#201b19] flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-[#482e29]/80 to-transparent" />
      
      <motion.div 
        className="relative z-10 w-[85vw] flex justify-between items-center gap-[6vw]"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
      >
        <div className="w-1/2">
          <motion.div
            className="bg-[#d8a36c] px-[1vw] py-[0.4vw] inline-block mb-[2vw]"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.5, type: "spring" }}
          >
            <p className="font-mono text-[#201b19] text-[1vw] uppercase tracking-widest font-bold">Deterministic Human Control</p>
          </motion.div>
          <h2 className="font-serif text-[#f0e8de] text-[4vw] leading-[1.1] mb-[2vw] drop-shadow-md">
            Nothing moves to production without a human decision.
          </h2>
          <p className="font-serif text-[#b7aaa0] text-[1.6vw] leading-relaxed">
            Human approvals, policy enforcement, publishing, and Cut Keys remain in an independent deterministic layer, completely outside both model paths.
          </p>
        </div>
        
        <div className="w-1/2 flex flex-col gap-[2.5vw] bg-[#2c2927]/90 p-[3.5vw] border-2 border-[#4f4944] shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-[1vw] border-b-2 border-[#4f4944] pb-[1vw]">
             <span className="font-mono text-[1vw] uppercase tracking-[0.1em] text-[#d8a36c] font-bold">Independent Gates</span>
             <span className="font-mono text-[0.8vw] uppercase tracking-[0.1em] text-[#80756c] bg-[#4f4944] px-[0.5vw] py-[0.2vw]">human_required</span>
          </div>

          {[
            { gate: "Gate 01", title: "Approve Brief", status: "cleared", label: "Validated hypothesis" },
            { gate: "Gate 02", title: "Approve Script", status: "cleared", label: "Reviewed dialogue" },
            { gate: "Gate 03", title: "Approve Audio", status: "pending", label: "Final render clearance" }
          ].map((item, i) => (
            <motion.div
              key={i}
              className="border-l-4 border-[#4f4944] pl-[2vw] relative bg-black/20 p-[1.5vw]"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2.5 + (i * 2), duration: 0.8 }}
            >
              <motion.div
                className={`absolute left-[-0.25vw] top-[50%] w-[1.2vw] h-[1.2vw] rounded-full -translate-y-1/2 ${
                  item.status === 'cleared' ? 'bg-[#9bc8a9]' : 'bg-[#d8a36c]'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 3 + (i * 2), type: "spring" }}
              />
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-mono text-[#80756c] text-[0.9vw] uppercase tracking-widest font-bold">{item.gate}</p>
                  <h3 className="font-serif text-[#f0e8de] text-[2vw] mt-[0.5vw] mb-[0.2vw]">{item.title}</h3>
                  <p className="font-serif text-[#b7aaa0] text-[1.2vw]">{item.label}</p>
                </div>
                
                <motion.div 
                  className={`border-2 px-[1.5vw] py-[0.8vw] font-mono text-[0.9vw] uppercase tracking-[0.1em] font-bold ${
                    item.status === 'cleared' ? 'border-[#577964] text-[#9bc8a9] bg-[#577964]/20' : 'border-[#d8a36c] text-[#d8a36c] bg-[#d8a36c]/10'
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3.5 + (i * 2) }}
                >
                  {item.status === 'cleared' ? 'Approved' : 'Pending'}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
