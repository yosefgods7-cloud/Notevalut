import React, { useEffect, useRef } from 'react';
import { useStorage } from '../context/StorageContext';
import { useAI, isNoteInAiScope } from '../hooks/useAI';

export const BackgroundAIProcessor: React.FC = () => {
  const { data } = useStorage();
  const { generateEmbeddingForNote } = useAI();
  const isProcessing = useRef(false);
  
  const dataRef = useRef(data);
  const generatorRef = useRef(generateEmbeddingForNote);
  
  useEffect(() => {
    dataRef.current = data;
    generatorRef.current = generateEmbeddingForNote;
  }, [data, generateEmbeddingForNote]);

  useEffect(() => {
    const processOutdatedNotes = async () => {
      if (isProcessing.current || !dataRef.current.settings.geminiApiKey) return;
      isProcessing.current = true;
      
      try {
        let processedCount = 0;
        const notes = dataRef.current.notes.filter(n => isNoteInAiScope(n, dataRef.current.settings.aiScope));
        for (const note of notes) {
          if (processedCount >= 3) break;
          // Very quick check to avoid even hashing if there's no note change since last load, 
          // but we can't reliably know without hash. Hashing is relatively fast anyway.
          const res = await generatorRef.current(note);
          if (res) {
            processedCount++;
          }
        }
      } catch (err) {
        console.error("Background AI processing error:", err);
      } finally {
        isProcessing.current = false;
      }
    };

    const interval = setInterval(processOutdatedNotes, 15000); 
    return () => clearInterval(interval);
  }, []);

  return null;
};
