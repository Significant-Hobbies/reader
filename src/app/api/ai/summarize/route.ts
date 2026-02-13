import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getAuthenticatedUserId } from '@/lib/auth-api';
import {
  getDefaultModelForProvider,
  isLocalCLIEnabled,
  isLocalAIProvider,
  normalizeAIProvider,
} from '@/lib/ai-config';
import {
  createLanguageModel,
  normalizeApiKey,
  normalizeText,
  requiresApiKey,
} from '@/lib/ai-server';
import { SummaryLength } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUMMARY_LENGTH_INSTRUCTIONS: Record<SummaryLength, string> = {
  short: 'Provide a brief 2-3 sentence summary.',
  medium: 'Provide a comprehensive 4-6 sentence summary.',
  long: 'Provide a detailed 8-10 sentence summary covering all major points.',
};

const SUMMARY_SYSTEM_PROMPT = `You are an expert at analyzing and summarizing articles. Your task is to:
1. Create a clear, concise summary that captures the main ideas and key insights
2. Extract 3-5 key points as bullet points that represent the most important takeaways
3. Maintain objectivity and accuracy

Format your response as JSON with this structure:
{
  "summary": "The summary text here...",
  "keyPoints": ["First key point", "Second key point", "Third key point"]
}`;

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    provider?: unknown;
    model?: unknown;
    apiKey?: unknown;
    articleContent?: unknown;
    articleTitle?: unknown;
    summaryLength?: unknown;
  };

  const provider = normalizeAIProvider(body.provider);
  const model = normalizeText(body.model, 180) || getDefaultModelForProvider(provider);
  const apiKey = normalizeApiKey(body.apiKey);
  const articleContent = normalizeText(body.articleContent, 100_000);
  const articleTitle = normalizeText(body.articleTitle, 500);
  const summaryLength = (
    body.summaryLength === 'short' ||
    body.summaryLength === 'medium' ||
    body.summaryLength === 'long'
      ? body.summaryLength
      : 'medium'
  ) as SummaryLength;

  if (!articleContent) {
    return NextResponse.json({ error: 'Article content is required' }, { status: 400 });
  }

  if (isLocalAIProvider(provider) && !isLocalCLIEnabled()) {
    return NextResponse.json(
      {
        error: 'Local CLI providers are available only in development environments.',
      },
      { status: 400 }
    );
  }

  if (requiresApiKey(provider) && !apiKey) {
    return NextResponse.json({ error: `API key is required for ${provider}` }, { status: 400 });
  }

  try {
    // For local providers, we'll use a simpler approach without generateText
    if (isLocalAIProvider(provider)) {
      return NextResponse.json(
        {
          error:
            'Local providers are not supported for summary generation. Please use OpenAI, Anthropic, or Google.',
        },
        { status: 400 }
      );
    }

    const lengthInstruction = SUMMARY_LENGTH_INSTRUCTIONS[summaryLength];
    const userPrompt = `Please analyze and summarize the following article${articleTitle ? ` titled "${articleTitle}"` : ''}:

${articleContent}

${lengthInstruction}

Remember to respond with valid JSON in the exact format specified.`;

    const result = await generateText({
      model: createLanguageModel(provider, model, apiKey),
      system: SUMMARY_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxRetries: 1,
    });

    // Parse the JSON response
    let parsedResponse: { summary: string; keyPoints: string[] };
    try {
      // Try to extract JSON from markdown code blocks if present
      const text = result.text.trim();
      const jsonMatch =
        text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || text.match(/(\{[\s\S]*\})/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      parsedResponse = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: treat the entire response as summary
      parsedResponse = {
        summary: result.text,
        keyPoints: [],
      };
    }

    // Validate the response structure
    if (!parsedResponse.summary || typeof parsedResponse.summary !== 'string') {
      throw new Error('Invalid summary format from AI');
    }

    if (!Array.isArray(parsedResponse.keyPoints)) {
      parsedResponse.keyPoints = [];
    }

    // Limit key points to 5
    parsedResponse.keyPoints = parsedResponse.keyPoints.slice(0, 5);

    return NextResponse.json({
      summary: parsedResponse.summary,
      keyPoints: parsedResponse.keyPoints,
    });
  } catch (error) {
    console.error('AI summary generation failed:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate summary',
      },
      { status: 500 }
    );
  }
}
