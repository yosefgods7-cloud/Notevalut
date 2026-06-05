import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { FoldVertical, UnfoldVertical } from 'lucide-react';

export const FoldableNodeView = (props: any) => {
  const { node, updateAttributes } = props;
  const isOpen = Object.prototype.hasOwnProperty.call(node.attrs, 'isOpen') ? node.attrs.isOpen : true;

  return (
    <NodeViewWrapper className="relative border border-border rounded-md my-2 group transition-all duration-200">
      <div 
        className="absolute top-1 right-1 cursor-pointer p-1 bg-surface/80 hover:bg-surface-hover rounded z-10 border border-transparent hover:border-border text-text-muted transition-opacity opacity-0 group-hover:opacity-100" 
        onClick={() => updateAttributes({ isOpen: !isOpen })}
        contentEditable={false}
        title={isOpen ? "Fold text" : "Unfold text"}
      >
        {isOpen ? <FoldVertical size={14} /> : <UnfoldVertical size={14} />}
      </div>
      
      <div 
         className={`w-full p-3 transition-all ${!isOpen ? 'max-h-[44px] overflow-hidden opacity-50 cursor-pointer' : ''}`} 
         style={!isOpen ? { WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)' } : {}}
         onClick={() => { if (!isOpen) updateAttributes({ isOpen: true }) }}
      >
        <NodeViewContent className="min-h-[20px] outline-none" />
      </div>
    </NodeViewWrapper>
  );
};
