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
      <div className="absolute inset-0 bg-[#482e29]/40" />
      
      <motion.div 
        className="relative z-10 w-[85vw] flex justify-between items-start gap-[4vw]"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
      >
        <div className="w-1/2 pt-[2vw]">
          <h2 className="font-serif text-[#f0e8de] text-[3.5vw] leading-[1.1] mb-[2vw]">
            Human control remains paramount and entirely outside ADK.
          </h2>
          <p className="font-serif text-[#b7aaa0] text-[1.4vw] leading-relaxed">
            Human approvals, policy enforcement, publishing, and Cut Keys exist in an independent deterministic layer.
          </p>
        </div>
        
        <div className="w-1/2 flex flex-col gap-[2vw] bg-[#2c2927] p-[3vw] border border-[#4f4944]">
          <div className="flex items-center justify-between mb-[1vw] border-b border-[#4f4944] pb-[1vw]">
             <span className="font-mono text-[0.8vw] uppercase tracking-[0.1em] text-[#d8a36c]">Independent Determistic Gates</span>
             <span className="font-mono text-[0.8vw] uppercase tracking-[0.1em] text-[#80756c]">human_gate_required</span>
          </div>

          {[
            { gate: "Gate 01", title: "Approve Brief", status: "cleared", label: "Validated hypothesis" },
            { gate: "Gate 02", title: "Approve Script", status: "cleared", label: "Reviewed dialogue" },
            { gate: "Gate 03", title: "Approve Audio", status: "pending", label: "Final render clearance" }
          ].map((item, i) => (
            <motion.div
              key={i}
              className="border-l-2 border-[#4f4944] pl-[2vw] relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2 + (i * 2), duration: 0.8 }}
            >
              <motion.div
                className={`absolute left-[-0.1vw] top-[0.5vw] w-[0.8vw] h-[0.8vw] rounded-full -translate-x-1/2 ${
                  item.status === 'cleared' ? 'bg-[#9bc8a9]' : 'bg-[#d8a36c]'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 2.5 + (i * 2), type: "spring" }}
              />
              <div className="flex justify-between items-baseline">
                <div>
                  <p className="font-mono text-[#80756c] text-[0.8vw] uppercase tracking-widest">{item.gate}</p>
                  <h3 className="font-serif text-[#f0e8de] text-[1.8vw] mt-[0.2vw] mb-[0.2vw]">{item.title}</h3>
                  <p className="font-serif text-[#b7aaa0] text-[1vw]">{item.label}</p>
                </div>
                
                <motion.div 
                  className={`border px-[1vw] py-[0.5vw] font-mono text-[0.7vw] uppercase tracking-[0.1em] ${
                    item.status === 'cleared' ? 'border-[#577964] text-[#9bc8a9]' : 'border-[#d8a36c] text-[#d8a36c]'
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3 + (i * 2) }}
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
