import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  OLLAMA_LLM_URL: z.string().url().default("https://ollama.com/api"),
  OLLAMA_API_KEY: z.string().min(1).optional(),
  OLLAMA_LLM_MODEL: z.string().default("gemma4:31b"),
  OLLAMA_EMBEDDING_URL: z.string().url().default("http://localhost:11434/api"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("qwen3-embedding:0.6b"),
  OLLAMA_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1024),
  DWELL_INGEST_SECRET: z.string().min(1).optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OLLAMA_LLM_URL: process.env.OLLAMA_LLM_URL,
  OLLAMA_API_KEY: process.env.OLLAMA_API_KEY,
  OLLAMA_LLM_MODEL: process.env.OLLAMA_LLM_MODEL,
  OLLAMA_EMBEDDING_URL: process.env.OLLAMA_EMBEDDING_URL,
  OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL,
  OLLAMA_EMBEDDING_DIMENSIONS: process.env.OLLAMA_EMBEDDING_DIMENSIONS,
  DWELL_INGEST_SECRET: process.env.DWELL_INGEST_SECRET,
});
