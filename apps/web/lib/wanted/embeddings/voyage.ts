import 'server-only';

// ---------------------------------------------------------------------------
// Voyage AI embeddings client — thin fetch wrapper, no SDK dependency.
// Uses the voyage-3 model (1024-dimensional vectors).
// ---------------------------------------------------------------------------

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3';

export class VoyageError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'VoyageError';
    this.status = status;
  }
}

interface VoyageEmbeddingObject {
  embedding: number[];
  index: number;
}

interface VoyageResponse {
  data: VoyageEmbeddingObject[];
  model: string;
  usage: { total_tokens: number };
}

/**
 * Embed an array of texts via the Voyage REST API.
 *
 * @param texts     Strings to embed. Voyage accepts batches.
 * @param inputType 'query' for search queries (Briefs); 'document' for corpus items (Apps/users).
 * @returns         Embeddings in the same order as the input texts.
 */
export async function embedTexts(
  texts: string[],
  inputType: 'query' | 'document',
): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new VoyageError('VOYAGE_API_KEY environment variable is not set');
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    throw new VoyageError(
      `Voyage API request failed with status ${response.status}`,
      response.status,
    );
  }

  const data = (await response.json()) as VoyageResponse;

  if (!Array.isArray(data?.data)) {
    throw new VoyageError('Voyage returned malformed response');
  }

  // Sort by index so the output order matches the input order, regardless of
  // how Voyage returns them.
  const sorted = [...data.data].sort((a, b) => a.index - b.index);
  return sorted.map((item) => item.embedding);
}

/**
 * Convenience wrapper for a single text.
 */
export async function embedText(text: string, inputType: 'query' | 'document'): Promise<number[]> {
  const results = await embedTexts([text], inputType);
  if (!results[0]) {
    throw new VoyageError('Voyage returned no embeddings');
  }
  return results[0];
}
