import { env } from "./env";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function cleanApiKey(value?: string) {
  if (!value) return undefined;
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

function cloudModelName(model: string) {
  const normalized = model.trim();
  if (normalized.endsWith("-cloud") || normalized.endsWith(":cloud")) return normalized;

  const aliases: Record<string, string> = {
    "gpt-oss:20b": "gpt-oss:20b-cloud",
    "gpt-oss:120b": "gpt-oss:120b-cloud",
    "gemma4:31b": "gemma4:31b-cloud",
  };

  return aliases[normalized] ?? normalized;
}

async function ollamaPost(
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

  const detail = response.ok ? undefined : await response.text();
  return { response, detail };
}

function authError() {
  return new Error(
    "Ollama Cloud authentication failed (401). Check OLLAMA_API_KEY in .env.local, or use Ollama's local Cloud connection with `ollama signin` and a `*-cloud` model.",
  );
}

async function callChat(
  url: string,
  model: string,
  messages: ChatMessage[],
  apiKey?: string,
) {
  const { response, detail } = await ollamaPost(
    url,
    {
      model,
      messages,
      stream: false,
      format: "json",
      options: { temperature: 0.2 },
    },
    apiKey,
  );

  if (!response.ok) {
    if (response.status === 401) throw authError();
    throw new Error(`Ollama request failed (${response.status}): ${detail ?? "Unknown error"}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const message = data.message as { content?: unknown } | undefined;
  const content = message?.content;

  if (typeof content !== "string") {
    throw new Error("Ollama returned an invalid chat payload.");
  }

  return JSON.parse(content);
}

export async function embedText(input: string | string[]) {
  const dataResult = await ollamaPost(
    `${apiRoot(env.OLLAMA_EMBEDDING_URL)}/embed`,
    {
      model: env.OLLAMA_EMBEDDING_MODEL,
      input,
      dimensions: env.OLLAMA_EMBEDDING_DIMENSIONS,
    },
  );

  if (!dataResult.response.ok) {
    if (dataResult.response.status === 401) throw authError();
    throw new Error(
      `Ollama embedding request failed (${dataResult.response.status}): ${dataResult.detail ?? "Unknown error"}`,
    );
  }

  const data = (await dataResult.response.json()) as Record<string, unknown>;
  const embeddings = data.embeddings;

  if (!Array.isArray(embeddings) || !embeddings.every(Array.isArray)) {
    throw new Error("Ollama returned an invalid embedding payload.");
  }

  return embeddings as number[][];
}

export async function chatJson<T>(messages: ChatMessage[]) {
  const configuredUrl = env.OLLAMA_LLM_URL.trim();
  const cloudApi = isOllamaCloudUrl(configuredUrl);
  const apiKey = cleanApiKey(env.OLLAMA_API_KEY);
  const model = env.OLLAMA_LLM_MODEL;

  if (!cloudApi) {
    return (await callChat(
      `${apiRoot(configuredUrl)}/chat`,
      model,
      messages,
    )) as T;
  }

  if (apiKey) {
    try {
      // Ollama's documented direct Cloud endpoint.
      return (await callChat(
        `${apiRoot(configuredUrl)}/chat`,
        model,
        messages,
        apiKey,
      )) as T;
    } catch (error) {
      // During local development, prefer Ollama's signed-in Cloud connection if
      // the dashboard API key is rejected or unavailable.
      if (!(error instanceof Error) || !error.message.includes("authentication failed (401)")) {
        throw error;
      }
    }
  }

  const localUrl = "http://localhost:11434/api/chat";
  const localModel = cloudModelName(model);

  try {
    return (await callChat(localUrl, localModel, messages)) as T;
  } catch (localError) {
    if (apiKey) {
      throw new Error(
        `${authError().message} Local Ollama fallback also failed: ${
          localError instanceof Error ? localError.message : "unknown local error"
        }`,
      );
    }

    throw new Error(
      `Ollama Cloud is not authenticated. Run \`ollama signin\` and make sure \`${localModel}\` is available, or configure a valid OLLAMA_API_KEY.`,
    );
  }
}
