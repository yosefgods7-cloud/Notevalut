import React, { useMemo } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { useStorage } from '../context/StorageContext';
import { Info, BookOpen, AlertCircle, HelpCircle, AlertTriangle, Lightbulb, Star, Zap, Flag } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../types';

const ICONS: Record<string, any> = { Info, BookOpen, AlertCircle, HelpCircle, AlertTriangle, Lightbulb, Star, Zap, Flag };

export const CalloutNodeView = (props: any) => {
  const { data } = useStorage();
  
  const calloutStyles = data.settings.calloutStyles || DEFAULT_SETTINGS.calloutStyles || {};
  
  // Tiptap's NodeViewContent renders the DOM children. We want to style the block if it starts with [!TYPE]
  // We can't easily strip the text using CSS reliably without hacky indentation if the user edits it.
  // Wait, if it's an editor, hiding the tag [!CONCEPT] makes it impossible to edit or delete it!
  // So we should NOT hide [!CONCEPT] in the editor. We should just style the wrapper.
  
  const match = props.node.textContent.match(/^\[!([a-zA-Z0-9_-]+)\]/);
  
  if (match) {
     const type = match[1].toUpperCase();
     const style = calloutStyles[type];
     if (style) {
        const IconComponent = ICONS[style.icon] || Info;
        return (
          <NodeViewWrapper className="callout-block my-4 border-l-4 rounded-r-md p-4 relative transition-colors" style={{ borderColor: style.color, backgroundColor: `${style.color}15` }}>
            <div className="flex items-start gap-3 relative">
               <div className="shrink-0 mt-0.5" style={{ color: style.color }}>
                  <IconComponent size={20} />
               </div>
               <div className="flex-1 w-full min-w-0 callout-content text-text-primary">
                  <div className="font-bold mb-1" style={{ color: style.color }}>{type}</div>
                  <NodeViewContent className="outline-none [&>p:first-child]:text-xs [&>p:first-child]:opacity-50 [&>p:first-child]:font-mono" />
               </div>
            </div>
          </NodeViewWrapper>
        );
     }
  }

  // Fallback normal blockquote
  return (
    <NodeViewWrapper className="border-l-4 border-border pl-4 my-4 italic text-text-secondary">
      <NodeViewContent className="outline-none" />
    </NodeViewWrapper>
  );
};
