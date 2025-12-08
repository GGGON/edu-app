import { seed } from '../services/ai-skills'

function extractJson(str: string): any {
  let cleaned = str.replace(/```json\n?/g, '').replace(/```/g, '').trim();
  
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch {}

  // Try to find object
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s >= 0 && e > s) {
     try { return JSON.parse(cleaned.slice(s, e + 1)); } catch {}
  }
  
  // Try to find array
  const sa = cleaned.indexOf('[');
  const ea = cleaned.lastIndexOf(']');
  if (sa >= 0 && ea > sa) {
     try { return JSON.parse(cleaned.slice(sa, ea + 1)); } catch {}
  }

  throw new Error('No valid JSON found');
}

export type InitResult = {
  title: string;
  summary: string;
  content: string;
  characters: string[];
  options: string[];
}

export async function parseTextToInit(input: string, apiKey?: string, targetCharacterCount?: number): Promise<InitResult> {
  const countInstruction = targetCharacterCount && targetCharacterCount > 0 
    ? `请尝试提取 ${targetCharacterCount} 个主要或次要角色（如果原文内容支持）。` 
    : '提取主要角色。';

  const prompt = `你是一个互动故事设计师。请分析这段文本，${countInstruction}并生成故事的开篇场景。
  
  输出严格的JSON格式：
  {
    "title": "开篇标题",
    "summary": "用于生成图片的简短场景描述（包含环境、人物动作、氛围，100字以内）",
    "content": "详细的开篇叙述文本（300字左右，**必须以文中主要人物的视角（第一人称或第三人称深层视角）进行叙述，禁止使用上帝视角或原文视角的平铺直叙**）",
    "characters": ["主角名", "配角1", "配角2"],
    "options": ["选项1：具体描述下一步行动（如：走向...", "选项2：具体描述另一种选择（如：询问...", "选项3：具体描述第三种选择"]
  }
  
  注意：
  1. 选项必须具体、明确，包含动作或对话，避免模糊的“继续”、“下一步”。
  2. 选项应引导不同的剧情走向。
  3. **视角要求：严格限制在主要人物的感知范围内，描写其所见、所闻、所感。**
  
  文本内容：${input}`

  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.4, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    const obj = extractJson(raw)
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
  maxTurns?: number,
  originalText?: string
): Promise<NextNodeResult> {
  const isApproachingEnd = typeof currentTurn === 'number' && typeof maxTurns === 'number' && maxTurns > 0 && currentTurn >= maxTurns - 1;
  const mustEnd = typeof currentTurn === 'number' && typeof maxTurns === 'number' && maxTurns > 0 && currentTurn >= maxTurns;

  const prompt = `你是一个专业的互动小说家。请基于当前故事上下文、用户选择以及参考原文（如果有），创作下一个精彩的情节节点。
  
  ${originalText ? `参考原文（仅供参考风格和走向）：\n${originalText.slice(0, 3000)}...\n` : ''}
  上下文概要：${context}
  用户选择：${choice}
  ${isApproachingEnd ? '注意：故事即将结束，请开始收束剧情，为结局做铺垫。' : ''}
  ${mustEnd ? '注意：这是故事的最后一个环节，必须生成结局。' : ''}
  
  请输出严格的JSON格式（不要包含Markdown代码块标记）：
  {
    "title": "新情节标题（必填）",
    "summary": "画面描述（必填，用于生成配图，需包含环境、人物、光影，100字以内）",
    "content": "详细剧情文本（必填，300-500字，描写细腻，推动剧情，**必须以文中主要人物的视角（第一人称或第三人称深层视角）进行叙述，禁止使用上帝视角或原文视角的平铺直叙**）",
    "options": ["选项1（具体行动）", "选项2（具体行动）"] (如果是结局，留空数组),
    "isEnding": boolean (${mustEnd ? '必须为 true' : '是否是结局'})
  }
  
  注意：
  1. 内容必须充实，禁止返回空字符串。
  2. 选项必须具体描述角色的下一步行动或对话，禁止使用“继续”、“下一步”等模糊词汇。
  3. **视角要求：严格限制在主要人物的感知范围内，描写其所见、所闻、所感。**`

  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.7, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    let obj: any = {}
    try {
      obj = extractJson(raw)
    } catch {
      // If JSON parsing fails, but raw text is long, use raw text as content
      if (raw.length > 50) {
        obj = {
          title: '新剧情',
          summary: raw.slice(0, 80),
          content: raw,
          options: ['继续'],
          isEnding: false
        }
      }
    }
    
    // Fallback for content fields
    let content = obj.content || obj.text || obj.narrative || obj.story || ''
    
    // If JSON parsed but content is empty, and raw is different/longer, might be parsing error or bad output
    if (!content && raw.length > 100) {
        console.warn('AI returned JSON without content but raw text exists. Using raw.')
        // If raw contains JSON-like structure but we failed to extract content, fallback to raw
        // But if raw IS the JSON string that has empty content, this won't help.
        // Assume if content is empty, the model might have failed.
    }

    if (!content) {
        console.warn('AI returned JSON without content. Raw:', raw)
    }

    return {
      title: obj.title || '新情节',
      summary: obj.summary || (content ? content.slice(0, 80) : '剧情继续...'),
      content: content || '...', 
      options: Array.isArray(obj.options) && obj.options.length > 0 ? obj.options : (mustEnd ? [] : ['继续']),
      isEnding: !!obj.isEnding
    }
  } catch (e) {
    console.error('Generate next node failed:', e)
    // Try to log the raw response if possible
    // console.error('Raw response:', (await seed.textToText({ input: prompt, temperature: 0.7, max_tokens: 32000, apiKey })).text) // Can't easily re-fetch
    
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
    const obj = extractJson(raw)
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
  const prompt = `请将以下原文分解为${n ? String(n) + '个' : '6-12个'}连续场景片段，并给出每段的标题、用于图像生成的摘要、与对应的完整叙述文本。
  
  注意：
  1. 第一段（开篇）必须严格只包含故事的开篇部分，绝对不要包含后续情节。
  2. 保持原文的连贯性。

  输出严格的JSON数组：
  [{"title":"","summary":"","content":""}]

  文本：${input}`
  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.2, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    const arr = extractJson(raw)
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
  const prompt = `请将以下文本严格按${pov}改写，并保持原文故事逻辑。
  注意：**必须完全沉浸在${perspective}的视角中，禁止出现“原文视角”或“上帝视角”的旁白感。**
  
  要求：
  - 逻辑一致：不改变事件顺序、因果关系与角色动机，不添加新设定。
  - 信息边界：**严格限制在${perspective}的感官范围内**，只描写其所见、所闻、所感；他人内心必须改为通过行为细节推断，绝不可直接描写。
  - 代词与称呼：严格符合该视角（如第一人称用“我”，角色视角用其自称/对他人称呼）。
  - 细节体现：**强化该视角的心理活动与主观感受**，避免客观冷淡的全知叙述。
  - 篇幅：300-400字，语言自然流畅。

  角色：${perspective}
  摘要：${summary}
  原文：${content}

  输出严格JSON：{"content":"改写后的文本"}`
  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.5, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    const obj = extractJson(raw) as { content?: unknown }
    return String(obj.content ?? content)
  } catch {
    return content
  }
}
