import { env } from "./env";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function cleanApiKey(value?: string) {
  if (!value) return undefined;

  // Makes accidental values such as `Bearer sk-...` work too.
  return value.trim().replace(/^Bearer\s+/i, "");
}

function isOllamaCloudUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "ollama.com" || url.hostname.endsWith(".ollama.com");
  } catch {
    return false;
  }
}

function apiRoot(value: string) {
  return value.replace(/\/$/, "");
}

async function ollamaFetch(
  url: string,
  body: unknown,
  apiKey?: string,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();

    if (response.status === 401) {
      throw new Error(
        "Ollama Cloud authentication failed (401). Check OLLAMA_API_KEY in .env.local. Use the raw API key only — do not prefix it with `Bearer`.",
      );
    }

    throw new Error(`Ollama request failed (${response.status}): ${detail}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function embedText(input: string | string[]) {
  const data = await ollamaFetch(
    `${apiRoot(env.OLLAMA_EMBEDDING_URL)}/embed`,
    {
      model: env.OLLAMA_EMBEDDING_MODEL,
      input,
      dimensions: env.OLLAMA_EMBEDDING_DIMENSIONS,
    },
  );

  const embeddings = data.embeddings;
  if (!Array.isArray(embeddings) || !embeddings.every(Array.isArray)) {
    throw new Error("Ollama returned an invalid embedding payload.");
  }

  return embeddings as number[][];
}

export async function chatJson<T>(messages: ChatMessage[]) {
  const configuredUrl = env.OLLAMA_LLM_URL.trim();
  const cloud = isOllamaCloudUrl(configuredUrl);
  const apiKey = cleanApiKey(env.OLLAMA_API_KEY);

  if (cloud && !apiKey) {
    throw new Error("OLLAMA_API_KEY is required for Ollama Cloud.");
  }

  let url: string;
  let body: Record<string, unknown>;

  if (cloud) {
    // Ollama's current direct cloud API is OpenAI-compatible.
    const root = configuredUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
    url = `${root}/v1/chat/completions`;
    body = {
      model: env.OLLAMA_LLM_MODEL,
      messages,
      stream: false,
      response_format: { type: "json_object" },
      temperature: 0.2,
    };
  } else {
    const root = apiRoot(configuredUrl);
    url = `${root}/chat`;
    body = {
      model: env.OLLAMA_LLM_MODEL,
      messages,
      stream: false,
      format: "json",
      options: {
        temperature: 0.2,
      },
    };
  }

  const data = await ollamaFetch(url, body, apiKey);

  const choices = data.choices as Array<{
    message?: { content?: unknown };
  }> | undefined;

  if (Array.isArray(choices)) {
    const content = choices[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Ollama returned an invalid chat completion payload.");
    }

    return JSON.parse(content) as T;
  }

  // Keep local/native Ollama responses supported.
  const message = data.message as { content?: unknown } | undefined;
  const content = message?.content;
  if (typeof content !== "string") {
    throw new Error("Ollama returned an invalid chat payload.");
  }

  return JSON.parse(content) as T;
}
