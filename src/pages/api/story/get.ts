import type { NextApiRequest, NextApiResponse } from 'next'
import { getStory } from '../../../services/store'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || '')
  const story = getStory(id)
  if (!story) return res.status(404).json(null)
  return res.json(story)
}
