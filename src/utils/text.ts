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
    ? `请务必提取或生成 ${targetCharacterCount} 个主要或次要角色（如果文中角色不足，请将重要道具或环境拟人化，或根据上下文推断隐含角色，确保数量刚好为 ${targetCharacterCount} 个）。` 
    : '提取主要角色。';

  const systemPrompt = `你是一个互动故事设计师。你的任务是分析用户提供的文本，${countInstruction}并生成故事的开篇场景。
  
  请严格按照以下JSON格式输出（不要包含任何Markdown代码块标记，只输出纯JSON字符串）：
  {
    "title": "开篇标题",
    "summary": "用于生成图片的简短场景描述（包含环境、人物动作、氛围，100字以内）",
    "content": "详细的开篇叙述文本（300字左右，**必须以文中第一位主要人物的视角（第一人称或第三人称深层视角）进行重写**，禁止直接复制原文(除非视角与原文叙述一致)，禁止使用上帝视角或平铺直叙）",
    "characters": ["角色A", "角色B", "角色C"],
    "options": ["选项1：具体描述行动...", "选项2：具体描述选择...", "选项3..."]
  }
  
  重要要求：
  1. **角色列表**：必须是一个字符串数组，包含正好 ${targetCharacterCount || '若干'} 个角色名字。
  2. **视角要求**：'content' 字段必须是改写后的内容，体现第一位角色的主观视角。
  3. **选项**：必须具体、明确，引导剧情。`;

  const userPrompt = `文本内容：\n${input.slice(0, 15000)}`;

  try {
    const resp = await seed.textToText({ 
      input: userPrompt, 
      system: systemPrompt,
      temperature: 0.5, 
      max_tokens: 32000, 
      apiKey 
    })
    const raw = resp.text || ''
    const obj = extractJson(raw)
    
    // Validation: Ensure characters match the target count if possible
    let chars = Array.isArray(obj.characters) ? obj.characters : []
    if (chars.length === 0) chars = ['主角']
    
    // If we have fewer chars than requested, try to pad them (though AI should have handled it)
    // We won't pad artificially here to avoid bad UX, but we rely on the prompt.
    
    return {
      title: obj.title || '故事开始',
      summary: obj.summary || input.slice(0, 100),
      content: obj.content || input.slice(0, 300), // Fallback only if empty
      characters: chars,
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

  const systemPrompt = `你是一个专业的互动小说家。请基于用户提供的故事上下文和选择，创作下一个精彩的情节节点。

    **核心原则**：
    1. **推进剧情**：必须根据用户的选择，让故事时间向前流动，发生**新的**事件、对话或冲突。**严禁重复、总结或仅仅换说法重述上一段剧情**。
    2. **因果逻辑**：新情节必须是用户选择的直接后果。
    3. **沉浸体验**：描写必须具体、生动，有画面感。
    
    请输出严格的JSON格式（不要包含Markdown代码块标记，只输出纯JSON字符串）：
    {
      "title": "新情节标题（简练）",
      "summary": "画面描述（用于生成配图，需包含环境、人物、光影，100字以内）",
      "content": "详细剧情文本（300-500字，**必须是新发生的事件**，禁止复述前文。必须以主要人物的视角（第一人称或第三人称深层视角）进行叙述，禁止使用上帝视角）",
      "options": ["选项1（具体的下一步行动）", "选项2（具体的下一步行动）"],
      "isEnding": boolean
    }
    
    注意：
    - 如果是结局（isEnding=true），options 数组应为空 []。
    - 内容必须充实，推动故事发展。
    - 选项必须具体，引导后续不同的分支。
    - **视角要求：严格限制在主要人物的感知范围内。**`;

  const userPrompt = `
    ${originalText ? `参考原文（仅供参考风格和大致走向，不要直接照搬，需根据互动分支进行创作）：\n${originalText.slice(0, 3000)}...\n` : ''}
    
    已发生的情节（上下文）：
    ${context}
    
    用户刚才的选择：
    ${choice}
    
    ${isApproachingEnd ? '注意：故事即将结束，请开始收束剧情，为结局做铺垫。' : ''}
    ${mustEnd ? '注意：这是故事的最后一个环节，必须生成结局 (isEnding: true)。' : ''}`;

  let lastError: any;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await seed.textToText({ 
        input: userPrompt, 
        system: systemPrompt,
        temperature: attempt === 0 ? 0.7 : 0.8, // Slightly higher temp for better creativity
        max_tokens: 32000, 
        apiKey 
      })
      const raw = resp.text || ''
      let obj: any = {}
      try {
        obj = extractJson(raw)
      } catch {
        // If JSON parsing fails, but raw text exists, try to use it
        if (raw.length > 10) {
          console.warn(`Attempt ${attempt + 1}: JSON parse failed, trying to recover from raw text`)
          obj = {
            title: '新剧情',
            summary: raw.slice(0, 80),
            content: raw,
            options: ['继续'],
            isEnding: false
          }
        } else {
            throw new Error('Empty or invalid response')
        }
      }
      
      // Fallback for content fields
      let content = obj.content || obj.text || obj.narrative || obj.story || ''
      
      // If JSON parsed but content is empty, and raw is different/longer, might be parsing error or bad output
      if (!content && raw.length > 50) {
          // Fallback to raw if extracted content is empty but raw is long
          content = raw
      }

      if (!content || content.length < 10) {
        throw new Error('Content too short or empty')
      }

      return {
        title: obj.title || '新情节',
        summary: obj.summary || (content ? content.slice(0, 80) : '剧情继续...'),
        content: content, 
        options: Array.isArray(obj.options) && obj.options.length > 0 ? obj.options : (mustEnd ? [] : ['继续']),
        isEnding: !!obj.isEnding
      }
    } catch (e) {
      console.error(`Generate next node attempt ${attempt + 1} failed:`, e)
      lastError = e
      // If it's the last attempt, fall through to the final error handler
    }
  }

  // Final fallback if all retries fail
  return {
    title: '未知情节',
    summary: '迷雾重重...',
    content: '由于某种原因，前方看不真切... (生成失败，请重试)',
    options: ['重试'],
    isEnding: false
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
  const prompt = `请将以下文本严格按${pov}进行**深度改写**，在保持原有情节逻辑不变的前提下，焕然一新。
  注意：**必须完全沉浸在${perspective}的视角中，通过其感官细节和心理活动重构叙事，禁止出现“原文视角”或“上帝视角”的旁白感。**
  
  要求：
  - 差异化：**必须与原文有显著的文字差异**，使用符合该角色身份的口吻、心理描写和观察角度。
  - 逻辑一致：不改变事件核心进程。
  - 信息边界：**严格限制在${perspective}的感官范围内**，只描写其所见、所闻、所感；他人内心必须改为通过行为细节推断，绝不可直接描写。
  - 代词与称呼：严格符合该视角（如第一人称用“我”）。
  - 细节体现：**强化该视角的心理活动与主观感受**。
  - 篇幅：300-400字，语言自然流畅。

  角色：${perspective}
  摘要：${summary}
  原文：${content}

  输出严格JSON：{"content":"改写后的文本"}`
  try {
    const resp = await seed.textToText({ input: prompt, temperature: 0.7, max_tokens: 32000, apiKey })
    const raw = resp.text || ''
    const obj = extractJson(raw) as { content?: unknown }
    return String(obj.content ?? content)
  } catch {
    return content
  }
}
