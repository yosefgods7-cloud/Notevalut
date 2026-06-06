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

export function getSelectedApiKey(settings: any, featureType: 'embedding' | 'chat' | 'digest' | 'editor') {
  const configs = settings.featureApiConfigs;
  const legacyKey = settings.geminiApiKey;
  const allKeys = settings.apiKeys || [];
  
  let selectedId: string | undefined;
  if (featureType === 'embedding') selectedId = configs?.embeddingKeyId;
  else if (featureType === 'chat') selectedId = configs?.chatKeyId;
  else if (featureType === 'digest') selectedId = configs?.digestKeyId;
  else if (featureType === 'editor') selectedId = configs?.editorKeyId;

  if (selectedId) {
    const found = allKeys.find((k: any) => k.id === selectedId);
    if (found?.key) return { id: selectedId, key: found.key };
  }
  
  if (allKeys.length > 0 && allKeys[0].key) return { id: allKeys[0].id, key: allKeys[0].key };
  
  if (legacyKey) return { id: 'legacy', key: legacyKey };
  return null;
}

export function useAI() {
  const { data, updateSettings, updateNote } = useStorage();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const checkRateLimit = (keyId: string, type: 'embedding' | 'answer') => {
    const today = new Date().toISOString().split('T')[0];
    
    // Check key-specific limits
    const keyUsageMap = data.settings.apiUsageByKey || {};
    const usage = keyUsageMap[keyId] || (keyId === 'legacy' ? data.settings.apiUsage : undefined);
    
    if (usage?.date !== today) return true;
    
    const total = (usage.embeddingCount || 0) + (usage.answerCount || 0) + (usage.digestCount || 0) + (usage.editorCount || 0);
    if (total >= 1400) return false;
    
    return true;
  };

  const incrementRateLimit = (keyId: string, type: 'embedding' | 'answer') => {
    const today = new Date().toISOString().split('T')[0];
    const keyUsageMap = data.settings.apiUsageByKey || {};
    const u = keyUsageMap[keyId] || (keyId === 'legacy' ? data.settings.apiUsage : undefined);
    
    const newUsage = {
      date: today,
      embeddingCount: u?.date === today ? (u.embeddingCount || 0) : 0,
      answerCount: u?.date === today ? (u.answerCount || 0) : 0,
      digestCount: u?.date === today ? (u.digestCount || 0) : 0,
      editorCount: u?.date === today ? (u.editorCount || 0) : 0,
    };
    
    if (type === 'embedding') newUsage.embeddingCount++;
    if (type === 'answer') newUsage.answerCount++;
    
    const updatedMap = { ...keyUsageMap, [keyId]: newUsage };
    const updates: any = { apiUsageByKey: updatedMap };
    
    if (keyId === 'legacy') {
      updates.apiUsage = newUsage; // fallback compatibility
    }
    
    updateSettings(updates);
  };

  const generateEmbeddingForNote = useCallback(async (note: Note) => {
    const keyInfo = getSelectedApiKey(data.settings, 'embedding');
    if (!keyInfo) return false;
    if (!checkRateLimit(keyInfo.id, 'embedding')) return false;
    
    const apiKey = keyInfo.key;

    const textToEmbed = `Title: ${note.title}\nContent: ${note.content}`;
    const hash = await generateContentHash(textToEmbed);
    
    if (note.contentHash === hash && note.embedding) {
      return false; // already up to date
    }

    const embedding = await fetchEmbedding(textToEmbed, apiKey);
    if (embedding) {
      incrementRateLimit(keyInfo.id, 'embedding');
      updateNote(note.id, { contentHash: hash, embedding });
      return true;
    }
    return false;
  }, [data.settings.apiKeys, data.settings.featureApiConfigs, data.settings.geminiApiKey, data.settings.apiUsage, data.settings.apiUsageByKey, updateNote, updateSettings]);

  const findRelevantNotes = useCallback(async (query: string, topK = 5) => {
    const keyInfo = getSelectedApiKey(data.settings, 'embedding');
    if (!keyInfo) throw new Error("Missing API Key");
    if (!checkRateLimit(keyInfo.id, 'embedding')) throw new Error("Daily embedding rate limit reached (1400/day)");
    
    const apiKey = keyInfo.key;

    const queryEmbedding = await fetchEmbedding(query, apiKey);
    if (!queryEmbedding) throw new Error("Failed to generate embedding for query");
    incrementRateLimit(keyInfo.id, 'embedding');

    const scoredNotes = data.notes
      .filter(n => !n.isDeleted && isNoteInAiScope(n, data.settings.aiScope) && n.embedding && n.embedding.length > 0)
      .map(n => ({
        note: n,
        score: cosineSimilarity(queryEmbedding, n.embedding!)
      }))
      .sort((a, b) => b.score - a.score);

    return scoredNotes.slice(0, topK);
  }, [data.notes, data.settings.apiKeys, data.settings.featureApiConfigs, data.settings.geminiApiKey, data.settings.apiUsageByKey, data.settings.apiUsage, updateSettings]);

  const getTagGraphBoost = useCallback((topNotes: Note[], maxToAdd = 2) => {
    const topIds = new Set(topNotes.map(n => n.id));
    const sharedTags = new Set(topNotes.flatMap(n => n.tags));
    const linkedTitles = new Set(topNotes.flatMap(n => {
      const matches = Array.from(n.content.matchAll(/\[\[(.*?)\]\]/g));
      return matches.map(m => m[1].toLowerCase());
    }));
    
    const candidates = data.notes.filter(n => {
      if (topIds.has(n.id) || n.isDeleted) return false;
      
      const hasSharedTag = n.tags.some(t => sharedTags.has(t));
      const hasWikilinkConnect = linkedTitles.has(n.title.toLowerCase());
      
      return hasSharedTag || hasWikilinkConnect;
    });

    return candidates.slice(0, maxToAdd);
  }, [data.notes]);

  const askSecondBrain = useCallback(async (
    userQuestion: string, 
    options?: {
      history?: {role: 'user' | 'ai', content: string}[];
      lastQueryEmbedding?: number[];
      lastTrimmedBundle?: Note[];
      topK?: number;
      conversationMode?: boolean;
    }
  ) => {
    const answerKeyInfo = getSelectedApiKey(data.settings, 'chat');
    if (!answerKeyInfo) {
      setAiError("Missing Gemini API Key. Please add it in Settings.");
      return null;
    }
    if (!checkRateLimit(answerKeyInfo.id, 'answer')) {
      setAiError("Daily answer rate limit reached (1400/day).");
      return null;
    }
    const answerApiKey = answerKeyInfo.key;

    // For embeddings, we should use the embedding key
    const embeddingKeyInfo = getSelectedApiKey(data.settings, 'embedding') || answerKeyInfo;
    const embeddingApiKey = embeddingKeyInfo.key;

    setIsGenerating(true);
    setAiError(null);
    try {
      const topK = options?.topK || 5;
      const conversationMode = options?.conversationMode !== false;
      const history = options?.history || [];
      
      let queryEmbedding: number[] | null = null;
      let isUnrelated = true;
      
      queryEmbedding = await fetchEmbedding(userQuestion, embeddingApiKey);
      if (queryEmbedding && checkRateLimit(embeddingKeyInfo.id, 'embedding')) {
        incrementRateLimit(embeddingKeyInfo.id, 'embedding');
      }
      
      if (conversationMode && queryEmbedding && options?.lastQueryEmbedding) {
         const score = cosineSimilarity(queryEmbedding, options.lastQueryEmbedding);
         isUnrelated = score < 0.4;
      }
      
      let trimmedBundle: Note[] = [];
      
      if (conversationMode && !isUnrelated && options?.lastTrimmedBundle) {
        trimmedBundle = options.lastTrimmedBundle;
      } else {
        // Step 2: Vector Search using new question
        const relevantResults = await findRelevantNotes(userQuestion, topK);
        let bundleNotes = relevantResults.map(r => r.note);

        // Step 3: Tag Graph Boost
        const boostedNotes = getTagGraphBoost(bundleNotes, Math.max(1, topK - bundleNotes.length));
        bundleNotes = [...bundleNotes, ...boostedNotes].slice(0, topK + 2);

        // Total characters check max 24,000 mapping ~6000 tokens
        let totalChars = 0;
        for (const note of bundleNotes) {
          const charCount = note.title.length + note.content.length + note.tags.join("").length;
          if (totalChars + charCount <= 24000) {
            trimmedBundle.push(note);
            totalChars += charCount;
          }
        }
      }

      // Format bundle
      const notesContext = trimmedBundle.map((n, i) => `[NOTE ${i + 1}] Title: ${n.title} | Tags: ${n.tags.join(', ')}\n${n.content}\n`).join("\n");
      const systemPrompt = `System: "You are a second brain assistant for NoteVault.
Answer using ONLY the notes provided below.
If the answer is not in the notes, say so clearly.
Always reference which note your answer comes from."

Notes:
${notesContext}`;

      const messages: {role: "user" | "model", text: string}[] = [
        { role: "user", text: systemPrompt }
      ];

      if (conversationMode && !isUnrelated) {
        history.forEach(h => {
          messages.push({ role: h.role === 'ai' ? 'model' : 'user', text: h.content });
        });
      }

      messages.push({ role: "user", text: userQuestion });

      const answer = await fetchAIAnswer(messages, answerApiKey);
      if (answer) {
        incrementRateLimit(answerKeyInfo.id, 'answer');
        return {
          answer,
          sources: trimmedBundle.map(n => n.title),
          queryEmbedding,
          trimmedBundle
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
  }, [findRelevantNotes, getTagGraphBoost, data.settings.apiKeys, data.settings.featureApiConfigs, data.settings.geminiApiKey, data.settings.apiUsageByKey, data.settings.apiUsage, updateSettings]);

  return {
    generateEmbeddingForNote,
    askSecondBrain,
    isGenerating,
    aiError,
    setAiError
  };
}
