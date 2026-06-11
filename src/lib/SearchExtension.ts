import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const SearchPluginKey = new PluginKey('search')

export interface SearchOptions {
  searchTerm: string
  searchResultClass: string
  searchResultCurrentClass: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      clearSearch: () => ReturnType;
    }
  }
}

export const SearchExtension = Extension.create<SearchOptions>({
  name: 'search',

  addOptions() {
    return {
      searchTerm: '',
      searchResultClass: 'bg-yellow-200 text-black rounded-[2px] font-medium border-b border-yellow-400',
      searchResultCurrentClass: 'bg-orange-400 text-white rounded-[2px] font-bold border-b-2 border-orange-600',
    }
  },

  addStorage() {
    return {
      results: [],
      currentIndex: -1,
    }
  },

  addCommands() {
    return {
      setSearchTerm: (searchTerm: string) => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(SearchPluginKey, { searchTerm, isNew: true })
        }
        return true
      },
      nextSearchResult: () => ({ tr, dispatch, editor }) => {
        if (dispatch) {
          tr.setMeta(SearchPluginKey, { next: true })
        }
        return true
      },
      previousSearchResult: () => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(SearchPluginKey, { previous: true })
        }
        return true
      },
      clearSearch: () => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(SearchPluginKey, { clear: true })
        }
        return true
      }
    }
  },

  addProseMirrorPlugins() {
    const searchResultClass = this.options.searchResultClass
    const searchResultCurrentClass = this.options.searchResultCurrentClass

    return [
      new Plugin({
        key: SearchPluginKey,
        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              results: [],
              currentIndex: -1,
              searchTerm: ''
            }
          },
          apply(tr, oldState) {
            const meta = tr.getMeta(SearchPluginKey)
            
            let term = oldState.searchTerm
            let currentIndex = oldState.currentIndex
            let results = oldState.results
            let shouldUpdate = false
            let isNewSearch = false
            
            if (meta) {
              if (meta.clear) {
                return {
                  decorations: DecorationSet.empty,
                  results: [],
                  currentIndex: -1,
                  searchTerm: ''
                }
              }
              if (meta.searchTerm !== undefined) {
                term = meta.searchTerm
                shouldUpdate = true
                isNewSearch = true
              }
              if (meta.next) {
                if (results.length > 0) {
                  currentIndex = (currentIndex + 1) % results.length
                  shouldUpdate = true
                }
              }
              if (meta.previous) {
                if (results.length > 0) {
                  currentIndex = (currentIndex - 1 + results.length) % results.length
                  shouldUpdate = true
                }
              }
            }

            if (tr.docChanged) {
               shouldUpdate = true
            }

            if (!shouldUpdate) return oldState

            if (!term) {
               return {
                  decorations: DecorationSet.empty,
                  results: [],
                  currentIndex: -1,
                  searchTerm: term
                }
            }

            const decos: Decoration[] = []
            results = []

            tr.doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text || ''
                let startIndex = 0
                let matchIndex
                const lowerText = text.toLowerCase()
                const lowerTerm = term.toLowerCase()
                
                while ((matchIndex = lowerText.indexOf(lowerTerm, startIndex)) > -1) {
                  const from = pos + matchIndex
                  const to = from + term.length
                  results.push({ from, to })
                  startIndex = matchIndex + term.length
                }
              }
            })

            if (results.length > 0) {
              if (isNewSearch) {
                  currentIndex = 0 
              } else if (currentIndex >= results.length) {
                  currentIndex = 0
              } else if (currentIndex < 0) {
                  currentIndex = 0
              }
            } else {
               currentIndex = -1
            }

            results.forEach((res: any, idx: number) => {
               const isCurrent = idx === currentIndex
               decos.push(Decoration.inline(res.from, res.to, {
                  class: isCurrent ? searchResultCurrentClass : searchResultClass,
                  nodeName: 'span',
               }))
            })

            const decorations = DecorationSet.create(tr.doc, decos)

            return {
              decorations,
              results,
              currentIndex,
              searchTerm: term
            }
          }
        },
        props: {
          decorations(state) {
            return this.getState(state).decorations
          }
        }
      })
    ]
  }
})
