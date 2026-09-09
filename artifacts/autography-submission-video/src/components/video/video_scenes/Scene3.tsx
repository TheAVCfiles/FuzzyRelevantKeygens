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
        className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-multiply blur-sm" 
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/home.jpg)` }} 
      />

      <div className="absolute top-[4vw] left-[4vw] z-20">
        <motion.p
          className="font-mono text-[var(--accent-rust)] text-[1vw] uppercase tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          The Podcast Desk
        </motion.p>
        <motion.h2
          className="font-serif text-[var(--bg-dark)] text-[3.5vw] leading-none mt-[1vw]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          Grounding in Reality
        </motion.h2>
      </div>

      <motion.div 
        className="absolute top-[12vw] left-[4vw] right-[4vw] bottom-[4vw] bg-[var(--bg-primary)] border border-[var(--accent-gold)] shadow-2xl flex overflow-hidden"
        initial={{ y: "20vw", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 2, duration: 1.2, ease: "easeOut" }}
      >
        {/* Fake UI Sidebar */}
        <div className="w-1/3 border-r border-[var(--accent-gold)] p-[2.5vw] flex flex-col gap-[2vw]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.5 }}
          >
            <p className="font-mono text-[0.8vw] text-[var(--accent-teal)] uppercase mb-[1vw] tracking-widest">Powered By</p>
            <p className="font-serif text-[1.8vw] text-[var(--bg-dark)] leading-tight">Gemini +<br/>Google Search</p>
            <p className="font-serif text-[1.1vw] text-[var(--text-secondary)] mt-[1vw] leading-relaxed">Retrieving current public sources. Live grounding, no static datasets.</p>
          </motion.div>
          
          <div className="mt-auto flex flex-col gap-[1vw]">
            <motion.div
              className="bg-[var(--accent-teal)] text-[var(--bg-primary)] px-[1vw] py-[0.8vw] font-mono text-[0.8vw] uppercase tracking-widest inline-block text-center w-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 4, type: "spring" }}
            >
              Retrieval Complete
            </motion.div>
            <motion.div
              className="border border-[var(--accent-teal)] text-[var(--accent-teal)] px-[1vw] py-[0.8vw] font-mono text-[0.8vw] uppercase tracking-widest inline-block text-center w-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 4.2, type: "spring" }}
            >
              Review Sources
            </motion.div>
          </div>
        </div>
        
        {/* Fake UI Content - Concept Source Comparison */}
        <div className="flex-1 p-[2.5vw] flex flex-col gap-[1.5vw] bg-[#eee7dc]/60">
          {[
            { platform: "reddit", comm: "r/movies", title: "New casting rumors for the upcoming sci-fi epic", time: "2h ago", sig: "12.4K", id: "9823", tone: "text-[#365f67]" },
            { platform: "public web", comm: "variety", title: "Studio confirms delays in production schedule", time: "5h ago", sig: "8.1K", id: "4412", tone: "text-[#9e3e2d]" },
            { platform: "twitter", comm: "film_updates", title: "Leaked set photos reveal practical effects usage", time: "1d ago", sig: "45.2K", id: "7721", tone: "text-[#365f67]" }
          ].map((item, i) => (
            <motion.div
              key={i}
              className="border-b border-[var(--accent-gold)] pb-[1.5vw] last:border-0"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 4.5 + (i * 1.5), duration: 0.8 }}
            >
              <div className="mb-[0.5vw] flex items-center gap-[0.5vw] font-mono text-[0.7vw] uppercase tracking-[0.12em] text-[var(--accent-rust)]">
                <span>{item.platform}</span>
                <span className="text-[var(--text-secondary)]">/</span>
                <span className="text-[var(--text-secondary)]">{item.comm}</span>
              </div>
              <p className="line-clamp-2 font-serif text-[1.4vw] leading-[1.25] text-[var(--bg-dark)]">
                {item.title}
              </p>
              <div className="mt-[0.8vw] flex flex-wrap items-center gap-x-[1vw] gap-y-[0.5vw] font-mono text-[0.7vw] uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                <span>{item.time}</span>
                <span>{item.sig} signal</span>
                <span className="text-[var(--accent-teal)]">ID {item.id}</span>
                <span className={item.tone}>approved live</span>
              </div>
              {i === 0 && (
                <motion.div 
                  className="mt-[1vw] border-l-2 border-[var(--accent-teal)] pl-[1vw] text-[0.8vw] leading-relaxed text-[var(--text-secondary)] font-serif"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ delay: 6, duration: 0.8 }}
                >
                  <p>Approved live result · news_report · policy PR-144</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
