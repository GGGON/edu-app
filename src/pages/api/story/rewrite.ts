import type { NextApiRequest, NextApiResponse } from 'next'
import { getStory, updateNodePovContent } from '../../../services/store'
import { rewritePerspective } from '../../../utils/text'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { storyId, nodeId, perspective } = req.body || {}
  const apiKey = req.headers['x-ark-api-key'] as string || undefined

  const story = getStory(String(storyId || ''))
  if (!story) return res.status(404).json({ error: 'not_found' })
  const node = story.nodes[String(nodeId || '')]
  if (!node) return res.status(404).json({ error: 'node_not_found' })
  const p = String(perspective || 'default')

  if (node.povContents && node.povContents[p]) {
    return res.json({ content: node.povContents[p] })
  }

  try {
    const text = await rewritePerspective(node.content, node.summary, p, apiKey)
    updateNodePovContent(String(storyId), node.id, p, text)
    return res.json({ content: text })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
