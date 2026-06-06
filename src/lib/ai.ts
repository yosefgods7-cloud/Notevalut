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

// Ensure the helper function accurately handles API calls and exponential backoff
async function fetchWithBackoff(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
  let retries = 0;
  while (true) {
    const response = await fetch(url, init);
    if (response.status === 429 && retries < maxRetries) {
      // Exponential backoff
      const waitTime = Math.pow(2, retries + 1) * 1000;
      await new Promise(r => setTimeout(r, waitTime));
      retries++;
      continue;
    }
    return response;
  }
}

export async function fetchEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  
  try {
    const response = await fetchWithBackoff(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] }
      })
    });
    
    if (!response.ok) {
      console.error("Embedding API error:", await response.text());
      return null;
    }
    
    const data = await response.json();
    if (data.embedding?.values) {
      return data.embedding.values as number[];
    }
    return null;
  } catch (err) {
    console.error("Embedding request failed:", err);
    return null;
  }
}

export async function fetchAIAnswer(messages: {role: "user" | "model", text: string}[], apiKey: string): Promise<string | null> {
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  try {
    const formattedContents = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));
    
    const response = await fetchWithBackoff(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: formattedContents
      })
    });
    
    if (!response.ok) {
      console.error("Generate Content API error:", await response.text());
      return null;
    }
    
    const data = await response.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    return null;
  } catch (err) {
    console.error("Generate request failed:", err);
    return null;
  }
}
