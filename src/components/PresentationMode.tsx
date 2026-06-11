import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PresentationModeProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

interface Slide {
  id: string;
  headingHTML: string;
  contentHTML: string;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  isOpen,
  onClose,
  content,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = useMemo(() => {
    if (!content) return [];
    
    const div = document.createElement("div");
    div.innerHTML = content;
    
    const extractedSlides: Slide[] = [];
    let currentSlideData: Slide = { id: 'slide-0', headingHTML: '', contentHTML: '' };
    let hasContent = false;

    Array.from(div.children).forEach((child, index) => {
      const tagName = child.tagName.toLowerCase();
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
         if (hasContent || currentSlideData.headingHTML) {
            extractedSlides.push({ ...currentSlideData });
         }
         currentSlideData = {
           id: `slide-${index}`,
           headingHTML: child.outerHTML,
           contentHTML: ''
         };
         hasContent = true;
      } else {
         currentSlideData.contentHTML += child.outerHTML;
         if (child.textContent?.trim() || child.tagName.toLowerCase() === 'img') {
             hasContent = true;
         }
      }
    });

    if (hasContent || currentSlideData.headingHTML) {
      extractedSlides.push(currentSlideData);
    }

    if (extractedSlides.length === 0 && content) {
        extractedSlides.push({
            id: 'slide-default',
            headingHTML: '',
            contentHTML: content
        });
    }

    return extractedSlides;
  }, [content]);

  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'Space') {
          setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
        } else if (e.key === 'ArrowLeft') {
          setCurrentSlide(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, slides.length, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background text-text-primary flex flex-col overflow-hidden">
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={onClose}
          className="p-3 bg-surface hover:bg-surface-active rounded-full text-text-muted hover:text-text-primary transition-colors border border-border shadow-md"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-12 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {slides.length > 0 && (
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-4xl max-h-full overflow-y-auto no-scrollbar prose prose-lg dark:prose-invert"
            >
               {slides[currentSlide].headingHTML && (
                  <div 
                    className="mb-8 border-b pl-0 border-border pb-4"
                    dangerouslySetInnerHTML={{ __html: slides[currentSlide].headingHTML }}
                  />
               )}
               <div 
                  className=""
                  dangerouslySetInnerHTML={{ __html: slides[currentSlide].contentHTML }}
               />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-20 bg-surface border-t border-border flex items-center justify-between px-8 relative shrink-0">
        <button
          onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
          disabled={currentSlide === 0}
          className="p-3 bg-background hover:bg-surface-active rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border shadow-sm flex items-center gap-2"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="text-text-muted font-medium font-mono text-lg tracking-wider">
          {slides.length > 0 ? `${currentSlide + 1} of ${slides.length}` : '0 of 0'}
        </div>

        <button
          onClick={() => setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1))}
          disabled={currentSlide === slides.length - 1}
          className="p-3 bg-background hover:bg-surface-active rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border shadow-sm flex items-center gap-2"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};
