import { GoogleGenAI } from "@google/genai";

export async function generateContentHash(content: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function fetchEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: text
    });
    
    if (response.embeddings?.[0]?.values) {
      return response.embeddings[0].values;
    }
    return null;
  } catch (err) {
    console.error("Embedding request failed:", err);
    return null;
  }
}

export async function fetchAIAnswer(messages: {role: "user" | "model", text: string}[], apiKey: string): Promise<string | null> {
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const formattedContents = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents
    });
    
    if (response.text) {
      return response.text;
    }
    return null;
  } catch (err) {
    console.error("Generate request failed:", err);
    return null;
  }
}

