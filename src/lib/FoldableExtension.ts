import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FoldableNodeView } from '../components/FoldableNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    foldableBlock: {
      setFoldableBlock: () => ReturnType;
      toggleFoldableBlock: () => ReturnType;
    }
  }
}

export const FoldableBlock = Node.create({
  name: 'foldableBlock',
  group: 'block',
  content: 'block*',
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      isOpen: {
        default: true,
        parseHTML: element => element.getAttribute('data-is-open') !== 'false',
        renderHTML: attributes => {
          return { 'data-is-open': attributes.isOpen };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="foldable-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'foldable-block' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FoldableNodeView);
  },
  
  addCommands() {
    return {
      setFoldableBlock: () => ({ commands }) => {
        return commands.wrapIn(this.name);
      },
      toggleFoldableBlock: () => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph');
      },
    }
  }
});
