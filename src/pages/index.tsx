import { useState, useEffect } from 'react'
import Image from 'next/image'
import Head from 'next/head'

// Define types for Story (Frontend must match Backend)
interface Option {
  text: string
  nextNodeId?: string
}

interface StoryNode {
  id: string
  title: string
  content: string
  summary: string
  options: Option[]
  images: Record<string, string>
  isEnding?: boolean
  analyses?: Record<string, AnalysisResult>
  povContents?: Record<string, string>
}

interface Story {
  id: string
  rootId: string
  nodes: Record<string, StoryNode>
  characters: string[]
  style: string
  history: string[]
  originalSegments?: StoryNode[]
}

interface AnalysisResult {
  knowledge: { point: string; quote?: string; explanation: string }[]
  questions: { question: string; depth: string; answer: string }[]
}

export default function Home() {
  const [text, setText] = useState('')
  const [style, setStyle] = useState('写实风格')
  const [segmentCount, setSegmentCount] = useState<number>(5)
  const [maxPerspectives, setMaxPerspectives] = useState<number>(1)
  const [maxInteractiveTurns, setMaxInteractiveTurns] = useState<number>(5)
  const [preGenOriginal, setPreGenOriginal] = useState<boolean>(true)
  const [preGenOriginalAnalysis, setPreGenOriginalAnalysis] = useState<boolean>(true)
  const [preGenOriginalPov, setPreGenOriginalPov] = useState<boolean>(true)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Story State
  const [story, setStory] = useState<Story | null>(null)
  const [currentNodeId, setCurrentNodeId] = useState<string>('')
  const [currentPerspective, setCurrentPerspective] = useState<string>('default')
  const [generatingNext, setGeneratingNext] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [mode, setMode] = useState<'interactive' | 'original'>('interactive')
  const [currentOriginalIndex, setCurrentOriginalIndex] = useState(0)
  const [branchEnabled, setBranchEnabled] = useState(true)
  const [analysisExpanded, setAnalysisExpanded] = useState(false)
  const [povLoading, setPovLoading] = useState(false)

  const styles = ['写实风格', '卡通风格', '水彩风格', '像素风格', '赛博朋克', '国风水墨']

  useEffect(() => {
    const k = localStorage.getItem('ark_api_key')
    if (k) setApiKey(k)
  }, [])

  useEffect(() => {
    if (!story) { setAnalysis(null); return }
    if (mode === 'interactive') {
      if (!currentNodeId) { setAnalysis(null); return }
      const node = story.nodes[currentNodeId]
      setAnalysisLoading(true)
      setAnalysisError('')
      fetch('/api/story/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ark-api-key': apiKey },
        body: JSON.stringify({ storyId: story.id, nodeId: node.id, perspective: currentPerspective })
      })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j?.error || '分析失败'); return j })
      .then((j) => { setAnalysis(j) })
      .catch(() => { setAnalysisError('分析失败') })
      .finally(() => { setAnalysisLoading(false) })
    } else {
      const seg = story.originalSegments && story.originalSegments[currentOriginalIndex]
      if (!seg) { setAnalysis(null); return }
      setAnalysisLoading(true)
      setAnalysisError('')
      fetch('/api/story/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ark-api-key': apiKey },
        body: JSON.stringify({ storyId: story.id, originalIndex: currentOriginalIndex, perspective: currentPerspective })
      })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j?.error || '分析失败'); return j })
      .then((j) => { setAnalysis(j) })
      .catch(() => { setAnalysisError('分析失败') })
      .finally(() => { setAnalysisLoading(false) })
    }
  }, [story, currentNodeId, currentPerspective, mode, currentOriginalIndex, apiKey])

  // Init Story
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (apiKey) localStorage.setItem('ark_api_key', apiKey)
    try {
      const res = await fetch('/api/story/build', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-ark-api-key': apiKey 
        },
        body: JSON.stringify({ text, style, segments: segmentCount, maxPerspectives, maxInteractiveTurns, preGenerateOriginalImages: preGenOriginal, preGenerateOriginalAnalyses: preGenOriginalAnalysis, preGenerateOriginalPovContents: preGenOriginalPov })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || '构建失败')
      
      // Fetch full story
      const getRes = await fetch(`/api/story/get?id=${json.storyId}`)
      const storyData = await getRes.json()
      if (!storyData) throw new Error('获取故事失败')
      
      setStory(storyData)
      setCurrentNodeId(storyData.rootId)
      setCurrentPerspective('default')
    } catch (err) {
      const hasMessage = typeof err === 'object' && err && 'message' in err
      const m = hasMessage ? String((err as Record<string, unknown>)['message']) : String(err)
      setError(m)
    } finally {
      setLoading(false)
    }
  }

  // Handle Option Click (Next Node)
  const handleOptionClick = async (optionIndex: number) => {
    if (!story || !currentNodeId) return
    setGeneratingNext(true)
    try {
        const res = await fetch('/api/story/next', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-ark-api-key': apiKey },
            body: JSON.stringify({ 
                storyId: story.id, 
                nodeId: currentNodeId, 
                optionIndex,
                perspective: currentPerspective
            })
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || '生成失败')
        
        const { nextNode } = json
        // Update local story state with new node
        const newStory = { ...story }
        newStory.nodes[nextNode.id] = nextNode
        newStory.history.push(nextNode.id)
        setStory(newStory)
        setCurrentNodeId(nextNode.id)
    } catch {
        alert('生成下一情节失败，请重试')
    } finally {
        setGeneratingNext(false)
    }
  }

  // Handle Back
  const handleBack = () => {
      if (!story) return
      const idx = story.history.indexOf(currentNodeId)
      if (idx > 0) {
          setCurrentNodeId(story.history[idx - 1])
      }
  }

  // Handle Perspective Change
  const handlePerspectiveChange = async (p: string) => {
      setCurrentPerspective(p)
      if (p === 'default') return
      if (!story) return
      if (mode === 'interactive') {
        if (!currentNodeId) return
        const node = story.nodes[currentNodeId]
        if (!node.images[p]) {
            try {
              const res = await fetch('/api/story/perspective', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-ark-api-key': apiKey },
                  body: JSON.stringify({ storyId: story.id, nodeId: currentNodeId, perspective: p })
              })
              const json = await res.json()
              if (json.url) {
                  const newStory = { ...story }
                  newStory.nodes[currentNodeId].images[p] = json.url
                  setStory(newStory)
              }
            } catch {}
        }
        if (!(node.povContents && node.povContents[p])) {
          try {
            setPovLoading(true)
            const res = await fetch('/api/story/rewrite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-ark-api-key': apiKey },
              body: JSON.stringify({ storyId: story.id, nodeId: currentNodeId, perspective: p })
            })
            const json = await res.json()
            if (json.content) {
              const newStory = { ...story }
              if (!newStory.nodes[currentNodeId].povContents) newStory.nodes[currentNodeId].povContents = {}
              newStory.nodes[currentNodeId].povContents[p] = json.content
              setStory(newStory)
            }
          } catch {} finally { setPovLoading(false) }
        } else {
          setPovLoading(false)
        }
      } else {
        const seg = story.originalSegments && story.originalSegments[currentOriginalIndex]
        if (!seg) return
        if (!seg.images[p]) {
          try {
            const res = await fetch('/api/story/original-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-ark-api-key': apiKey },
              body: JSON.stringify({ storyId: story.id, index: currentOriginalIndex, perspective: p })
            })
            const json = await res.json()
            if (json.url) {
              const newStory = { ...story }
              if (newStory.originalSegments) {
                newStory.originalSegments[currentOriginalIndex].images[p] = json.url
              }
              setStory(newStory)
            }
          } catch {}
        }
        if (!(seg.povContents && seg.povContents[p])) {
          try {
            setPovLoading(true)
            const res = await fetch('/api/story/original-rewrite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-ark-api-key': apiKey },
              body: JSON.stringify({ storyId: story.id, index: currentOriginalIndex, perspective: p })
            })
            const json = await res.json()
            if (json.content) {
              const newStory = { ...story }
              if (newStory.originalSegments) {
                if (!newStory.originalSegments[currentOriginalIndex].povContents) newStory.originalSegments[currentOriginalIndex].povContents = {}
                newStory.originalSegments[currentOriginalIndex].povContents[p] = json.content
              }
              setStory(newStory)
            }
          } catch {} finally { setPovLoading(false) }
        } else {
          setPovLoading(false)
        }
      }
  }

  const handleAutoNext = async () => {
    await handleOptionClick(0)
  }

  const handleRestart = () => {
    setStory(null)
    setCurrentNodeId('')
    setText('')
  }

  const currentNode = story?.nodes[currentNodeId]
  const originalSeg = story?.originalSegments && story.originalSegments[currentOriginalIndex]
  const currentImage = mode === 'interactive' ? (currentNode?.images[currentPerspective] || currentNode?.images['default']) : (originalSeg?.images[currentPerspective] || originalSeg?.images['default'])
  const displayTitle = mode === 'interactive' ? currentNode?.title : originalSeg?.title
  const displayContent = mode === 'interactive' 
    ? (currentNode?.povContents?.[currentPerspective] ?? currentNode?.content) 
    : (originalSeg?.povContents?.[currentPerspective] ?? originalSeg?.content)

  useEffect(() => {
    if (!story) return
    if (mode === 'original') {
      const seg = story.originalSegments && story.originalSegments[currentOriginalIndex]
      if (!seg) return
      if (!seg.images[currentPerspective]) {
        fetch('/api/story/original-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ark-api-key': apiKey },
          body: JSON.stringify({ storyId: story.id, index: currentOriginalIndex, perspective: currentPerspective })
        }).then(async r => { const j = await r.json(); if (j.url) {
          const newStory = { ...story }
          if (newStory.originalSegments) newStory.originalSegments[currentOriginalIndex].images[currentPerspective] = j.url
          setStory(newStory)
        } }).catch(() => {})
      }
    }
  }, [mode, currentOriginalIndex, currentPerspective, story, apiKey])

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f9', fontFamily: 'sans-serif' }}>
      <Head>
        <title>互动故事生成器</title>
      </Head>
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: '-0.025em' }}>互动故事生成器</h1>
            {story && <button onClick={handleRestart} style={{ fontSize: 14, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: 6, transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f3f4f6'} onMouseOut={e => e.currentTarget.style.background = 'none'}>结束并重新开始</button>}
        </div>
        
        {!story ? (
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 24, background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Ark API Key</label>
              <input 
                type="password" 
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)} 
                placeholder="sk-..." 
                style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db', width: '100%' }} 
              />
            </div>
            
            <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>输入故事背景/课文</label>
                <textarea 
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    placeholder="在此粘贴文本..." 
                    style={{ minHeight: 200, padding: 12, borderRadius: 8, border: '1px solid #d1d5db', width: '100%', lineHeight: 1.5 }} 
                />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>选择视觉风格</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {styles.map(s => (
                        <button
                            type="button"
                            key={s}
                            onClick={() => setStyle(s)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 20,
                                border: style === s ? '2px solid #2563eb' : '1px solid #d1d5db',
                                background: style === s ? '#eff6ff' : '#fff',
                                color: style === s ? '#1e40af' : '#374151',
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>最大视角数（不含默认）</label>
                <input 
                  type="number"
                  value={maxPerspectives}
                  onChange={e => setMaxPerspectives(Math.max(0, Math.min(20, Number(e.target.value))))}
                  style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db', width: '100%' }}
                />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>交互回合数限制（同时作为原文分段数）</label>
                <input 
                  type="number"
                  value={maxInteractiveTurns}
                  onChange={e => {
                    const v = Math.max(3, Math.min(50, Number(e.target.value)))
                    setMaxInteractiveTurns(v)
                    setSegmentCount(v)
                  }}
                  style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db', width: '100%' }}
                />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>开始展示模式</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setMode('interactive')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 20,
                        border: mode === 'interactive' ? '2px solid #2563eb' : '1px solid #d1d5db',
                        background: mode === 'interactive' ? '#eff6ff' : '#fff',
                        color: mode === 'interactive' ? '#1e40af' : '#374151',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      交互选项模式
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('original')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 20,
                        border: mode === 'original' ? '2px solid #2563eb' : '1px solid #d1d5db',
                        background: mode === 'original' ? '#eff6ff' : '#fff',
                        color: mode === 'original' ? '#1e40af' : '#374151',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      原文图像模式
                    </button>
                </div>
            </div>

            {mode === 'original' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                  <input type="checkbox" checked={preGenOriginal} onChange={e => setPreGenOriginal(e.target.checked)} />
                  预生成原文片段图像以便离线展示
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                  <input type="checkbox" checked={preGenOriginalAnalysis} onChange={e => setPreGenOriginalAnalysis(e.target.checked)} />
                  预生成原文片段分析以便离线讨论
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                  <input type="checkbox" checked={preGenOriginalPov} onChange={e => setPreGenOriginalPov(e.target.checked)} />
                  预生成视角改写文本（默认 + 所有角色）
                </label>
              </>
            )}

            <button 
                disabled={loading || !text.trim()} 
                style={{ 
                    padding: '14px', 
                    background: loading ? '#9ca3af' : '#2563eb', 
                    color: '#fff', 
                    borderRadius: 8, 
                    border: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer'
                }}
            >
                {loading ? '正在解析并生成开篇...' : '开始故事'}
            </button>
            {error && <div style={{ color: '#dc2626', fontSize: 14 }}>{error}</div>}
          </form>
        ) : (
          <div style={{ display: 'grid', gap: 24 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setMode('interactive')} style={{ padding: '8px 12px', borderRadius: 6, border: mode==='interactive' ? '2px solid #2563eb' : '1px solid #d1d5db', background: mode==='interactive' ? '#eff6ff' : '#fff', color: mode==='interactive' ? '#1e40af' : '#374151', cursor: 'pointer' }}>交互选项模式</button>
                  <button onClick={() => setMode('original')} style={{ padding: '8px 12px', borderRadius: 6, border: mode==='original' ? '2px solid #2563eb' : '1px solid #d1d5db', background: mode==='original' ? '#eff6ff' : '#fff', color: mode==='original' ? '#1e40af' : '#374151', cursor: 'pointer' }}>原文图像模式</button>
                </div>
                <button 
                    onClick={handleBack} 
                    disabled={story.history.indexOf(currentNodeId) <= 0}
                    style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', opacity: story.history.indexOf(currentNodeId) <= 0 ? 0.5 : 1 }}
                >
                    ← 返回上一步
                </button>
                
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#6b7280' }}>当前视角:</span>
                    <select 
                        value={currentPerspective} 
                        onChange={e => handlePerspectiveChange(e.target.value)}
                        style={{ padding: '8px', borderRadius: 6, border: '1px solid #d1d5db' }}
                    >
                        <option value="default">原文视角</option>
                        {story.characters.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
                {mode === 'interactive' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#374151' }}>
                    <input type="checkbox" checked={branchEnabled} onChange={e => setBranchEnabled(e.target.checked)} />
                    显示分支选项
                  </label>
                )}
                
                <div style={{ marginLeft: 'auto', fontSize: 14, color: '#6b7280' }}>
                    {mode === 'interactive' ? (
                      <>节点: {story.history.indexOf(currentNodeId) + 1}</>
                    ) : (
                      <>原文片段: {(currentOriginalIndex + 1)} / {(story.originalSegments ? story.originalSegments.length : 0)}</>
                    )}
                </div>
            </div>

            {currentNode && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
                <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'grid', gridTemplateColumns: '1fr 480px', minHeight: 640 }}>
                  <div style={{ background: 'linear-gradient(135deg, #1f2937 0%, #000 100%)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 640, width: '100%' }}>
                    {currentImage ? (
                      <Image 
                        src={currentImage} 
                        alt={currentNode?.title || 'scene'} 
                        fill 
                        style={{ objectFit: 'contain' }}
                        sizes="(max-width: 1600px) 100vw, 1600px"
                        priority
                      />
                    ) : (
                      <div style={{ color: '#9ca3af', textAlign: 'center' }}>
                          <div style={{ marginBottom: 8 }}>正在绘制{currentPerspective !== 'default' ? ` ${currentPerspective} 视角的` : ''}场景...</div>
                          <div style={{ fontSize: 12 }}>请稍候</div>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, backdropFilter: 'blur(4px)' }}>
                      {story.style}
                    </div>
                  </div>
                  <div style={{ padding: 40, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #f3f4f6' }}>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontSize: 28, fontWeight: '800', marginBottom: 12, color: '#111827', letterSpacing: '-0.025em' }}>{displayTitle}</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                        <span style={{ fontSize: 12, color: '#4b5563', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 12, padding: '4px 10px', fontWeight: 500 }}>视角：{currentPerspective === 'default' ? '原文视角' : currentPerspective}</span>
                        {povLoading && (
                          <span style={{ fontSize: 12, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #2563eb', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></span>
                            正在按该视角改写文本...
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 18, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }}>
                        {displayContent}
                      </div>
                    </div>
                    <div style={{ marginTop: 40 }}>
                      {mode === 'interactive' ? (
                        <>
                          {branchEnabled ? (
                            <>
                              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {currentNode!.isEnding ? '结局' : '做出你的选择'}
                              </h3>
                              <div style={{ display: 'grid', gap: 12 }}>
                                {generatingNext ? (
                                  <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: 8 }}>
                                    正在生成后续剧情...
                                  </div>
                                ) : (
                                  <>
                                    {(currentNode!.options && currentNode!.options.length > 0 ? currentNode!.options : [{ text: '继续' }]).map((opt, i) => (
                                      <button 
                                        key={i}
                                        onClick={() => handleOptionClick(i)}
                                        style={{ 
                                          padding: '16px 20px', 
                                          textAlign: 'left', 
                                          background: '#fff', 
                                          border: '1px solid #e5e7eb', 
                                          borderRadius: 12, 
                                          fontSize: 16,
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          width: '100%'
                                        }}
                                        onMouseOver={e => {
                                          e.currentTarget.style.borderColor = '#2563eb';
                                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.1)';
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseOut={e => {
                                          e.currentTarget.style.borderColor = '#e5e7eb';
                                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                          e.currentTarget.style.transform = 'none';
                                        }}
                                      >
                                        <span style={{ 
                                          color: '#2563eb', 
                                          fontWeight: 700, 
                                          marginRight: 12, 
                                          background: '#eff6ff', 
                                          width: 24, 
                                          height: 24, 
                                          borderRadius: '50%', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center',
                                          fontSize: 14,
                                          flexShrink: 0
                                        }}>
                                          {String.fromCharCode(65 + i)}
                                        </span>
                                        <span style={{ color: '#374151', lineHeight: 1.5 }}>{opt.text}</span>
                                      </button>
                                    ))}
                                    {currentNode!.isEnding && (
                                      <div style={{ padding: 20, background: '#ecfdf5', color: '#065f46', borderRadius: 12, textAlign: 'center', border: '1px solid #a7f3d0' }}>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>✨ 故事结局</div>
                                        <div style={{ fontSize: 14 }}>已达成结局。尝试返回上一步探索其他路径？</div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                              {generatingNext ? (
                                <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: 8 }}>
                                  正在生成下一情节...
                                </div>
                              ) : (
                                <button onClick={handleAutoNext} style={{ padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>继续（无分支）</button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setCurrentOriginalIndex(i => Math.max(0, i - 1))} style={{ padding: 12, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>上一段</button>
                          <button onClick={() => setCurrentOriginalIndex(i => Math.min((story!.originalSegments ? story!.originalSegments.length - 1 : 0), i + 1))} style={{ padding: 12, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>下一段</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', position: 'sticky', top: 24, height: 'fit-content', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>文本分析与思考</h3>
                    <button onClick={() => setAnalysisExpanded(v => !v)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                      {analysisExpanded ? '收起' : '展开全部'}
                    </button>
                  </div>
                  {analysisLoading ? (
                    <div style={{ padding: 20, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, color: '#6b7280', textAlign: 'center', fontSize: 14 }}>
                      <div style={{ marginBottom: 8 }}>正在分析文本...</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>可在等待图片生成时阅读与讨论</div>
                    </div>
                  ) : analysisError ? (
                    <div style={{ padding: 20, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#b91c1c', textAlign: 'center', fontSize: 14 }}>
                      分析失败，请稍后重试
                    </div>
                  ) : analysis ? (
                    <div style={{ display: 'grid', gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>语文知识点</div>
                        <div style={{ display: 'grid', gap: 12 }}>
                          {analysis.knowledge.map((k, i) => (
                            <div key={i} style={{ padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 6, fontSize: 15 }}>{k.point}</div>
                              {k.quote && <div style={{ fontSize: 13, color: '#475569', marginBottom: 8, fontStyle: 'italic', borderLeft: '2px solid #cbd5e1', paddingLeft: 8 }}>“{k.quote}”</div>}
                              <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{k.explanation}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>思考题</div>
                        <div style={{ display: 'grid', gap: 12 }}>
                          {analysis.questions.map((q, i) => (
                            <div key={i} style={{ padding: 16, background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, color: '#9a3412', fontSize: 15 }}>{q.question}</div>
                                <div style={{ fontSize: 12, color: '#c2410c', background: '#ffedd5', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', marginLeft: 8 }}>{q.depth}</div>
                              </div>
                              <div style={{ fontSize: 14, color: '#7c2d12', lineHeight: 1.6 }}>{q.answer}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
