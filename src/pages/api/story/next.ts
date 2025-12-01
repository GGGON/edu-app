import type { NextApiRequest, NextApiResponse } from 'next'
import { randomUUID } from 'crypto'
import { generateNextNode } from '../../../utils/text'
import { getStory, updateNode, updateNodeImage, StoryNode, Option } from '../../../services/store'
import { seedream } from '../../../services/ai-skills'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { storyId, nodeId, optionIndex, perspective } = req.body || {}
  const apiKey = req.headers['x-ark-api-key'] as string || undefined;

  const story = getStory(String(storyId || ''))
  if (!story) return res.status(404).json({ error: 'not_found' })

  const currentNode = story.nodes[nodeId]
  if (!currentNode) return res.status(404).json({ error: 'node_not_found' })

  let selectedOption = currentNode.options[optionIndex]
  if (!selectedOption) {
    const fallback: Option = { text: '继续' }
    currentNode.options = Array.isArray(currentNode.options) ? currentNode.options : []
    currentNode.options.push(fallback)
    selectedOption = fallback
  }

  // Check if next node already exists
  if (selectedOption.nextNodeId && story.nodes[selectedOption.nextNodeId]) {
    const nextNode = story.nodes[selectedOption.nextNodeId]
    // If image for this perspective missing, generate it
    const p = perspective || 'default'
    if (!nextNode.images[p]) {
      const prompt = `${story.style}，${nextNode.summary}，${p === 'default' ? '第一人称' : p + '视角'}，高清`
      try {
        const r = await seedream.textToImage({ prompt, size: '1920x1080', watermark: false, response_format: 'url', n: 1, apiKey })
        if (r.urls[0]) {
            updateNodeImage(storyId, nextNode.id, p, r.urls[0])
            nextNode.images[p] = r.urls[0]
        }
      } catch {}
    }
    // Update history
    if (!story.history.includes(nextNode.id)) {
       // Logic for history is tricky if we jump around. For now, just append if not last.
       // Actually, if user clicks back, history pops. If user proceeds, history pushes.
       // Here we just return the node, UI handles history display? 
       // Let's append to story history for persistence
       story.history.push(nextNode.id)
    }
    return res.json({ nextNode })
  }

  const context = `原文：${story.originalText || ''}\n已发生：${story.history.map(id => (story.nodes[id] && story.nodes[id].title) || '').filter(Boolean).join(' -> ')}\n当前情节：${currentNode.content}`
  const nextData = await generateNextNode(context, selectedOption.text, story.history, apiKey, story.history.length, story.maxInteractiveTurns)
  
  const newNodeId = randomUUID()
  const newNode: StoryNode = {
    id: newNodeId,
    title: nextData.title,
    summary: nextData.summary,
    content: nextData.content,
    options: nextData.options.map(t => ({ text: t })),
    images: {},
    isEnding: nextData.isEnding
  }

  // Generate Image
  const p = perspective || 'default'
  const prompt = `${story.style}，${newNode.summary}，${p === 'default' ? '第一人称' : p + '视角'}，高清`
  try {
    const r = await seedream.textToImage({ prompt, size: '1920x1080', watermark: false, response_format: 'url', n: 1, apiKey })
    if (r.urls[0]) {
        newNode.images[p] = r.urls[0]
    }
  } catch {}

  // Link and Save
  selectedOption.nextNodeId = newNodeId
  updateNode(storyId, currentNode) // save link
  updateNode(storyId, newNode) // save new node
  story.history.push(newNodeId)

  return res.json({ nextNode: newNode })
}
