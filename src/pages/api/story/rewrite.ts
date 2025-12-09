import type { NextApiRequest, NextApiResponse } from 'next'
import { Story } from '../../../services/store'
import { rewritePerspective } from '../../../utils/text'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { story, nodeId, perspective } = req.body || {}
  const apiKey = req.headers['x-ark-api-key'] as string || undefined

  const storyObj = story as Story
  if (!storyObj) return res.status(404).json({ error: 'not_found' })
  const node = storyObj.nodes[String(nodeId || '')]
  if (!node) return res.status(404).json({ error: 'node_not_found' })
  const p = String(perspective || 'default')

  if (node.povContents && node.povContents[p]) {
    const opts = node.povOptions && node.povOptions[p] ? node.povOptions[p].map(o => o.text) : undefined
    return res.json({ content: node.povContents[p], options: opts })
  }

  try {
    const originalOptions = node.options ? node.options.map(o => o.text) : []
    const result = await rewritePerspective(node.content, node.summary, p, apiKey, originalOptions)
    return res.json({ content: result.content, options: result.options })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
