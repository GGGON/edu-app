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

// Storage functions removed as we are moving to client-side storage
// and stateless backend.
