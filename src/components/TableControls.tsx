import React, { useEffect, useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Trash2, Copy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, GripVertical, GripHorizontal } from 'lucide-react';

interface TableControlsProps {
  editor: Editor | null;
}

type StdNode = globalThis.Node;

export const TableControls: React.FC<TableControlsProps> = ({ editor }) => {
  const [activeTable, setActiveTable] = useState<HTMLElement | null>(null);
  const [tableRect, setTableRect] = useState<any>(null);
  const [cols, setCols] = useState<{left: number, width: number, index: number}[]>([]);
  const [rows, setRows] = useState<{top: number, height: number, index: number}[]>([]);
  const [activeMenu, setActiveMenu] = useState<{type: 'row' | 'col', index: number} | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDragOn, setIsDragOn] = useState(false);

  const calculateHandles = () => {
    if (!editor || isDragOn) return;
    const view = editor.view;
    const selection = view.state.selection;
    
    let tableNode: HTMLElement | null = null;
    
    // First try finding it via native DOM (most reliable for clicks/cursors inside the table)
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0) {
       let node = domSelection.anchorNode as Node | null;
       if (node && node.nodeType !== Node.ELEMENT_NODE) {
          node = node.parentElement;
       }
       if (node) {
          const element = node as HTMLElement;
          const closestTable = element.closest('table');
          if (closestTable && editor.view.dom.contains(closestTable)) {
             tableNode = closestTable;
          }
       }
    }

    if (!tableNode) {
      try {
        const { $from } = selection;
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === 'table') {
            const dom = view.nodeDOM($from.before(depth)) as HTMLElement;
            if (dom) {
               if (dom.tagName === 'TABLE') {
                  tableNode = dom;
               } else {
                  tableNode = dom.querySelector('table');
               }
            }
            break;
          }
        }
      } catch (e) {}
    }

    if (!tableNode && editor.isActive('table')) {
       // Only fallback if there's exactly one table, else it's wrong to pick the first one 
       // if we're theoretically in a table but can't find it. 
       const tables = view.dom.querySelectorAll('.ProseMirror table');
       if (tables.length === 1) {
           tableNode = tables[0] as HTMLTableElement;
       }
    }

    if (tableNode) {
      setActiveTable(tableNode);
      const container = document.getElementById('editor-container-relative');
      if (!container) return;
      const editorRect = container.getBoundingClientRect();
      const tr = tableNode.getBoundingClientRect();
      
      const tRect = {
        top: tr.top - editorRect.top,
        left: tr.left - editorRect.left,
        width: tr.width,
        height: tr.height
      };
      setTableRect(tRect);

      const firstRow = tableNode.querySelector('tr');
      if (firstRow) {
        const cells = Array.from(firstRow.children) as HTMLElement[];
        setCols(cells.map((c, i) => {
          const cr = c.getBoundingClientRect();
          return { left: cr.left - tr.left, width: cr.width, index: i };
        }));
      }

      const allRows = Array.from(tableNode.querySelectorAll('tr')) as HTMLElement[];
      setRows(allRows.map((r, i) => {
        const rr = r.getBoundingClientRect();
        return { top: rr.top - tr.top, height: rr.height, index: i };
      }));
    } else {
      setActiveTable(null);
      setActiveMenu(null);
    }
  };

  useEffect(() => {
    if (!editor) return;
    editor.on('selectionUpdate', calculateHandles);
    editor.on('transaction', calculateHandles);
    editor.view.dom.addEventListener('scroll', calculateHandles, { passive: true });
    window.addEventListener('resize', calculateHandles);
    const interval = setInterval(calculateHandles, 1000);

    return () => {
      editor.off('selectionUpdate', calculateHandles);
      editor.off('transaction', calculateHandles);
      editor.view.dom.removeEventListener('scroll', calculateHandles);
      window.removeEventListener('resize', calculateHandles);
      clearInterval(interval);
    };
  }, [editor, isDragOn]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as StdNode)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!editor || !editor.isEditable || !activeTable || !tableRect) return null;

  const getTableData = () => {
    const view = editor.view;
    const { $from } = view.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      if ($from.node(depth).type.name === 'table') {
        return {
          node: $from.node(depth),
          pos: $from.before(depth)
        };
      }
    }
    return null;
  };

  const manualTableUpdate = (json: any, pos: number, size: number) => {
    try {
      const newNode = editor.schema.nodeFromJSON(json);
      const tr = editor.view.state.tr.replaceWith(pos, pos + size, newNode);
      editor.view.dispatch(tr);
    } catch(e) {
      console.error("Failed to manipulate table", e);
    }
  };

  const hackSelection = (type: 'col'|'row', index: number, callback: () => void) => {
    let cell: HTMLElement | null = null;
    if (activeTable) {
      if (type === 'col') {
        const firstRow = activeTable.querySelector('tr');
        if (firstRow) {
           const cells = Array.from(firstRow.children) as HTMLElement[];
           cell = cells[index];
        }
      } else {
        const allRows = Array.from(activeTable.querySelectorAll('tr')) as HTMLElement[];
        const targetRow = allRows[index];
        if (targetRow) {
           const cells = Array.from(targetRow.children) as HTMLElement[];
           cell = cells[0];
        }
      }
    }

    if (cell) {
      const rect = cell.getBoundingClientRect();
      // Use exactly the center of the target cell
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      const pos = editor.view.posAtCoords({ left: x, top: y });
      if (pos) {
        editor.chain().focus().setTextSelection(pos.pos).run();
        // Give the editor a tick to update selection
        setTimeout(callback, 20);
        return;
      }
    }
    
    // Fallback if cell not found or coords failed
    callback();
  };

  const handleAction = (action: string) => {
    if (!activeMenu) return;
    const { type, index } = activeMenu;
    setActiveMenu(null);

    hackSelection(type, index, () => {
      const data = getTableData();
      if (!data) return;

      if (action === 'delete') {
         if (type === 'col') editor.chain().focus().deleteColumn().run();
         else editor.chain().focus().deleteRow().run();
         return;
      }
      
      if (action === 'add-before' || action === 'add-after') {
         if (type === 'col') {
           if (action === 'add-before') editor.chain().focus().addColumnBefore().run();
           else editor.chain().focus().addColumnAfter().run();
         } else {
           if (action === 'add-before') editor.chain().focus().addRowBefore().run();
           else editor.chain().focus().addRowAfter().run();
         }
         return;
      }

      if (action === 'duplicate') {
        const json = data.node.toJSON();
        if (type === 'row') {
           const rowsData = json.content || [];
           const r1 = rowsData[index];
           if (r1) {
             const copy = JSON.parse(JSON.stringify(r1));
             rowsData.splice(index + 1, 0, copy);
             manualTableUpdate(json, data.pos, data.node.nodeSize);
           }
        } else if (type === 'col') {
           const rowsData = json.content || [];
           rowsData.forEach((row: any) => {
             const cells = row.content || [];
             const c1 = cells[index];
             if (c1) {
               const copy = JSON.parse(JSON.stringify(c1));
               cells.splice(index + 1, 0, copy);
             }
           });
           manualTableUpdate(json, data.pos, data.node.nodeSize);
        }
      }
    });
  };

  const handleDragStart = (e: React.DragEvent, type: 'col'|'row', index: number) => {
    setIsDragOn(true);
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, index }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetType: 'col'|'row', targetIndex: number) => {
    setIsDragOn(false);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      const { type, index: sourceIndex } = JSON.parse(dataStr);
      if (type !== targetType || sourceIndex === targetIndex) return;

      const data = getTableData();
      if (!data) return;

      const json = data.node.toJSON();
      if (type === 'row') {
         const rowsData = json.content || [];
         const [moved] = rowsData.splice(sourceIndex, 1);
         rowsData.splice(targetIndex, 0, moved);
      } else if (type === 'col') {
         const rowsData = json.content || [];
         rowsData.forEach((row: any) => {
             const cells = row.content || [];
             if (sourceIndex < cells.length) {
               const [moved] = cells.splice(sourceIndex, 1);
               cells.splice(targetIndex, 0, moved);
             }
         });
      }
      manualTableUpdate(json, data.pos, data.node.nodeSize);
    } catch(err) {
      console.error(err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div 
      className="absolute pointer-events-none z-50" 
      style={{ top: tableRect.top, left: tableRect.left, width: tableRect.width, height: tableRect.height }}
    >
      {/* Col Handles */}
      {cols.map(c => (
        <div 
          key={`col-${c.index}`}
          className="absolute pointer-events-auto flex justify-center group"
          style={{ top: -20, left: c.left, width: c.width, height: 20 }}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'col', c.index)}
        >
          <div 
             draggable
             onDragStart={(e) => handleDragStart(e, 'col', c.index)}
             onDragEnd={() => setIsDragOn(false)}
             className="w-6 h-4 bg-surface hover:bg-surface-hover border border-border shadow-sm rounded flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing"
             onMouseDown={(e) => { 
                e.stopPropagation(); 
                if (activeMenu?.type === 'col' && activeMenu.index === c.index) setActiveMenu(null);
                else setActiveMenu({ type: 'col', index: c.index }); 
             }}
             title="Drag to move, click for options"
          >
             <GripHorizontal size={12} className="text-text-muted" />
          </div>
          
          {activeMenu?.type === 'col' && activeMenu.index === c.index && (
            <div ref={menuRef} className="absolute top-6 left-1/2 -translate-x-1/2 bg-surface border border-border rounded-md shadow-xl p-1 flex flex-col gap-1 w-32 z-[60]">
              <button onMouseDown={(e) => { e.preventDefault(); handleAction('add-before'); }} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-active rounded-sm w-full font-medium text-text-primary"><ArrowLeft size={12}/> Add Left</button>
              <button onMouseDown={(e) => { e.preventDefault(); handleAction('add-after'); }} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-active rounded-sm w-full font-medium text-text-primary"><ArrowRight size={12}/> Add Right</button>
              <div className="w-full h-px bg-border my-0.5" />
              <button onMouseDown={(e) => { e.preventDefault(); handleAction('duplicate'); }} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-active rounded-sm w-full text-accent font-medium"><Copy size={12}/> Duplicate</button>
              <button onMouseDown={(e) => { e.preventDefault(); handleAction('delete'); }} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-active text-red-500 rounded-sm w-full font-medium"><Trash2 size={12}/> Delete</button>
            </div>
          )}
        </div>
      ))}

      {/* Row Handles */}
      {rows.map(r => (
        <div 
          key={`row-${r.index}`}
          className="absolute pointer-events-auto flex items-center justify-end group"
          style={{ top: r.top, left: -20, width: 20, height: r.height }}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'row', r.index)}
        >
          <div 
             draggable
             onDragStart={(e) => handleDragStart(e, 'row', r.index)}
             onDragEnd={() => setIsDragOn(false)}
             className="w-4 h-6 bg-surface hover:bg-surface-hover border border-border shadow-sm rounded flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing mr-1"
             onMouseDown={(e) => { 
                e.stopPropagation(); 
                if (activeMenu?.type === 'row' && activeMenu.index === r.index) setActiveMenu(null);
                else setActiveMenu({ type: 'row', index: r.index }); 
             }}
             title="Drag to move, click for options"
          >
             <GripVertical size={12} className="text-text-muted" />
          </div>

          {activeMenu?.type === 'row' && activeMenu.index === r.index && (
            <div ref={menuRef} className="absolute left-6 top-1/2 -translate-y-1/2 bg-surface border border-border rounded-md shadow-xl p-1 flex flex-col gap-1 w-32 z-[60]">
              <button onMouseDown={(e) => { e.preventDefault(); handleAction('add-before'); }} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-active rounded-sm w-full font-medium text-text-primary"><ArrowUp size={12}/> Add Above</button>
              <button onMouseDown={(e) => { e.preventDefault(); handleAction('add-after'); }} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-active rounded-sm w-full font-medium text-text-primary"><ArrowDown size={12}/> Add Below</button>
              <div className="w-full h-px bg-border my-0.5" />
              <button onMouseDown={(e) => { e.preventDefault(); handleAction('duplicate'); }} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-active rounded-sm w-full text-accent font-medium"><Copy size={12}/> Duplicate</button>
              <button onMouseDown={(e) => { e.preventDefault(); handleAction('delete'); }} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-active text-red-500 rounded-sm w-full font-medium"><Trash2 size={12}/> Delete</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
