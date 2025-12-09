import type { NextApiRequest, NextApiResponse } from 'next'
import { Story } from '../../../services/store'
import { seedream } from '../../../services/ai-skills'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { story, nodeId, perspective } = req.body || {}
  const apiKey = req.headers['x-ark-api-key'] as string || undefined;

  const storyObj = story as Story
  if (!storyObj) return res.status(404).json({ error: 'not_found' })

  const node = storyObj.nodes[nodeId]
  if (!node) return res.status(404).json({ error: 'node_not_found' })

  if (node.images[perspective]) {
    return res.json({ url: node.images[perspective] })
  }

  // Generate
  const prompt = `${storyObj.style}，${node.summary}，${perspective}视角，高清`
  try {
    const r = await seedream.textToImage({ prompt, size: '2560x1440', watermark: false, response_format: 'url', n: 1, apiKey })
    const url = r.urls[0]
    if (url) {
      return res.json({ url })
    }
    return res.status(500).json({ error: 'gen_failed' })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
