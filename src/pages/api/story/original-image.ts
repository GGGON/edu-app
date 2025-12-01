import type { NextApiRequest, NextApiResponse } from 'next'
import { getStory, updateOriginalSegmentImage } from '../../../services/store'
import { seedream } from '../../../services/ai-skills'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { storyId, index, perspective } = req.body || {}
  const apiKey = req.headers['x-ark-api-key'] as string || undefined

  const story = getStory(String(storyId || ''))
  if (!story) return res.status(404).json({ error: 'not_found' })
  const i = Number(index || 0)
  const seg = story.originalSegments && story.originalSegments[i]
  if (!seg) return res.status(404).json({ error: 'segment_not_found' })

  const p = String(perspective || 'default')
  if (seg.images && seg.images[p]) return res.json({ url: seg.images[p] })

  const prompt = `${story.style}，${seg.summary}，${p === 'default' ? '原文视角' : p + '视角'}，高清`
  try {
    const r = await seedream.textToImage({ prompt, size: '1920x1080', watermark: false, response_format: 'url', n: 1, apiKey })
    const url = r.urls[0]
    if (url) {
      updateOriginalSegmentImage(String(storyId), i, p, url)
      return res.json({ url })
    }
    return res.status(500).json({ error: 'gen_failed' })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
