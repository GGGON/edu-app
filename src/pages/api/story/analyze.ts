import type { NextApiRequest, NextApiResponse } from 'next'
import { getStory, updateNodeAnalysis, updateOriginalSegmentAnalysis } from '../../../services/store'
import { analyzeText } from '../../../utils/text'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { storyId, nodeId, perspective, originalIndex } = req.body || {}
  const apiKey = req.headers['x-ark-api-key'] as string || undefined

  const story = getStory(String(storyId || ''))
  if (!story) return res.status(404).json({ error: 'not_found' })
  const useOriginal = typeof originalIndex !== 'undefined' && story.originalSegments && story.originalSegments[Number(originalIndex)]
  const node = useOriginal ? story.originalSegments![Number(originalIndex)] : story.nodes[String(nodeId || '')]
  if (!node) return res.status(404).json({ error: 'node_not_found' })
  const p = String(perspective || 'default')
  if (node.analyses && node.analyses[p]) {
    return res.json(node.analyses[p])
  }

  const historyTitles = (story.history || []).map(id => (story.nodes[id] && story.nodes[id].title) || '').filter(Boolean).join(' -> ')
  const pName = p === 'default' ? '原文视角' : p
  const ctx = `原文：${story.originalText || ''}\n已发生：${useOriginal ? '' : historyTitles}\n当前视角：${pName}\n当前摘要：${node.summary}\n当前文本：${node.content}`
  try {
    const result = await analyzeText(ctx, apiKey)
    try {
      if (useOriginal) {
        updateOriginalSegmentAnalysis(String(storyId), Number(originalIndex), p, result)
      } else {
        updateNodeAnalysis(String(storyId), String(node.id), p, result)
      }
    } catch {}
    return res.json(result)
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
