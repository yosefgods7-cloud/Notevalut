import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';

export const WikiLink = Node.create({
  name: 'wikiLink',
  inline: true,
  group: 'inline',
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      target: {
        default: '',
      },
      class: {
        default: 'wiki-link text-accent cursor-pointer underline decoration-accent/30 decoration-2 underline-offset-2 font-medium px-1 bg-accent/10 hover:bg-accent/20 rounded-md transition-colors mx-0.5',
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': 'true',
        'data-target': HTMLAttributes.target
      }),
      ['span', { class: 'wiki-bracket text-accent/50' }, '[['],
      HTMLAttributes.target,
      ['span', { class: 'wiki-bracket text-accent/50' }, ']]'],
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\[\[([^\]]+)\]\]$/,
        type: this.type,
        getAttributes: match => {
          return { target: match[1] };
        },
      }),
    ];
  },
});
