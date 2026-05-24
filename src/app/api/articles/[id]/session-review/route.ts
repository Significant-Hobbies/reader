import { generateText } from 'ai';
import { NextResponse } from 'next/server';

import { getLanguageModel } from '@/lib/ai-cloudflare';
import { normalizeApiKey, normalizeEndpointUrl, normalizeText } from '@/lib/ai-server';
import { fetchArticleById, updateArticle, verifyArticleOwnership } from '@/lib/articles-db';
import { getAuthenticatedUserId } from '@/lib/auth-api';
import type { SessionReview } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are an expert at synthesizing reading sessions. Given an article title and the reader's notes (each note may include a highlighted excerpt), produce a compact review artifact.

Respond with valid JSON in exactly this structure:
{
  "summary": "2–3 sentence recap of the core argument or content of the article",
  "keyThemes": ["theme1", "theme2"],
  "actionItems": ["action or follow-up 1", "action or follow-up 2"],
  "notesSummary": "1–2 sentence synthesis of what the reader focused on and annotated"
}

Rules:
- keyThemes: 2–4 short phrases, no sentences
- actionItems: only concrete next steps mentioned in notes; empty array [] if none
- Keep all values concise and factual`;

function buildUserPrompt(title: string, notes: Array<{ text: string; textPreview?: string }>) {
  const notesBlock = notes
    .map((n, i) => {
      const excerpt = n.textPreview ? `\n  Excerpt: "${n.textPreview}"` : '';
      return `${i + 1}. Note: "${n.text}"${excerpt}`;
    })
    .join('\n');

  return `Article title: "${title}"

Reader's notes:
${notesBlock}

Generate the session review JSON.`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const isOwner = await verifyArticleOwnership(id, userId);
  if (!isOwner) {
    return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
  }

  const article = await fetchArticleById(id, userId);
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  const notes = article.notes ?? [];
  if (notes.length === 0) {
    return NextResponse.json({ error: 'No notes to review' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    endpointUrl?: unknown;
    model?: unknown;
    apiKey?: unknown;
  };

  const endpointUrl = normalizeEndpointUrl(body.endpointUrl);
  const model = normalizeText(body.model, 180);
  const apiKey = normalizeApiKey(body.apiKey);

  try {
    const noteInputs = notes.map((n) => ({
      text: n.text,
      textPreview: n.anchor?.textPreview,
    }));

    const result = await generateText({
      model: getLanguageModel({
        endpointUrl,
        apiKey,
        model,
        headers: { 'x-gateway-project-id': 'reader' },
      }),
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(article.title, noteInputs),
      maxRetries: 1,
    });

    let parsed: {
      summary: string;
      keyThemes: string[];
      actionItems: string[];
      notesSummary: string;
    };
    try {
      const text = result.text.trim();
      const jsonMatch =
        text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || text.match(/(\{[\s\S]*\})/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1] : text);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    if (typeof parsed.summary !== 'string' || !parsed.summary) {
      return NextResponse.json({ error: 'Invalid review format from AI' }, { status: 500 });
    }

    const review: SessionReview = {
      generatedAt: new Date().toISOString(),
      summary: parsed.summary.trim().slice(0, 1000),
      keyThemes: Array.isArray(parsed.keyThemes)
        ? parsed.keyThemes
            .map((t) => String(t).trim())
            .filter(Boolean)
            .slice(0, 6)
        : [],
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems
            .map((a) => String(a).trim())
            .filter(Boolean)
            .slice(0, 10)
        : [],
      notesSummary:
        typeof parsed.notesSummary === 'string' ? parsed.notesSummary.trim().slice(0, 600) : '',
    };

    await updateArticle(id, userId, { sessionReview: review });

    return NextResponse.json({ review });
  } catch (error) {
    console.error('session-review: generation failed', error);
    return NextResponse.json({ error: 'Failed to generate review' }, { status: 500 });
  }
}
