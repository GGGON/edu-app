import fs from 'fs'
import path from 'path'

export type Option = { 
  text: string;
  nextNodeId?: string; // ID of the node this option leads to (if already generated)
}

export type StoryNode = {
  id: string;
  title: string;
  content: string; // Detailed narrative text
  summary: string; // Short summary for prompt generation
  options: Option[];
  images: Record<string, string>; // Map perspective (e.g. "default", "hero") to image URL
  isEnding?: boolean;
  analyses?: Record<string, { knowledge: { point: string; quote?: string; explanation: string }[]; questions: { question: string; depth: string; answer: string }[] }>; // Cached analysis by perspective
  povContents?: Record<string, string>; // Narrative rewritten by perspective
}

export type Story = {
  id: string;
  rootId: string;
  nodes: Record<string, StoryNode>; // All nodes indexed by ID
  characters: string[]; // Detected characters
  style: string; // Visual style
  history: string[]; // IDs of visited nodes in order (for current session/path)
  maxInteractiveTurns?: number; // Maximum number of interactive turns before forcing an ending
  originalText?: string;
  originalSegments?: StoryNode[];
}

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'stories.json')

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
} catch (e) {
  console.error('Failed to create data dir', e)
}

function getAllStories(): Record<string, Story> {
  try {
    if (!fs.existsSync(DATA_FILE)) return {}
    const content = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(content) || {}
  } catch (e) {
    console.error('Failed to read stories', e)
    return {}
  }
}

function saveAllStories(data: Record<string, Story>) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Failed to save stories', e)
  }
}

export function saveStory(story: Story) {
  const data = getAllStories()
  data[story.id] = story
  saveAllStories(data)
}

export function getStory(id: string) {
  const data = getAllStories()
  return data[id] || null
}

export function updateNode(storyId: string, node: StoryNode) {
  const data = getAllStories()
  const s = data[storyId]
  if (!s) return
  s.nodes[node.id] = node
  saveAllStories(data)
}

export function updateNodeImage(storyId: string, nodeId: string, perspective: string, url: string) {
  const data = getAllStories()
  const s = data[storyId]
  if (!s) return
  const node = s.nodes[nodeId]
  if (!node) return
  if (!node.images) node.images = {}
  node.images[perspective] = url
  saveAllStories(data)
}

export function updateOriginalSegmentImage(storyId: string, index: number, perspective: string, url: string) {
  const data = getAllStories()
  const s = data[storyId]
  if (!s || !s.originalSegments) return
  const seg = s.originalSegments[index]
  if (!seg) return
  if (!seg.images) seg.images = {}
  seg.images[perspective] = url
  saveAllStories(data)
}

export function updateNodeAnalysis(
  storyId: string,
  nodeId: string,
  perspective: string,
  analysis: { knowledge: { point: string; quote?: string; explanation: string }[]; questions: { question: string; depth: string; answer: string }[] }
) {
  const data = getAllStories()
  const s = data[storyId]
  if (!s) return
  const node = s.nodes[nodeId]
  if (!node) return
  if (!node.analyses) node.analyses = {}
  node.analyses[perspective] = analysis
  saveAllStories(data)
}

export function updateOriginalSegmentAnalysis(
  storyId: string,
  index: number,
  perspective: string,
  analysis: { knowledge: { point: string; quote?: string; explanation: string }[]; questions: { question: string; depth: string; answer: string }[] }
) {
  const data = getAllStories()
  const s = data[storyId]
  if (!s || !s.originalSegments) return
  const seg = s.originalSegments[index]
  if (!seg) return
  if (!seg.analyses) seg.analyses = {}
  seg.analyses[perspective] = analysis
  saveAllStories(data)
}

export function updateNodePovContent(storyId: string, nodeId: string, perspective: string, text: string) {
  const data = getAllStories()
  const s = data[storyId]
  if (!s) return
  const node = s.nodes[nodeId]
  if (!node) return
  if (!node.povContents) node.povContents = {}
  node.povContents[perspective] = text
  saveAllStories(data)
}

export function updateOriginalSegmentPovContent(storyId: string, index: number, perspective: string, text: string) {
  const data = getAllStories()
  const s = data[storyId]
  if (!s || !s.originalSegments) return
  const seg = s.originalSegments[index]
  if (!seg) return
  if (!seg.povContents) seg.povContents = {}
  seg.povContents[perspective] = text
  saveAllStories(data)
}
