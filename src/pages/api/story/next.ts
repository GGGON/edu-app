import type { NextApiRequest, NextApiResponse } from 'next'
import { randomUUID } from 'crypto'
import { generateNextNode } from '../../../utils/text'
import { StoryNode, Option, Story } from '../../../services/store'
import { seedream } from '../../../services/ai-skills'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { story, nodeId, optionIndex, perspective } = req.body || {}
  const apiKey = req.headers['x-ark-api-key'] as string || undefined;

  const storyObj = story as Story
  if (!storyObj) return res.status(404).json({ error: 'not_found' })

  const currentNode = storyObj.nodes[nodeId]
  if (!currentNode) return res.status(404).json({ error: 'node_not_found' })

  let selectedOption = currentNode.options[optionIndex]
  if (!selectedOption) {
    const fallback: Option = { text: '继续' }
    currentNode.options = Array.isArray(currentNode.options) ? currentNode.options : []
    currentNode.options.push(fallback)
    selectedOption = fallback
  }

  // Check if next node already exists
  if (selectedOption.nextNodeId && storyObj.nodes[selectedOption.nextNodeId]) {
    const nextNode = storyObj.nodes[selectedOption.nextNodeId]
    // If image for this perspective missing, generate it
    const p = perspective || 'default'
    if (!nextNode.images[p]) {
      const prompt = `${storyObj.style}，${nextNode.summary}，${p === 'default' ? '原文视角' : p + '视角'}，高清`
      try {
        const r = await seedream.textToImage({ prompt, size: '2560x1440', watermark: false, response_format: 'url', n: 1, apiKey })
        if (r.urls[0]) {
            nextNode.images[p] = r.urls[0]
        }
      } catch {}
    }
    // Update history
    if (!storyObj.history.includes(nextNode.id)) {
       // Logic for history is tricky if we jump around. For now, just append if not last.
       // Actually, if user clicks back, history pops. If user proceeds, history pushes.
       // Here we just return the node, UI handles history display? 
       // Let's append to story history for persistence
       storyObj.history.push(nextNode.id)
    }
    return res.json({ nextNode, updatedCurrentNode: currentNode })
  }

  const context = `已发生：${storyObj.history.map(id => (storyObj.nodes[id] && storyObj.nodes[id].title) || '').filter(Boolean).join(' -> ')}\n当前情节：${currentNode.content}`
  const turnsSoFar = Math.max(0, (storyObj.history?.length || 1) - 1)
  const nextTurnIndex = turnsSoFar + 1
  const maxTurns = typeof storyObj.maxInteractiveTurns === 'number' ? storyObj.maxInteractiveTurns : undefined
  const willForceEnd = typeof maxTurns === 'number' && maxTurns > 0 && nextTurnIndex >= maxTurns
  const nextData = await generateNextNode(context, selectedOption.text, storyObj.history, apiKey, nextTurnIndex, maxTurns, storyObj.originalText)
  
  const newNodeId = randomUUID()
  const newNode: StoryNode = {
    id: newNodeId,
    title: nextData.title,
    summary: nextData.summary,
    content: nextData.content,
    options: willForceEnd ? [] : nextData.options.map(t => ({ text: t })),
    images: {},
    isEnding: willForceEnd ? true : nextData.isEnding
  }

  // Generate Image
  const p = perspective || 'default'
  const prompt = `${storyObj.style}，${newNode.summary}，${p === 'default' ? '原文视角' : p + '视角'}，高清`
  try {
    const r = await seedream.textToImage({ prompt, size: '2560x1440', watermark: false, response_format: 'url', n: 1, apiKey })
    if (r.urls[0]) {
        newNode.images[p] = r.urls[0]
    }
  } catch {}

  // Link and Save
  selectedOption.nextNodeId = newNodeId
  storyObj.history.push(newNodeId)

  return res.json({ nextNode: newNode, updatedCurrentNode: currentNode })
}
