import { useStorage } from '../context/StorageContext';
import { useCallback, useState } from 'react';
import { fetchEmbedding, fetchAIAnswer, cosineSimilarity, generateContentHash } from '../lib/ai';
import { Note, AiSearchScope } from '../types';

export function isNoteInAiScope(note: Note, scope?: AiSearchScope): boolean {
  if (!scope) return true;
  
  // If nothing is selected, arguably all notes are included according to instructions
  const hasWorkspace = scope.workspaceIds.length > 0;
  const hasCollection = scope.collectionIds.length > 0;
  const hasNote = scope.noteIds.length > 0;

  if (!hasWorkspace && !hasCollection && !hasNote) return true;

  if (hasNote && scope.noteIds.includes(note.id)) return true;
  if (hasCollection && scope.collectionIds.includes(note.collectionId)) return true;
  if (hasWorkspace && scope.workspaceIds.includes(note.workspaceId)) return true;
  
  // If we have some filters active, but this note didn't match any, exclude it.
  return false;
}

export function useAI() {
  const { data, updateSettings, updateNote } = useStorage();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const checkRateLimit = (type: 'embedding' | 'answer') => {
    const today = new Date().toISOString().split('T')[0];
    const usage = data.settings.apiUsage || { date: today, embeddingCount: 0, answerCount: 0 };
    
    if (usage.date !== today) {
      usage.date = today;
      usage.embeddingCount = 0;
      usage.answerCount = 0;
    }
    
    if (type === 'embedding' && usage.embeddingCount >= 1400) return false;
    if (type === 'answer' && usage.answerCount >= 1400) return false;
    
    return true;
  };

  const incrementRateLimit = (type: 'embedding' | 'answer') => {
    const today = new Date().toISOString().split('T')[0];
    const usage = data.settings.apiUsage || { date: today, embeddingCount: 0, answerCount: 0 };
    
    if (usage.date !== today) {
      usage.date = today;
      usage.embeddingCount = 0;
      usage.answerCount = 0;
    }
    
    if (type === 'embedding') usage.embeddingCount++;
    if (type === 'answer') usage.answerCount++;
    
    updateSettings({ apiUsage: usage });
  };

  const generateEmbeddingForNote = useCallback(async (note: Note) => {
    const apiKey = data.settings.geminiApiKey;
    if (!apiKey) return false;
    if (!checkRateLimit('embedding')) return false;

    const textToEmbed = `Title: ${note.title}\nContent: ${note.content}`;
    const hash = await generateContentHash(textToEmbed);
    
    if (note.contentHash === hash && note.embedding) {
      return false; // already up to date
    }

    const embedding = await fetchEmbedding(textToEmbed, apiKey);
    if (embedding) {
      incrementRateLimit('embedding');
      updateNote(note.id, { contentHash: hash, embedding });
      return true;
    }
    return false;
  }, [data.settings.geminiApiKey, data.settings.apiUsage, updateNote, updateSettings]);

  const findRelevantNotes = useCallback(async (query: string, topK = 5) => {
    const apiKey = data.settings.geminiApiKey;
    if (!apiKey) throw new Error("Missing API Key");
    if (!checkRateLimit('embedding')) throw new Error("Daily embedding rate limit reached (1400/day)");

    const queryEmbedding = await fetchEmbedding(query, apiKey);
    if (!queryEmbedding) throw new Error("Failed to generate embedding for query");
    incrementRateLimit('embedding');

    const scoredNotes = data.notes
      .filter(n => isNoteInAiScope(n, data.settings.aiScope) && n.embedding && n.embedding.length > 0)
      .map(n => ({
        note: n,
        score: cosineSimilarity(queryEmbedding, n.embedding!)
      }))
      .sort((a, b) => b.score - a.score);

    return scoredNotes.slice(0, topK);
  }, [data.notes, data.settings.geminiApiKey, data.settings.apiUsage, updateSettings]);

  const getTagGraphBoost = useCallback((topNotes: Note[], maxToAdd = 2) => {
    const topIds = new Set(topNotes.map(n => n.id));
    const sharedTags = new Set(topNotes.flatMap(n => n.tags));
    
    const candidates = data.notes.filter(n => {
      if (topIds.has(n.id)) return false;
      return n.tags.some(t => sharedTags.has(t));
    });

    return candidates.slice(0, maxToAdd);
  }, [data.notes]);

  const askSecondBrain = useCallback(async (userQuestion: string) => {
    const apiKey = data.settings.geminiApiKey;
    if (!apiKey) {
      setAiError("Missing Gemini API Key. Please add it in Settings.");
      return null;
    }
    if (!checkRateLimit('answer')) {
      setAiError("Daily answer rate limit reached (1400/day).");
      return null;
    }

    setIsGenerating(true);
    setAiError(null);
    try {
      // Step 2: Vector Search
      const relevantResults = await findRelevantNotes(userQuestion, 5);
      let bundleNotes = relevantResults.map(r => r.note);

      // Step 3: Tag Graph Boost
      const boostedNotes = getTagGraphBoost(bundleNotes, 2);
      bundleNotes = [...bundleNotes, ...boostedNotes];

      // Total characters check max 24,000 mapping ~6000 tokens
      let totalChars = 0;
      let trimmedBundle: Note[] = [];
      for (const note of bundleNotes) {
        const charCount = note.title.length + note.content.length + note.tags.join("").length;
        if (totalChars + charCount <= 24000) {
          trimmedBundle.push(note);
          totalChars += charCount;
        }
      }

      // Format bundle
      const notesContext = trimmedBundle.map((n, i) => `[NOTE ${i + 1}] Title: ${n.title} | Tags: ${n.tags.join(', ')}\n${n.content}\n`).join("\n");
      const prompt = `System: "You are a second brain assistant for NoteVault.
Answer using ONLY the notes provided below.
If the answer is not in the notes, say so clearly.
Always reference which note your answer comes from."

Notes:
${notesContext}

Question: ${userQuestion}`;

      const answer = await fetchAIAnswer(prompt, apiKey);
      if (answer) {
        incrementRateLimit('answer');
        return {
          answer,
          sources: trimmedBundle.map(n => n.title)
        };
      }
      setAiError("Failed to get answer from AI.");
      return null;
    } catch (err: any) {
      setAiError(err.message || "An error occurred during AI query.");
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [findRelevantNotes, getTagGraphBoost, data.settings.geminiApiKey, data.settings.apiUsage, updateSettings]);

  return {
    generateEmbeddingForNote,
    askSecondBrain,
    isGenerating,
    aiError,
    setAiError
  };
}
