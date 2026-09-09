import { motion } from 'framer-motion';

export function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 bg-[var(--bg-secondary)] overflow-hidden"
      initial={{ x: "100%" }}
      animate={{ x: "0%" }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-15 mix-blend-multiply blur-[2px]" 
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/home.jpg)` }} 
      />

      <div className="absolute top-[3vw] left-[4vw] z-20">
        <motion.p
          className="font-mono text-[var(--bg-primary)] bg-[var(--accent-rust)] px-[1vw] py-[0.4vw] inline-block text-[1vw] uppercase tracking-widest font-bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Live Google Search → Grounded Agentic Analysis
        </motion.p>
        <motion.h2
          className="font-serif text-[var(--bg-dark)] text-[4vw] leading-none mt-[1.5vw] drop-shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          Trending Talk to Grounded Truth
        </motion.h2>
      </div>

      <motion.div 
        className="absolute top-[14vw] left-[4vw] right-[4vw] bottom-[4vw] bg-[var(--bg-primary)]/90 backdrop-blur-md border-2 border-[var(--accent-gold)] shadow-2xl flex overflow-hidden"
        initial={{ y: "30vw", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 2, duration: 1.2, ease: "easeOut" }}
      >
        {/* Fake UI Sidebar */}
        <div className="w-1/3 border-r-2 border-[var(--accent-gold)] p-[3vw] flex flex-col gap-[2vw] bg-white/50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.5 }}
          >
            <p className="font-mono text-[0.9vw] text-[var(--accent-teal)] uppercase mb-[1vw] tracking-widest font-bold">Powered By</p>
            <p className="font-serif text-[2.2vw] text-[var(--bg-dark)] leading-tight font-semibold">Gemini +<br/>Google Search</p>
            <p className="font-serif text-[1.3vw] text-[var(--text-secondary)] mt-[1.5vw] leading-relaxed">Retrieving live trending talk and public sources. <span className="font-bold text-[var(--accent-rust)]">No static datasets.</span></p>
          </motion.div>
          
          <div className="mt-auto flex flex-col gap-[1vw]">
            <motion.div
              className="bg-[var(--accent-teal)] text-[var(--bg-primary)] px-[1vw] py-[1vw] font-mono text-[0.9vw] uppercase tracking-widest font-bold text-center w-full shadow-md"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 4, type: "spring" }}
            >
              Retrieval Complete
            </motion.div>
          </div>
        </div>
        
        {/* Fake UI Content - Concept Source Comparison */}
        <div className="flex-1 p-[3vw] flex flex-col justify-center gap-[2vw]">
          {[
            { platform: "reddit", comm: "r/movies", title: "New casting rumors for the upcoming sci-fi epic", time: "LIVE", sig: "12.4K", id: "9823", tone: "text-[var(--accent-teal)]" },
            { platform: "public web", comm: "variety", title: "Studio confirms delays in production schedule", time: "LIVE", sig: "8.1K", id: "4412", tone: "text-[var(--accent-rust)]" },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="border-b-2 border-[var(--accent-gold)] pb-[2vw] last:border-0 bg-white/40 p-[1.5vw]"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 4.5 + (i * 1.5), duration: 0.8 }}
            >
              <div className="mb-[0.8vw] flex items-center gap-[0.5vw] font-mono text-[0.8vw] uppercase tracking-[0.12em] text-[var(--accent-rust)] font-bold">
                <span>{item.platform}</span>
                <span className="text-[var(--text-secondary)]">/</span>
                <span className="text-[var(--text-secondary)]">{item.comm}</span>
              </div>
              <p className="line-clamp-2 font-serif text-[1.8vw] leading-[1.25] text-[var(--bg-dark)] font-medium">
                {item.title}
              </p>
              <div className="mt-[1vw] flex flex-wrap items-center gap-x-[1.5vw] gap-y-[0.5vw] font-mono text-[0.8vw] uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                <span className="bg-[var(--accent-rust)] text-white px-[0.5vw] py-[0.1vw]">{item.time}</span>
                <span>{item.sig} signal</span>
                <span className="text-[var(--accent-teal)] font-bold">ID {item.id}</span>
                <span className={`${item.tone} font-bold`}>approved live</span>
              </div>
              {i === 0 && (
                <motion.div 
                  className="mt-[1.5vw] border-l-4 border-[var(--accent-teal)] pl-[1vw] text-[1vw] leading-relaxed text-[var(--bg-dark)] font-mono uppercase bg-black/5 p-[1vw]"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ delay: 6, duration: 0.8 }}
                >
                  <p>Agentic Classification: news_report · policy PR-144</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
