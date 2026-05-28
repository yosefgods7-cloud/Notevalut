import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useStorage } from '../context/StorageContext';
import { Network, ZoomIn, ZoomOut, Maximize, X } from 'lucide-react';
import { Note } from '../types';

interface BrainMapProps {
  activeWorkspaceId: string;
  onNavigateToNote: (noteId: string, collectionId: string, workspaceId: string) => void;
  onClose: () => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'note' | 'tag';
  label: string;
  noteRef?: Note; // Reference to the note if type is 'note'
  val: number; // size
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'col' | 'tag'; // col = same folder, tag = hashtag link
}

export const BrainMap: React.FC<BrainMapProps> = ({ activeWorkspaceId, onNavigateToNote, onClose }) => {
  const { data } = useStorage();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute Graph Data
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    
    // Notes in active workspace
    const workspaceNotes = data.notes.filter(n => n.workspaceId === activeWorkspaceId);
    
    const tagSet = new Set<string>();

    workspaceNotes.forEach(note => {
      nodes.push({
        id: `note-${note.id}`,
        type: 'note',
        label: note.title || 'Untitled',
        val: 12,
        noteRef: note
      });

      note.tags.forEach(tag => tagSet.add(tag));
    });

    // Tag nodes
    tagSet.forEach(tag => {
      nodes.push({
        id: `tag-${tag}`,
        type: 'tag',
        label: `#${tag}`,
        val: 18, // slightly larger for tags
      });
    });

    // Links for tags
    workspaceNotes.forEach(note => {
      note.tags.forEach(tag => {
        links.push({
          source: `note-${note.id}`,
          target: `tag-${tag}`,
          type: 'tag'
        });
      });
    });

    // Links for collections (connect notes in the same collection)
    const collectionsMap = new Map<string, string[]>();
    workspaceNotes.forEach(note => {
      const arr = collectionsMap.get(note.collectionId) || [];
      arr.push(`note-${note.id}`);
      collectionsMap.set(note.collectionId, arr);
    });

    collectionsMap.forEach((noteIds) => {
      for (let i = 0; i < noteIds.length - 1; i++) {
        links.push({
          source: noteIds[i],
          target: noteIds[i+1],
          type: 'col'
        });
      }
    });

    return { nodes, links };
  }, [data.notes, activeWorkspaceId]);

  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    svg.attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
      
    zoomRef.current = zoom;

    svg.call(zoom);

    // Initial transform
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(1));

    // Force Simulation
    const simulation = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(graphData.links).id(d => d.id).distance(d => d.type === 'tag' ? 120 : 80))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("collide", d3.forceCollide().radius(d => typeof d !== 'number' ? (d as GraphNode).val + 20 : 20))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX().strength(0.05))
      .force("y", d3.forceY().strength(0.05));
      
    // Apply floating force
    simulation.force("float", () => {
      const alpha = simulation.alpha();
      graphData.nodes.forEach(node => {
        if (node.fx == null && node.fy == null && node.vx !== undefined && node.vy !== undefined) {
          node.vx += (Math.random() - 0.5) * alpha * 6;
          node.vy += (Math.random() - 0.5) * alpha * 6;
        }
      });
    });
    
    // Keep simulation running gently
    simulation.alphaTarget(0.02);

    // Draw Links
    const link = g.append("g")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", "var(--color-text-primary)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "none");

    const nodeG = g.append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .join("g")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Draw Nodes (Circles)
    nodeG.append("circle")
      .attr("r", d => d.val)
      .attr("fill", d => d.type === 'tag' ? "rgba(124, 106, 247, 0.15)" : "rgba(59, 130, 246, 0.15)") // Less colored, transparent
      .attr("stroke", d => d.type === 'tag' ? "rgba(124, 106, 247, 0.8)" : "rgba(59, 130, 246, 0.8)")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .style("filter", "drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.1))")
      .on("click", (event, d) => {
        if (d.type === 'note' && d.noteRef) {
          onNavigateToNote(d.noteRef.id, d.noteRef.collectionId, d.noteRef.workspaceId);
        }
      });

    // Draw Labels
    nodeG.append("text")
      .text(d => d.label)
      .attr("y", d => d.val + 15)
      .attr("text-anchor", "middle")
      .attr("font-size", d => d.type === 'tag' ? "12px" : "10px")
      .attr("font-weight", d => d.type === 'tag' ? "bold" : "normal")
      .attr("fill", d => d.type === 'tag' ? "var(--color-accent)" : "var(--color-text-primary)")
      .attr("pointer-events", "none")
      .style("text-shadow", "0 1px 3px var(--color-background), 0 -1px 3px var(--color-background), 1px 0 3px var(--color-background), -1px 0 3px var(--color-background)");

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      nodeG
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graphData, onNavigateToNote]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, factor);
  };

  const handleReset = () => {
    if (!svgRef.current || !containerRef.current || !zoomRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(1));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-surface/80 backdrop-blur-sm p-2 rounded-lg border border-border shadow-sm">
        <Network size={20} className="text-accent" />
        <span className="font-semibold text-text-primary text-sm">Neurolink System</span>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-surface/80 backdrop-blur-sm p-1 rounded-lg border border-border shadow-sm">
        <button className="p-2 hover:bg-surface border-border rounded-md text-text-muted hover:text-text-primary transition-colors" onClick={() => handleZoom(1.2)}>
          <ZoomIn size={16} />
        </button>
        <button className="p-2 hover:bg-surface border-border rounded-md text-text-muted hover:text-text-primary transition-colors" onClick={() => handleZoom(0.8)}>
          <ZoomOut size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <button className="p-2 hover:bg-surface border-border rounded-md text-text-muted hover:text-text-primary transition-colors" onClick={handleReset}>
          <Maximize size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <button title="Exit Brain Map" className="p-2 hover:bg-red-500/10 hover:text-red-500 border-border rounded-md text-text-muted transition-colors" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 w-full h-full cursor-crosshair">
        <svg ref={svgRef} className="w-full h-full" style={{ outline: 'none' }} />
      </div>

      {graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-text-muted text-sm bg-surface p-4 rounded-lg border border-border shadow-xl">
             No notes or hashtags found in this workspace. Create notes with hashtags to build the brain map.
          </p>
        </div>
      )}
    </div>
  );
};
