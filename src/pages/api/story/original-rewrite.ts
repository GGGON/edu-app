import type { NextApiRequest, NextApiResponse } from 'next'
import { getStory, updateOriginalSegmentPovContent } from '../../../services/store'
import { rewritePerspective } from '../../../utils/text'

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

  if (seg.povContents && seg.povContents[p]) {
    return res.json({ content: seg.povContents[p] })
  }

  try {
    const text = await rewritePerspective(seg.content, seg.summary, p, apiKey)
    updateOriginalSegmentPovContent(String(storyId), i, p, text)
    return res.json({ content: text })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
