import React, { useMemo, useRef, useEffect, useState } from "react";
import { X, Network, FileText, Hash, Link as LinkIcon } from "lucide-react";
import { useStorage } from "../context/StorageContext";
import { Note } from "../types";
import { motion, AnimatePresence } from "motion/react";
import * as d3 from "d3";
import { cn } from "../lib/utils";

interface SmartSearchPanelProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToNote: (noteId: string, collectionId: string, workspaceId: string) => void;
}

interface MiniGraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  isCurrent: boolean;
  type: 'note' | 'tag';
}

interface MiniGraphLink extends d3.SimulationLinkDatum<MiniGraphNode> {
  source: string | MiniGraphNode;
  target: string | MiniGraphNode;
  type: string;
}

const wikilinkRegex = /\[\[(.*?)\]\]/g;

export const SmartSearchPanel: React.FC<SmartSearchPanelProps> = ({
  noteId,
  isOpen,
  onClose,
  onNavigateToNote,
}) => {
  const { data, loadAllNotes } = useStorage();

  useEffect(() => {
    if (isOpen) {
      loadAllNotes();
    }
  }, [isOpen, loadAllNotes]);

  const currentNote = data.notes.find((n) => n.id === noteId);
  const svgRef = useRef<SVGSVGElement>(null);

  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [activeFilterFolder, setActiveFilterFolder] = useState<string | null>(null);
  const [activeFilterDate, setActiveFilterDate] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Determine Connections
  const { connectedNotes, tags, links } = useMemo(() => {
    if (!currentNote) return { connectedNotes: [], tags: [], links: [] };

    const currentTags = currentNote.tags || [];
    const content = currentNote.content || "";
    
    // Exact titles
    const currentTitle = (currentNote.title || "Untitled").trim().toLowerCase();

    // Extract links from current note
    const outgoingLinks = Array.from(content.matchAll(wikilinkRegex)).map(m => m[1].trim().toLowerCase());

    const connected: { note: Note; sharedTags: string[]; isWikilink: boolean }[] = [];
    
    data.notes.forEach(note => {
      if (note.id === currentNote.id || note.isDeleted) return;

      let hasWikilink = false;
      const noteTitle = (note.title || "Untitled").trim().toLowerCase();

      // Shares tags
      const noteTags = note.tags || [];
      const sharedTags = currentTags.filter(t => noteTags.includes(t));

      // Has outgoing wikilink from currentnote to this note
      if (outgoingLinks.includes(noteTitle)) hasWikilink = true;

      // Has incoming wikilink from this note to currentNote
      const noteContent = note.content || "";
      const noteOutgoingLinks = Array.from(noteContent.matchAll(wikilinkRegex)).map(m => m[1].trim().toLowerCase());
      if (currentTitle && noteOutgoingLinks.includes(currentTitle)) hasWikilink = true;

      if (sharedTags.length > 0 || hasWikilink) {
        connected.push({ note, sharedTags, isWikilink: hasWikilink });
      }
    });

    return { connectedNotes: connected, tags: currentTags, links: outgoingLinks };
  }, [currentNote, data.notes]);

  // Mini Brain Map
  useEffect(() => {
    if (!isOpen || !currentNote || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear prev

    const width = 300;
    const height = 250;

    const nodes: MiniGraphNode[] = [];
    const d3Links: MiniGraphLink[] = [];

    nodes.push({ id: currentNote.id, label: currentNote.title || "Untitled", isCurrent: true, type: 'note' });

    // Add tag nodes
    tags.forEach(tag => {
      nodes.push({ id: `tag-${tag}`, label: `#${tag}`, isCurrent: false, type: 'tag' });
      d3Links.push({ source: currentNote.id, target: `tag-${tag}`, type: 'tag' });
    });

    // Apply filters before building the graph and list
    const filteredConnectedNotes = connectedNotes.filter(({ note, sharedTags }) => {
      if (activeFilterTag && !sharedTags.includes(activeFilterTag)) return false;
      if (activeFilterFolder && note.collectionId !== activeFilterFolder) return false;
      if (activeFilterDate && new Date(note.createdAt).toLocaleDateString() !== activeFilterDate) return false;
      return true;
    });

    filteredConnectedNotes.forEach(({ note, sharedTags, isWikilink }) => {
      nodes.push({ id: note.id, label: note.title || "Untitled", isCurrent: false, type: 'note' });
      
      if (sharedTags.length > 0) {
        sharedTags.forEach(tag => {
           d3Links.push({ source: note.id, target: `tag-${tag}`, type: 'tag' });
        });
      }
      
      if (isWikilink || sharedTags.length === 0) { // Fallback to wikilink style if connected
         // Linked via wikilink
         d3Links.push({ source: currentNote.id, target: note.id, type: 'wikilink' });
      }
    });

    const simulation = d3
      .forceSimulation<MiniGraphNode>(nodes)
      .force("link", d3.forceLink<MiniGraphNode, MiniGraphLink>(d3Links).id((d) => d.id).distance(60))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(20));

    const g = svg.append("g");

    const link = g
      .append("g")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(d3Links)
      .join("line")
      .attr("stroke", d => d.type === 'tag' ? "var(--color-accent)" : "var(--color-text-secondary)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", d => d.type === 'wikilink' ? "4,4" : "none");

    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "mini-node")
      .call(
        d3.drag<any, MiniGraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node.append("circle")
      .attr("r", d => d.isCurrent ? 10 : (d.type === 'tag' ? 6 : 8))
      .attr("fill", d => d.isCurrent ? "var(--color-accent)" : (d.type === 'tag' ? "transparent" : "var(--color-surface-hover)"))
      .attr("stroke", d => d.type === 'tag' ? "var(--color-accent)" : "var(--color-border)")
      .attr("stroke-width", 2);

    node.append("text")
      .text(d => d.label)
      .attr("x", 12)
      .attr("y", 4)
      .attr("fill", "var(--color-text-primary)")
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .style("opacity", d => d.isCurrent ? 1 : 0.7);

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
                 .scaleExtent([0.5, 2])
                 .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
    };

  }, [isOpen, currentNote, connectedNotes, tags, activeFilterTag, activeFilterFolder, activeFilterDate]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const nodes = svg.selectAll<SVGGElement, MiniGraphNode>(".mini-node");
    
    nodes.select("circle").transition().duration(200)
      .attr("r", d => d.id === hoveredNodeId ? 12 : (d.isCurrent ? 10 : (d.type === 'tag' ? 6 : 8)))
      .attr("fill", d => d.id === hoveredNodeId ? "var(--color-accent)" : (d.isCurrent ? "var(--color-accent)" : (d.type === 'tag' ? "transparent" : "var(--color-surface-hover)")))
      .attr("stroke", d => d.id === hoveredNodeId ? "var(--color-accent)" : (d.type === 'tag' ? "var(--color-accent)" : "var(--color-border)"));

    nodes.select("text").transition().duration(200)
      .style("opacity", d => (d.id === hoveredNodeId || d.isCurrent) ? 1 : 0.7)
      .style("font-weight", d => d.id === hoveredNodeId ? "bold" : "normal");
  }, [hoveredNodeId]);

  const filteredConnectedNotes = useMemo(() => {
    return connectedNotes.filter(({ note, sharedTags }) => {
      if (activeFilterTag && !sharedTags.includes(activeFilterTag)) return false;
      if (activeFilterFolder && note.collectionId !== activeFilterFolder) return false;
      if (activeFilterDate && new Date(note.createdAt).toLocaleDateString() !== activeFilterDate) return false;
      return true;
    });
  }, [connectedNotes, activeFilterTag, activeFilterFolder, activeFilterDate]);


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="fixed top-0 left-0 w-80 h-full bg-surface border-r border-border z-50 flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold">
              <Network size={18} className="text-accent" /> Smart Search
            </h3>
            <button onClick={onClose} className="p-1 hover:bg-surface-active rounded-md text-text-muted hover:text-text-primary">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Top Brain Map */}
            <div className="h-[250px] w-full border-b border-border bg-background bg-[radial-gradient(var(--color-surface-active)_1px,transparent_1px)] [background-size:16px_16px]">
              <svg ref={svgRef} className="w-full h-full" />
            </div>

            {/* Content List */}
            <div className="p-4 space-y-6 text-sm">
              
              <div className="space-y-2">
                <h4 className="text-xs tracking-wider text-text-muted uppercase font-semibold">Filter Connections</h4>
                <div className="flex flex-wrap gap-2">
                   {/* Unique Tags */}
                   {Array.from(new Set(connectedNotes.flatMap(n => n.sharedTags))).map(tag => (
                      <button 
                         key={tag}
                         onClick={() => setActiveFilterTag(activeFilterTag === tag ? null : tag)}
                         className={cn("px-2 py-1 rounded text-xs transition-colors", activeFilterTag === tag ? "bg-accent text-white" : "bg-surface-active text-text-secondary hover:bg-surface-hover")}
                      >
                         #{tag}
                      </button>
                   ))}
                   {/* Unique Folders */}
                   {Array.from(new Set(connectedNotes.map(n => n.note.collectionId))).map(colId => {
                      const col = data.collections.find(c => c.id === colId);
                      if (!col) return null;
                      return (
                         <button 
                            key={colId}
                            onClick={() => setActiveFilterFolder(activeFilterFolder === colId ? null : colId)}
                            className={cn("px-2 py-1 rounded text-xs transition-colors", activeFilterFolder === colId ? "bg-accent text-white" : "bg-surface-active text-text-secondary hover:bg-surface-hover")}
                         >
                            📁 {col.name}
                         </button>
                      )
                   })}
                   {/* Unique Dates */}
                   {Array.from(new Set(connectedNotes.map(n => new Date(n.note.createdAt).toLocaleDateString()))).map(date => (
                      <button 
                         key={date}
                         onClick={() => setActiveFilterDate(activeFilterDate === date ? null : date)}
                         className={cn("px-2 py-1 rounded text-xs transition-colors", activeFilterDate === date ? "bg-accent text-white" : "bg-surface-active text-text-secondary hover:bg-surface-hover")}
                      >
                         📅 {date}
                      </button>
                   ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs tracking-wider text-text-muted uppercase font-semibold mb-3">Connected Notes</h4>
                {filteredConnectedNotes.length === 0 ? (
                  <p className="text-text-muted italic text-xs">No direct connections found.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredConnectedNotes.map(({ note: n, sharedTags: shared, isWikilink }) => {
                      return (
                        <div 
                          key={n.id}
                          className="p-3 bg-background border border-border rounded-lg hover:border-accent/50 cursor-pointer transition-colors group"
                          onClick={() => {
                            onNavigateToNote(n.id, n.collectionId, n.workspaceId);
                            setHoveredNodeId(null);
                            onClose();
                          }}
                          onMouseEnter={() => setHoveredNodeId(n.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium flex items-center gap-2 truncate group-hover:text-accent transition-colors">
                              <FileText size={14} className="text-text-muted" />
                              {n.title || "Untitled"}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mt-2">
                            {shared.map(t => (
                              <span key={t} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                <Hash size={10} /> {t}
                              </span>
                            ))}
                            {isWikilink && (
                              <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                <LinkIcon size={10} /> Linked
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
