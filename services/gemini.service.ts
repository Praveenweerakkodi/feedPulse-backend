import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiAnalysisResult {
  category: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  priority_score: number;   
  summary: string;        
  tags: string[];
}

// Initialize Gemini Client
let genAI: GoogleGenerativeAI | null = null;

const getGeminiClient = (): GoogleGenerativeAI => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

const buildPrompt = (title: string, description: string): string => {
  return `You are a product manager's AI assistant analysing user feedback for a software product.

Analyse the following feedback and return ONLY a valid JSON object — no markdown, no explanation, just raw JSON.

Feedback Title: "${title}"
Feedback Description: "${description}"

Instructions:
- category: Classify as exactly one of: "Bug", "Feature Request", "Improvement", "Other"
- sentiment: Classify the emotional tone as "Positive", "Neutral", or "Negative"
- priority_score: Rate urgency from 1 (low priority, nice-to-have) to 10 (critical, must fix now)
  - Give score 8-10 if feedback mentions words like: crash, broken, payment, lost data, security, urgent, can't login, not working
  - Give score 5-7 for important but non-critical feedback
  - Give score 1-4 for suggestions, cosmetic issues, or minor improvements
- summary: Write ONE clear sentence explaining what the user wants or what the problem is
- tags: Return 2-5 short keyword tags that describe the topic (e.g. ["Performance", "Dashboard", "UI"])

Return this exact JSON structure:
{
  "category": "Bug" | "Feature Request" | "Improvement" | "Other",
  "sentiment": "Positive" | "Neutral" | "Negative",
  "priority_score": <number 1-10>,
  "summary": "<one sentence summary>",
  "tags": ["tag1", "tag2"]
}`;
};

const parseGeminiResponse = (text: string): GeminiAnalysisResult => {
  // Remove markdown code blocks if present (```json ... ```)
  const cleaned = text
    .replace(/```json\n?/gi, '') 
    .replace(/```\n?/g, '')      
    .trim();

  const parsed = JSON.parse(cleaned);


  if (
    typeof parsed.category !== 'string' ||
    typeof parsed.sentiment !== 'string' ||
    typeof parsed.priority_score !== 'number' ||
    typeof parsed.summary !== 'string' ||
    !Array.isArray(parsed.tags)
  ) {
    throw new Error('Gemini response is missing required fields');
  }

  // Clamp priority score to 1-10 range just in case Gemini goes out of bounds
  parsed.priority_score = Math.min(10, Math.max(1, Math.round(parsed.priority_score)));

  return parsed as GeminiAnalysisResult;
};


export const analyseFeedback = async (
  title: string,
  description: string
): Promise<GeminiAnalysisResult> => {
  const maxRetries = 3;
  const retryDelayMs = 1000; 

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = getGeminiClient();

      const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = buildPrompt(title, description);

      console.log(`🤖 Calling Gemini API (attempt ${attempt}/${maxRetries})...`);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse and validate the JSON response
      const analysis = parseGeminiResponse(text);

      console.log(`✅ Gemini analysis complete: sentiment=${analysis.sentiment}, priority=${analysis.priority_score}`);

      return analysis;

    } catch (error) {
      console.error(`❌ Gemini attempt ${attempt} failed:`, error instanceof Error ? error.message : error);

      if (attempt === maxRetries) {
        throw new Error(`Gemini API failed after ${maxRetries} attempts`);
      }

      await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
    }
  }

  throw new Error('Unexpected: all retries exhausted');
};

export const generateWeeklySummary = async (
  feedbackItems: Array<{ title: string; ai_summary?: string; ai_tags?: string[]; ai_priority?: number }>
): Promise<string> => {
  if (feedbackItems.length === 0) {
    return 'No feedback received in the last 7 days.';
  }

  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Build a summary of recent feedback for Gemini to analyse
    const feedbackList = feedbackItems
      .slice(0, 20) // Limit to 20 items to stay within token limits
      .map((f, i) => `${i + 1}. [Priority: ${f.ai_priority || 'N/A'}] ${f.title}: ${f.ai_summary || 'No summary'}`)
      .join('\n');

    const prompt = `You are a product manager reviewing recent user feedback.

Here are the top feedback items from the last 7 days:
${feedbackList}

Write a SHORT strategic summary (3-5 sentences max) that answers:
1. What are the top 3 most common themes?
2. What should the product team focus on building or fixing next?
3. What is the overall user sentiment?

Be direct and actionable. Write for a product manager, not a developer.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();

  } catch (error) {
    console.error('Failed to generate weekly summary:', error);
    return 'Unable to generate summary at this time. Please try again later.';
  }
};
