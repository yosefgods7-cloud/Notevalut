import React, { useEffect, useRef } from 'react';
import { useStorage } from '../context/StorageContext';
import { useAI, isNoteInAiScope, getSelectedApiKey } from '../hooks/useAI';

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
      // Use requestIdleCallback if available to prevent stopping the main thread
      const keyInfo = getSelectedApiKey(dataRef.current.settings, 'embedding');
      if (isProcessing.current || !keyInfo) return;
      isProcessing.current = true;
      
      try {
        let processedCount = 0;
        const notes = dataRef.current.notes.filter(n => isNoteInAiScope(n, dataRef.current.settings.aiScope));
        for (const note of notes) {
          if (processedCount >= 1) break; // Dramatically reduced load size per cycle
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

    const interval = setInterval(processOutdatedNotes, 60000); // reduced frequency to 1 minute
    return () => clearInterval(interval);
  }, []);

  return null;
};
