import React, { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import { useStorage } from "../context/StorageContext";
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize,
  X,
  Download,
  Palette,
  Search,
  Filter,
} from "lucide-react";
import { Note, BrainMapFilters } from "../types";

interface BrainMapProps {
  activeWorkspaceId: string;
  onNavigateToNote: (
    noteId: string,
    collectionId: string,
    workspaceId: string,
  ) => void;
  onClose: () => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: "workspace" | "collection" | "note" | "tag";
  label: string;
  noteRef?: Note; // Reference to the note if type is 'note'
  val: number; // size
  dimmed?: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: "parent" | "tag" | "wikilink";
}

export const BrainMap: React.FC<BrainMapProps> = ({
  activeWorkspaceId,
  onNavigateToNote,
  onClose,
}) => {
  const { data, loadAllNotes, saveData } = useStorage();

  useEffect(() => {
    loadAllNotes();
  }, [loadAllNotes]);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [colorTheme, setColorTheme] = useState<
    "default" | "neon" | "pastel" | "monochrome"
  >("default");

  const themes = {
    default: {
      workspace: "var(--color-text-primary)",
      collection: "var(--color-text-secondary)",
      tag: "var(--color-accent)",
      note: "rgba(59, 130, 246, 0.4)",
      linkTag: "var(--color-accent)",
      linkDefault: "var(--color-text-secondary)",
    },
    neon: {
      workspace: "#ff00ff",
      collection: "#00ffff",
      tag: "#00ff00",
      note: "rgba(255, 255, 0, 0.4)",
      linkTag: "#00ff00",
      linkDefault: "#00ffff",
    },
    pastel: {
      workspace: "#ffb3ba",
      collection: "#ffdfba",
      tag: "#ffffba",
      note: "rgba(186, 255, 201, 0.4)",
      linkTag: "#ffffba",
      linkDefault: "#ffdfba",
    },
    monochrome: {
      workspace: "#333333",
      collection: "#666666",
      tag: "#cccccc",
      note: "rgba(153, 153, 153, 0.4)",
      linkTag: "#cccccc",
      linkDefault: "#666666",
    },
  };

  const [showAllHolders, setShowAllHolders] = useState<boolean>(true);
  
  const bmSettings = data.settings.plugins?.brainMap;
  const initialFilters: BrainMapFilters = (bmSettings?.rememberLastFilter ? data.brainMapLastFilters : null) 
    || bmSettings?.defaultFilters 
    || {
      searchTerm: "",
      tags: [],
      folders: [],
      dateRange: { start: null, end: null },
      connectionTypes: { wikilinks: true, tags: true },
    };

  const [filters, setFilters] = useState<BrainMapFilters>(initialFilters);

  // Auto-save filters if enabled
  useEffect(() => {
    if (bmSettings?.rememberLastFilter) {
      const timer = setTimeout(() => {
        saveData({ ...data, brainMapLastFilters: filters });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filters, bmSettings?.rememberLastFilter, saveData, data]);

  // Compute Graph Data
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Add central "Universe" node to connect workspaces (only if showing all)
    if (showAllHolders) {
      nodes.push({
        id: "universe",
        type: "tag", // reuse styling
        label: "My Data",
        val: 5,
      });
    }

    const targetWorkspaces = showAllHolders 
      ? data.workspaces 
      : data.workspaces.filter(ws => ws.id === activeWorkspaceId);

    const workspaceIds = new Set(targetWorkspaces.map(w => w.id));

    const targetCollections = data.collections.filter(c => workspaceIds.has(c.workspaceId));
    const collectionIds = new Set(targetCollections.map(c => c.id));

    // Notes
    const tagSet = new Set<string>();
    let allValidNotes = data.notes.filter(
      (n) =>
        !n.isDeleted &&
        (collectionIds.has(n.collectionId) || workspaceIds.has(n.workspaceId)),
    );

    // Compute available attributes for filters before applying filters
    const availableTags = Array.from(
      new Set(allValidNotes.flatMap((n) => n.tags)),
    );
    const availableFolders = Array.from(
      new Set(allValidNotes.map((n) => n.collectionId)),
    );
    const availableDates = Array.from(
      new Set(
        allValidNotes.map((n) => new Date(n.createdAt).toLocaleDateString()),
      ),
    );

    const checkNoteMatches = (n: Note) => {
      // Tags
      if (filters.tags.length > 0) {
        if (!filters.tags.some((t) => n.tags.includes(t))) return false;
      }
      // Folders
      if (filters.folders.length > 0) {
        if (!filters.folders.includes(n.collectionId)) return false;
      }
      // Dates
      if (filters.dateRange.start || filters.dateRange.end) {
        const d = new Date(n.createdAt).getTime();
        const start = filters.dateRange.start ? new Date(filters.dateRange.start).getTime() : 0;
        const end = filters.dateRange.end ? new Date(filters.dateRange.end).getTime() : Infinity;
        // set end to end of day if it exists
        const endOfDay = filters.dateRange.end ? new Date(filters.dateRange.end).setHours(23,59,59,999) : Infinity;
        if (d < start || d > endOfDay) return false;
      }
      // Search term
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        if (!n.title.toLowerCase().includes(term) && !n.content.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    };

    const isFilterActive = filters.tags.length > 0 || filters.folders.length > 0 || filters.dateRange.start || filters.dateRange.end || filters.searchTerm;

    const matchedNotes = new Set<string>();
    allValidNotes.forEach((n) => {
       if (!isFilterActive || checkNoteMatches(n)) {
          matchedNotes.add(n.id);
       }
    });

    const hideNonMatching = bmSettings?.nonMatchingBehavior === "hide" && isFilterActive;

    let targetNotes = allValidNotes;
    if (hideNonMatching) {
      targetNotes = targetNotes.filter((n) => matchedNotes.has(n.id));
    }

    const activeCollectionIds = new Set(targetNotes.map((n) => n.collectionId));
    const activeWorkspaceIds = new Set(
      targetCollections
        .filter((c) => activeCollectionIds.has(c.id))
        .map((c) => c.workspaceId),
    );

    // Workspaces (Holders)
    targetWorkspaces.forEach((ws) => {
      if (hideNonMatching && !activeWorkspaceIds.has(ws.id)) return;
      
      const hasMatchInWs = targetNotes.some(n => n.workspaceId === ws.id && matchedNotes.has(n.id) || 
         targetCollections.some(c => c.workspaceId === ws.id && targetNotes.some(n2 => n2.collectionId === c.id && matchedNotes.has(n2.id)))
      );
      const isDimmed = isFilterActive && !hasMatchInWs;

      nodes.push({
        id: `workspace-${ws.id}`,
        type: "workspace",
        label: ws.name,
        val: 35,
        dimmed: isDimmed,
      });

      if (showAllHolders) {
        links.push({
          source: `workspace-${ws.id}`,
          target: "universe",
          type: "parent",
        });
      }
    });

    // Collections
    targetCollections.forEach((col) => {
      if (hideNonMatching && !activeCollectionIds.has(col.id)) return;

      const hasMatchInCol = targetNotes.some(n => n.collectionId === col.id && matchedNotes.has(n.id));
      const isDimmed = isFilterActive && !hasMatchInCol;

      nodes.push({
        id: `collection-${col.id}`,
        type: "collection",
        label: col.name,
        val: 20,
        dimmed: isDimmed,
      });

      // Link Collection -> Workspace
      links.push({
        source: `collection-${col.id}`,
        target: `workspace-${col.workspaceId}`,
        type: "parent",
      });
    });

    targetNotes.forEach((note) => {
      const isDimmed = isFilterActive && !matchedNotes.has(note.id);
      nodes.push({
        id: `note-${note.id}`,
        type: "note",
        label: note.title || "Untitled",
        val: 12,
        noteRef: note,
        dimmed: isDimmed,
      });

      // Link Note -> Collection
      links.push({
        source: `note-${note.id}`,
        target: `collection-${note.collectionId}`,
        type: "parent",
      });

      note.tags.forEach((tag) => tagSet.add(tag));
    });

    // Tag nodes
    tagSet.forEach((tag) => {
      if (hideNonMatching) {
        const hasMatchWithTag = targetNotes.some(n => n.tags.includes(tag) && matchedNotes.has(n.id));
        if (!hasMatchWithTag) return; // Hide tags that don't belong to any matched note if hide mode
      }
      
      const hasMatchWithTag = targetNotes.some(n => n.tags.includes(tag) && matchedNotes.has(n.id));
      const isDimmed = isFilterActive && !hasMatchWithTag;

      nodes.push({
        id: `tag-${tag}`,
        type: "tag",
        label: `#${tag}`,
        val: 18,
        dimmed: isDimmed,
      });
    });

    // Links for tags and wikilinks
    targetNotes.forEach((note) => {
      // Tags
      if (filters.connectionTypes.tags !== false) {
        note.tags.forEach((tag) => {
          if (hideNonMatching && (!matchedNotes.has(note.id) || !targetNotes.some(n => n.tags.includes(tag) && matchedNotes.has(n.id)))) return;
          links.push({
            source: `note-${note.id}`,
            target: `tag-${tag}`,
            type: "tag",
          });
        });
      }

      // Wikilinks
      if (filters.connectionTypes.wikilinks !== false) {
        // Simple mock parse: Look for [[Note Title]]
        const titleMatches = Array.from(note.content.matchAll(/\[\[(.*?)\]\]/g)).map(m => m[1]);
        if (titleMatches.length > 0) {
          titleMatches.forEach(title => {
            // Find note by title
            const targetNoteMatch = targetNotes.find(n => n.title.toLowerCase() === title.toLowerCase());
            if (targetNoteMatch) {
              if (hideNonMatching && (!matchedNotes.has(note.id) || !matchedNotes.has(targetNoteMatch.id))) return;
              links.push({
                source: `note-${note.id}`,
                target: `note-${targetNoteMatch.id}`,
                type: "wikilink",
              });
            }
          });
        }
      }
    });

    // Filter out any links where source or target nodes do not exist
    const validNodeIds = new Set(nodes.map((n) => n.id));
    const validLinks = links.filter(
      (l) => validNodeIds.has(l.source as string) && validNodeIds.has(l.target as string)
    );

    return { nodes, links: validLinks, availableTags, availableFolders, availableDates };
  }, [
    data,
    activeWorkspaceId,
    showAllHolders,
    filters,
    bmSettings?.nonMatchingBehavior,
  ]);

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
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;

    svg.call(zoom);

    // Initial transform
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(1),
    );

    // Force Simulation
    const simulation = d3
      .forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(graphData.links)
          .id((d) => d.id)
          .distance((d) => {
            if (d.type === "tag") return 300;
            if (d.type === "parent") return 220;
            if (d.type === "wikilink") return 200;
            return 140;
          })
          .strength((d) => (d.type === "wikilink" ? 0.5 : 1)),
      )
      .force("charge", d3.forceManyBody().strength(-2000).distanceMax(3000))
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d) =>
            typeof d !== "number" ? (d as GraphNode).val + 60 : 60,
          )
          .iterations(4)
          .strength(1),
      )
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX().strength(0.01))
      .force("y", d3.forceY().strength(0.01));

    // Draw Links
    const link = g
      .append("g")
      .attr("stroke-opacity", 0.8)
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", (d) =>
        d.type === "tag"
          ? themes[colorTheme].linkTag
          : d.type === "wikilink"
            ? "var(--color-accent)"
            : themes[colorTheme].linkDefault,
      )
      .attr("stroke-width", (d) => (d.type === "tag" || d.type === "wikilink" ? 1.5 : 1))
      .attr("stroke-dasharray", (d) => {
        if (d.type === "parent") return "4,4";
        if (d.type === "wikilink") return "2,2";
        return "none";
      });

    const nodeG = g
      .append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .join("g")
      .style("opacity", (d) => (d.dimmed ? 0.2 : 1))
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", function (event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", function (event, d) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", function (event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    // Draw Nodes (Circles)
    nodeG
      .append("circle")
      .attr("r", (d) => d.val)
      .attr("fill", (d) => {
        if (d.type === "workspace") return themes[colorTheme].workspace;
        if (d.type === "collection") return themes[colorTheme].collection;
        if (d.type === "tag") return themes[colorTheme].tag;
        return themes[colorTheme].note;
      })
      .attr("stroke", "none")
      .attr("stroke-width", 0)
      .attr("cursor", "pointer")
      .style("filter", (d) =>
        d.type === "workspace"
          ? "none"
          : "drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.1))",
      )
      .on("click", (event, d) => {
        if (d.type === "note" && d.noteRef) {
          onNavigateToNote(
            d.noteRef.id,
            d.noteRef.collectionId,
            d.noteRef.workspaceId,
          );
        }
      });

    // Draw Labels
    nodeG
      .append("text")
      .text((d) => d.label)
      .attr("y", (d) => d.val + 15)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => {
        if (d.type === "workspace") return "14px";
        if (d.type === "collection" || d.type === "tag") return "12px";
        return "10px";
      })
      .attr("font-weight", (d) => (d.type === "tag" ? "bold" : "normal"))
      .attr("fill", (d) =>
        d.type === "tag"
          ? themes[colorTheme].tag
          : themes[colorTheme].workspace,
      )
      .attr("pointer-events", "none")
      .style(
        "text-shadow",
        "0 1px 3px var(--color-background), 0 -1px 3px var(--color-background), 1px 0 3px var(--color-background), -1px 0 3px var(--color-background)",
      );

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);

      nodeG.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [graphData, onNavigateToNote, colorTheme]);

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgClone);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(
        /^<svg/,
        '<svg xmlns="http://www.w3.org/2000/svg"',
      );
    }
    if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(
        /^<svg/,
        '<svg xmlns:xlink="http://www.w3.org/1999/xlink"',
      );
    }
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    const url =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);

    const element = document.createElement("a");
    element.href = url;
    element.download = "brain-map.svg";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

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
    svg
      .transition()
      .duration(750)
      .call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(1),
      );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm p-2 rounded-lg border border-border shadow-sm pointer-events-auto">
          <Network size={20} className="text-accent" />
          <span className="font-semibold text-text-primary text-sm">
            Graph View
          </span>
        </div>
        <button
          onClick={() => setShowAllHolders(!showAllHolders)}
          className="flex items-center justify-center bg-surface/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs font-medium text-text-primary hover:bg-surface transition-colors pointer-events-auto"
        >
          {showAllHolders ? "Viewing All Holders" : "Viewing Current Holder"}
        </button>

        <div className="flex flex-col gap-1 max-w-[250px] pointer-events-auto mt-2 max-h-[400px] overflow-y-auto hidden-scrollbar bg-surface/80 backdrop-blur-sm p-3 rounded-lg border border-border shadow-sm">
          
          <div className="relative mb-2">
            <Search className="absolute left-2 text-text-muted top-1/2 -translate-y-1/2" size={14} />
            <input
              type="text"
              placeholder="Search graph..."
              className="w-full bg-surface-active text-text-primary text-xs rounded border border-border pl-7 pr-2 py-1.5 focus:border-accent outline-none"
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between mt-1 mb-1 border-t border-border pt-2">
            <span className="text-[10px] font-bold text-text-muted">FILTERS</span>
            <button
               onClick={() => setFilters({
                 searchTerm: "",
                 tags: [],
                 folders: [],
                 dateRange: { start: null, end: null },
                 connectionTypes: { wikilinks: true, tags: true },
               })}
               className="text-[10px] text-accent hover:text-orange-400"
            >
               Clear All
            </button>
          </div>

          {graphData.availableTags.length > 0 && <span className="text-[10px] font-bold text-text-muted mt-2 mb-1">TAGS</span>}
          <div className="flex flex-wrap gap-1">
             {graphData.availableTags.map(tag => {
                const isActive = filters.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const newTags = isActive 
                        ? filters.tags.filter(t => t !== tag)
                        : [...filters.tags, tag];
                      setFilters({ ...filters, tags: newTags });
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${isActive ? "bg-accent text-white" : "bg-surface text-text-secondary hover:bg-surface-hover border border-border"}`}
                  >
                    #{tag}
                  </button>
                )
             })}
          </div>

          {graphData.availableFolders.length > 0 && <span className="text-[10px] font-bold text-text-muted mt-2 mb-1">FOLDERS</span>}
          <div className="flex flex-wrap gap-1">
             {graphData.availableFolders.map(folderId => {
                const col = data.collections.find(c => c.id === folderId);
                if (!col) return null;
                const isActive = filters.folders.includes(folderId);
                return (
                   <button
                     key={folderId}
                     onClick={() => {
                        const newFolders = isActive
                          ? filters.folders.filter(f => f !== folderId)
                          : [...filters.folders, folderId];
                        setFilters({ ...filters, folders: newFolders });
                     }}
                     className={`px-1.5 py-0.5 rounded text-[10px] ${isActive ? "bg-accent text-white" : "bg-surface text-text-secondary hover:bg-surface-hover border border-border"}`}
                   >
                     📁 {col.name}
                   </button>
                )
             })}
          </div>

          <div className="text-[10px] font-bold text-text-muted mt-2 mb-1">DATE RANGE</div>
          <div className="flex items-center gap-1">
             <input 
               type="date"
               value={filters.dateRange.start || ""}
               onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, start: e.target.value }})}
               className="bg-surface-active border border-border rounded text-[10px] px-1 py-0.5 outline-none focus:border-accent w-full"
             />
             <span className="text-text-muted">-</span>
             <input 
               type="date"
               value={filters.dateRange.end || ""}
               onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, end: e.target.value }})}
               className="bg-surface-active border border-border rounded text-[10px] px-1 py-0.5 outline-none focus:border-accent w-full"
             />
          </div>

          <div className="text-[10px] font-bold text-text-muted mt-2 mb-1">CONNECTIONS</div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                 type="checkbox" 
                 checked={filters.connectionTypes.wikilinks !== false}
                 onChange={(e) => setFilters({ ...filters, connectionTypes: { ...filters.connectionTypes, wikilinks: e.target.checked }})}
                 className="rounded bg-surface text-accent border-border"
              />
              <span className="text-xs text-text-secondary">Wikilinks <code>[[...]]</code></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                 type="checkbox" 
                 checked={filters.connectionTypes.tags !== false}
                 onChange={(e) => setFilters({ ...filters, connectionTypes: { ...filters.connectionTypes, tags: e.target.checked }})}
                 className="rounded bg-surface text-accent border-border"
              />
              <span className="text-xs text-text-secondary">#Tag Links</span>
            </label>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-surface/80 backdrop-blur-sm p-1 rounded-lg border border-border shadow-sm">
        <button
          className="p-2 hover:bg-surface border-border rounded-md text-text-muted hover:text-text-primary transition-colors"
          onClick={() => {
            const keys = Object.keys(themes) as (keyof typeof themes)[];
            const nextIndex = (keys.indexOf(colorTheme) + 1) % keys.length;
            setColorTheme(keys[nextIndex]);
          }}
          title="Cycle Color Theme"
        >
          <Palette size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <button
          className="p-2 hover:bg-surface border-border rounded-md text-text-muted hover:text-text-primary transition-colors"
          onClick={() => handleZoom(1.2)}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="p-2 hover:bg-surface border-border rounded-md text-text-muted hover:text-text-primary transition-colors"
          onClick={() => handleZoom(0.8)}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <button
          className="p-2 hover:bg-surface border-border rounded-md text-text-muted hover:text-text-primary transition-colors"
          onClick={handleReset}
          title="Reset View"
        >
          <Maximize size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <button
          className="p-2 hover:bg-surface border-border rounded-md text-text-muted hover:text-text-primary transition-colors"
          onClick={handleExportSVG}
          title="Export SVG"
        >
          <Download size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <button
          title="Exit Brain Map"
          className="p-2 hover:bg-red-500/10 hover:text-red-500 border-border rounded-md text-text-muted transition-colors"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 w-full h-full cursor-crosshair">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ outline: "none" }}
        />
      </div>

      {graphData.nodes.length <= 1 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-text-muted text-sm bg-surface p-4 rounded-lg border border-border shadow-xl mx-4 text-center">
            No notes or features found. Create holders, folders, and notes with
            hashtags to build the universe brain map.
          </p>
        </div>
      )}
    </div>
  );
};
