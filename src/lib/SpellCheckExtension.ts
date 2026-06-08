import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { isSpelledCorrectly } from './dictionary';

export const SpellCheckPluginKey = new PluginKey('spellcheck');

let isSpellCheckEnabled = true;

export function setSpellCheckEnabled(enabled: boolean) {
  isSpellCheckEnabled = enabled;
}

export const SpellCheckExtension = Extension.create({
  name: 'spellCheck',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: SpellCheckPluginKey,
        state: {
          init(config, instance) {
            return DecorationSet.empty;
          },
          apply(tr, old, oldState, newState) {
            if (!isSpellCheckEnabled) return DecorationSet.empty;
            
            if (tr.docChanged || tr.getMeta(SpellCheckPluginKey) === 'force-update') {
               const decorations: Decoration[] = [];
               const doc = newState.doc;
               
               doc.descendants((node, pos) => {
                 if (node.isText && node.text) {
                   let match;
                   const regex = /([a-zA-Z]+(?:'[a-zA-Z]+)?)/g;
                   while ((match = regex.exec(node.text)) !== null) {
                     const word = match[0];
                     if (word.length > 1 && !isSpelledCorrectly(word)) {
                       decorations.push(
                         Decoration.inline(pos + match.index!, pos + match.index! + word.length, {
                           nodeName: 'span',
                           class: 'spell-error underline decoration-red-500 decoration-wavy cursor-pointer',
                           'data-word': word,
                         })
                       );
                     }
                   }
                 }
               });
               
               return DecorationSet.create(doc, decorations);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
