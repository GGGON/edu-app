import { seed } from '../services/ai-skills'

export type InitResult = {
  title: string;
  summary: string;
  content: string;
  characters: string[];
  options: string[];
}

export async function parseTextToInit(input: string, apiKey?: string): Promise<InitResult> {
  const prompt = `你是一个互动故事设计师。请分析这段文本，提取主要角色，并生成故事的开篇场景。
  
  输出严格的JSON格式：
  {
    "title": "开篇标题",
    "summary": "用于生成图片的简短场景描述（包含环境、人物动作、氛围，100字以内）",
    "content": "详细的开篇叙述文本（300字左右）",
    "characters": ["主角名", "配角1", "配角2"],
    "options": ["选项1：导致...", "选项2：...", "选项3：..."]
  }
  
  文本内容：${input}`

  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.4, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    const obj = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    return {
      title: obj.title || '故事开始',
      summary: obj.summary || input.slice(0, 100),
      content: obj.content || input.slice(0, 300),
      characters: Array.isArray(obj.characters) ? obj.characters : ['主角'],
      options: Array.isArray(obj.options) ? obj.options : ['继续探索']
    }
  } catch (e) {
    console.error('Parse init failed', e)
    return {
      title: '故事开始',
      summary: input.slice(0, 100),
      content: input.slice(0, 300),
      characters: ['主角'],
      options: ['继续']
    }
  }
}

export type NextNodeResult = {
  title: string;
  summary: string;
  content: string;
  options: string[];
  isEnding: boolean;
}

export async function generateNextNode(
  context: string, 
  choice: string, 
  history: string[], 
  apiKey?: string,
  currentTurn?: number,
  maxTurns?: number
): Promise<NextNodeResult> {
  const isApproachingEnd = typeof currentTurn === 'number' && typeof maxTurns === 'number' && maxTurns > 0 && currentTurn >= maxTurns - 1;
  const mustEnd = typeof currentTurn === 'number' && typeof maxTurns === 'number' && maxTurns > 0 && currentTurn >= maxTurns;

  const prompt = `基于当前故事上下文和用户的选择，生成下一个情节节点。
  
  上下文概要：${context}
  用户选择：${choice}
  ${isApproachingEnd ? '注意：故事即将结束，请开始收束剧情，为结局做铺垫。' : ''}
  ${mustEnd ? '注意：这是故事的最后一个环节，必须生成结局。' : ''}
  
  请输出严格的JSON格式：
  {
    "title": "节点标题",
    "summary": "用于生成图片的简短场景描述",
    "content": "详细的叙述文本（300字左右）",
    "options": ["后续选项1", "后续选项2"] (如果是结局，留空数组),
    "isEnding": boolean (${mustEnd ? '必须为 true' : '是否是结局'})
  }`

  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.7, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    const obj = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    return {
      title: obj.title || '新情节',
      summary: obj.summary || '剧情继续...',
      content: obj.content || '...',
      options: Array.isArray(obj.options) ? obj.options : [],
      isEnding: !!obj.isEnding
    }
  } catch {
    return {
      title: '未知情节',
      summary: '迷雾重重...',
      content: '由于某种原因，前方看不真切...',
      options: ['尝试回头', '继续前进'],
      isEnding: false
    }
  }
}

export type AnalysisResult = {
  knowledge: { point: string; quote?: string; explanation: string }[];
  questions: { question: string; depth: string; answer: string }[];
}

export async function analyzeText(input: string, apiKey?: string): Promise<AnalysisResult> {
  const prompt = `请从语文学习角度分析以下文本，并提出具有思想深度的开放性问题。\n\n输出严格的JSON：\n{\n  "knowledge": [{"point": "知识点", "quote": "文本片段", "explanation": "解析"}],\n  "questions": [{"question": "问题", "depth": "基础/拓展/思辨", "answer": "参考回答"}]\n}\n\n分析维度包含但不限于：修辞手法、意象与象征、叙事视角与结构、语言风格、情感与主题、文化典故。\n请给出3-6条知识点与3-5个问题，每个参考回答100-200字。\n\n文本：${input}`
  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.3, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    const s = raw.indexOf('{')
    const e = raw.lastIndexOf('}')
    const obj = JSON.parse(raw.slice(s, e + 1))
    const knowledge = Array.isArray(obj.knowledge) ? obj.knowledge.map((k: unknown) => {
      const kk = k as { point?: unknown; quote?: unknown; explanation?: unknown }
      return {
        point: String(kk.point ?? ''),
        quote: kk.quote !== undefined ? String(kk.quote) : undefined,
        explanation: String(kk.explanation ?? '')
      }
    }) : []
    const questions = Array.isArray(obj.questions) ? obj.questions.map((q: unknown) => {
      const qq = q as { question?: unknown; depth?: unknown; answer?: unknown }
      return {
        question: String(qq.question ?? ''),
        depth: String(qq.depth ?? '思辨'),
        answer: String(qq.answer ?? '')
      }
    }) : []
    return { knowledge, questions }
  } catch {
    return { knowledge: [], questions: [] }
  }
}

export type SegmentResult = {
  title: string;
  summary: string;
  content: string;
}

export async function splitOriginalToSegments(input: string, count?: number, apiKey?: string): Promise<SegmentResult[]> {
  const n = typeof count === 'number' && count > 0 ? count : undefined
  const prompt = `请将以下原文分解为${n ? String(n) + '个' : '6-12个'}连续场景片段，并给出每段的标题、用于图像生成的摘要、与对应的完整叙述文本。\n\n输出严格的JSON数组：\n[{"title":"","summary":"","content":""}]\n\n文本：${input}`
  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.2, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    const s = raw.indexOf('[')
    const e = raw.lastIndexOf(']')
    const arr = JSON.parse(raw.slice(s, e + 1))
    if (Array.isArray(arr)) {
      return arr.map((x: unknown) => {
        const xx = x as { title?: unknown; summary?: unknown; content?: unknown }
        return {
          title: String(xx.title ?? '片段'),
          summary: String(xx.summary ?? ''),
          content: String(xx.content ?? '')
        }
      })
    }
    return []
  } catch {
    return []
  }
}

export async function rewritePerspective(content: string, summary: string, perspective: string, apiKey?: string): Promise<string> {
  if (perspective === 'default') return content
  const pov = perspective === 'default' ? '原文视角' : `${perspective}视角`
  const prompt = `请将以下文本严格按${pov}改写，并保持原文故事逻辑。要求：\n- 逻辑一致：不改变事件顺序、因果关系与角色动机，不添加新设定。\n- 信息边界：只使用该视角能观察/知晓的信息；他人内心改为通过行为细节推断。\n- 代词与称呼：严格符合该视角（如第一人称用“我”，角色视角用其自称/对他人称呼）。\n- 细节体现：从该视角的观察与感受展开，避免全知叙述。\n- 篇幅：300-400字，语言自然流畅。\n\n角色：${perspective}\n摘要：${summary}\n原文：${content}\n\n输出严格JSON：{"content":"改写后的文本"}`
  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.5, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    const s = raw.indexOf('{')
    const e = raw.lastIndexOf('}')
    const obj = JSON.parse(raw.slice(s, e + 1)) as { content?: unknown }
    return String(obj.content ?? content)
  } catch {
    return content
  }
}
