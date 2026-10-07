import { env } from "./env";

function authHeaders(useKey: boolean) {
  return {
    "Content-Type": "application/json",
    ...(useKey && env.OLLAMA_API_KEY
      ? { Authorization: `Bearer ${env.OLLAMA_API_KEY}` }
      : {}),
  };
}

async function ollamaFetch(url: string, body: unknown, useKey: boolean) {
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(useKey),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${detail}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function embedText(input: string | string[]) {
  const data = await ollamaFetch(
    `${env.OLLAMA_EMBEDDING_URL.replace(/\/$/, "")}/embed`,
    {
      model: env.OLLAMA_EMBEDDING_MODEL,
      input,
      dimensions: env.OLLAMA_EMBEDDING_DIMENSIONS,
    },
    false,
  );

  const embeddings = data.embeddings;
  if (!Array.isArray(embeddings) || !embeddings.every(Array.isArray)) {
    throw new Error("Ollama returned an invalid embedding payload.");
  }

  return embeddings as number[][];
}

export async function chatJson<T>(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  if (!env.OLLAMA_API_KEY && env.OLLAMA_LLM_URL.includes("ollama.com")) {
    throw new Error("OLLAMA_API_KEY is required for Ollama Cloud.");
  }

  const data = await ollamaFetch(
    `${env.OLLAMA_LLM_URL.replace(/\/$/, "")}/chat`,
    {
      model: env.OLLAMA_LLM_MODEL,
      messages,
      stream: false,
      format: "json",
      options: {
        temperature: 0.2,
      },
    },
    env.OLLAMA_LLM_URL.includes("ollama.com"),
  );

  const message = data.message as { content?: unknown } | undefined;
  const content = message?.content;
  if (typeof content !== "string") {
    throw new Error("Ollama returned an invalid chat payload.");
  }

  return JSON.parse(content) as T;
}
