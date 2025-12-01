import type { NextApiRequest, NextApiResponse } from 'next'
import { getStory } from '../../../services/store'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { id, index } = req.body || {}
  const story = getStory(String(id || ''))
  if (!story) return res.status(404).json({ error: 'not_found' })
  const len = story.originalSegments ? story.originalSegments.length : 0
  const nextIndex = Math.min(Number(index || 0) + 1, Math.max(0, len - 1))
  return res.json({ story, nextIndex })
}
