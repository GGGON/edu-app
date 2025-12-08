import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

const TEXT = "鲁镇的酒店的格局，是和别处不同的：都是当街一个曲尺形的大柜台，柜里面预备着热水，可以随时温酒。做工的人，傍午傍晚散了工，每每花四文铜钱，买一碗酒，——这是二十多年前的事，现在每碗要涨到十文，——靠柜外站着，热热的喝了休息。"

export default function Intro() {
  const [stage, setStage] = useState<'ready' | 'black' | 'text' | 'scatter' | 'reveal'>('ready')
  const [chars, setChars] = useState<{char: string, x: number, y: number, r: number}[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)
  
  // Initialize char positions for scatter effect
  useEffect(() => {
    setChars(TEXT.split('').map(c => ({
      char: c,
      x: (Math.random() - 0.5) * 1500, // Increased scatter range
      y: (Math.random() - 0.5) * 1500,
      r: (Math.random() - 0.5) * 720   // More rotation
    })))
  }, [])

  const startSequence = () => {
    setStage('black')
    if (audioRef.current) {
      audioRef.current.volume = 0.5
      audioRef.current.play().catch(e => console.log("Audio play failed", e))
    }
    
    // Timeline
    setTimeout(() => setStage('text'), 1000)   // 1s: Fade in text
    setTimeout(() => setStage('scatter'), 6000) // 6s: Scatter text
    setTimeout(() => setStage('reveal'), 8000)  // 8s: Reveal background
  }

  return (
    <>
      <Head>
        <title>Intro Sequence - 孔乙己</title>
      </Head>

      {/* Background Music Placeholder */}
      <audio ref={audioRef} src="/bgm.mp3" loop />

      {/* Main Container */}
      <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#fdfbf7]">
        
        {/* Ink Wash Background Image (Simulated/Enhanced for Intro) */}
        <div 
            className={`absolute inset-0 transition-opacity duration-[3000ms] ${stage === 'reveal' ? 'opacity-100' : 'opacity-0'}`}
            style={{
                backgroundImage: `
                    radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0%, rgba(240,230,220,0.8) 100%),
                    url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E"),
                    linear-gradient(135deg, #e6e6e6 0%, #ffffff 100%)
                `,
                // In a real scenario, replace the gradient above with a real Ink Wash image URL
                // backgroundSize: 'cover'
            }}
        >
             {/* Center Ink Blob/Illustration Placeholder */}
             <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-[800px] h-[800px] fill-stone-800 blur-3xl">
                    <path d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,81.6,-46.6C91.4,-34.1,98.1,-19.2,95.8,-5.3C93.5,8.6,82.2,21.5,70.6,31.2C59,40.9,47.1,47.4,35.7,52.3C24.3,57.2,13.4,60.5,1.5,58C-10.4,55.4,-23.3,47,-36.1,39.3C-48.9,31.6,-61.6,24.6,-68.8,13.4C-76,2.2,-77.7,-13.2,-72.6,-26.8C-67.5,-40.4,-55.6,-52.2,-42.6,-59.8C-29.6,-67.4,-15.5,-70.8,-0.5,-70C14.5,-69.1,29,-64,44.7,-76.4Z" transform="translate(100 100)" />
                </svg>
             </div>
        </div>

        {/* Start Button */}
        {stage === 'ready' && (
          <div className="z-50 absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur">
            <button 
              onClick={startSequence}
              className="px-8 py-4 bg-stone-800 text-stone-100 text-xl rounded shadow-lg hover:bg-stone-700 transition"
            >
              开始录制 (Start Sequence)
            </button>
          </div>
        )}

        {/* Black Overlay & Text */}
        <div 
          className={`fixed inset-0 bg-black flex items-center justify-center transition-opacity duration-[3000ms] ease-in-out ${
            stage === 'reveal' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          style={{ zIndex: 40 }}
        >
          <div className="max-w-4xl px-12 text-center leading-loose">
            {chars.map((item, i) => (
              <span
                key={i}
                className="inline-block transition-all duration-[2000ms] ease-out text-4xl md:text-6xl font-serif text-stone-200"
                style={{
                  opacity: stage === 'black' ? 0 : (stage === 'scatter' || stage === 'reveal' ? 0 : 1),
                  transform: stage === 'scatter' || stage === 'reveal'
                    ? `translate(${item.x}px, ${item.y}px) rotate(${item.r}deg) scale(0)`
                    : 'translate(0, 0) rotate(0) scale(1)',
                  transitionDelay: stage === 'text' ? `${i * 50}ms` : '0ms'
                }}
              >
                {item.char}
              </span>
            ))}
          </div>
        </div>

        {/* Background Content (Revealed at the end) */}
        <div className={`transition-opacity duration-1000 ${stage === 'reveal' ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-center">
            <h1 className="text-6xl font-serif mb-8 text-stone-800 tracking-widest">桃花源记</h1>
            <p className="text-2xl text-stone-600 font-serif">智能互动故事生成器</p>
          </div>
        </div>

      </div>
    </>
  )
}
