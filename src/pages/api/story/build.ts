import type { NextApiRequest, NextApiResponse } from 'next'
import { randomUUID } from 'crypto'
import { parseTextToInit, splitOriginalToSegments, analyzeText, rewritePerspective } from '../../../utils/text'
import { saveStory, StoryNode, Story } from '../../../services/store'
import { seedream } from '../../../services/ai-skills'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { text, style, segments, maxPerspectives, maxInteractiveTurns, preGenerateOriginalImages, preGenerateOriginalAnalyses, preGenerateOriginalPovContents } = req.body || {}
  const apiKey = req.headers['x-ark-api-key'] as string || undefined;

  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text' })

  // 1. Parse Text for Initial Scene and Characters
  const initData = await parseTextToInit(text, apiKey)
  const maxP = typeof maxPerspectives === 'number' ? Math.max(0, Math.floor(maxPerspectives)) : 0
  const selectedChars = Array.isArray(initData.characters) ? (maxP > 0 ? initData.characters.slice(0, maxP) : initData.characters) : []
  
  const storyId = randomUUID()
  const rootId = randomUUID()
  
  // 2. Create Root Node
  const rootNode: StoryNode = {
    id: rootId,
    title: initData.title,
    summary: initData.summary,
    content: initData.content,
    options: initData.options.map(t => ({ text: t })),
    images: {},
    isEnding: false
  }

  // 3. Generate Initial Image (Default Perspective)
  // Use style and summary
  const primaryChar = selectedChars[0] || initData.characters[0] || '主角'
  const prompt = `${style || '写实风格'}，${initData.summary}，高清，电影感，${primaryChar}视角`
  try {
    const r = await seedream.textToImage({ prompt, size: '1920x1080', watermark: false, response_format: 'url', n: 1, apiKey })
    if (r.urls[0]) {
      rootNode.images['default'] = r.urls[0]
      // Assume default is the first character's POV if available
      if (selectedChars.length > 0) {
        rootNode.images[selectedChars[0]] = r.urls[0]
      }
    }
  } catch (e) {
    console.error('Image gen failed', e)
  }

  // 4. Save Story
  const segmentsRaw = await splitOriginalToSegments(text, Number(segments || undefined), apiKey)
  const originalArray: StoryNode[] = segmentsRaw.map(seg => {
    const id = randomUUID()
    return { id, title: seg.title, summary: seg.summary, content: seg.content, options: [], images: {}, isEnding: false, analyses: {}, povContents: {} }
  })
  const imagePool = (async () => {
    if (preGenerateOriginalImages && originalArray.length > 0) {
      const perspectives = ['default', ...(selectedChars || [])]
      await Promise.all(originalArray.map(async (seg) => {
        await Promise.all(perspectives.map(async (p) => {
          try {
            const pov = p === 'default' ? '原文视角' : `${p}视角`
            const promptImg = `${style || '写实风格'}，${seg.summary}，${pov}，高清`
            const r = await seedream.textToImage({ prompt: promptImg, size: '1920x1080', watermark: false, response_format: 'url', n: 1, apiKey })
            if (r.urls[0]) {
              seg.images[p] = r.urls[0]
            }
          } catch {}
        }))
      }))
    }
  })()

  const analysisPool = (async () => {
    if (preGenerateOriginalAnalyses && originalArray.length > 0) {
      await Promise.all(originalArray.map(async (seg) => {
        try {
          const ctx = `原文：${text}\n已发生：\n当前视角：原文视角\n当前摘要：${seg.summary}\n当前文本：${seg.content}`
          const result = await analyzeText(ctx, apiKey)
          if (!seg.analyses) seg.analyses = {}
          seg.analyses['default'] = result
        } catch {}
      }))
    }
  })()

  const povPool = (async () => {
    if (preGenerateOriginalPovContents && originalArray.length > 0) {
      const perspectives = ['default', ...(selectedChars || [])]
      await Promise.all(originalArray.map(async (seg) => {
        await Promise.all(perspectives.map(async (p) => {
          try {
            const textP = await rewritePerspective(seg.content, seg.summary, p, apiKey)
            if (!seg.povContents) seg.povContents = {}
            seg.povContents[p] = textP
          } catch {}
        }))
      }))
    }
  })()

  await Promise.all([imagePool, analysisPool, povPool])
  const story: Story = {
    id: storyId,
    rootId: rootId,
    nodes: { [rootId]: rootNode },
    characters: selectedChars,
    style: style || '写实风格',
    history: [rootId],
    maxInteractiveTurns: typeof maxInteractiveTurns === 'number' ? maxInteractiveTurns : undefined,
    originalText: text,
    originalSegments: originalArray
  }
  
  saveStory(story)
  return res.json({ storyId })
}
