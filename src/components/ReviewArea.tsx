import React, { useState } from 'react';
import { useStorage } from '../context/StorageContext';
import { ReviewNote, ReviewNoteType } from '../types';
import { cn } from '../lib/utils';
import { Calendar, Trash2, Plus, ArrowLeft } from 'lucide-react';

export const ReviewArea: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data, addReviewNote, updateReviewNote, deleteReviewNote } = useStorage();
  const [activeTab, setActiveTab] = useState<ReviewNoteType>('weekly');
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  const reviewNotes = data.reviewNotes || [];
  const filteredNotes = reviewNotes.filter((rn) => rn.type === activeTab).sort((a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime());
  const selectedReview = selectedReviewId ? reviewNotes.find(rn => rn.id === selectedReviewId) : null;

  const handleCreateReview = () => {
    const now = new Date();
    let title = "";
    let periodStart = new Date();
    let periodEnd = new Date();
    
    if (activeTab === "weekly") {
      title = `Weekly Review - ${now.toLocaleDateString()}`;
      periodStart.setDate(now.getDate() - 7);
    } else if (activeTab === "monthly") {
      title = `Monthly Review - ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
      periodStart.setMonth(now.getMonth() - 1);
    } else {
      title = `Yearly Review - ${now.getFullYear()}`;
      periodStart.setFullYear(now.getFullYear() - 1);
    }

    const startIso = periodStart.toISOString();
    const endIso = periodEnd.toISOString();

    const notesInPeriod = data.notes.filter(n => {
      const createdAt = new Date(n.createdAt).getTime();
      return createdAt >= periodStart.getTime() && createdAt <= periodEnd.getTime();
    });

    const linkedNoteIds = notesInPeriod.map(n => n.id);

    // Build some auto-filled metadata from these notes
    let summaryText = "";
    let tagsSet = new Set<string>();
    let sourcesSet = new Set<string>();

    notesInPeriod.forEach(n => {
      if (n.headerMeta?.summary) {
        summaryText += `- [${n.title}]: ${n.headerMeta.summary}\n`;
      }
      if (n.headerMeta?.source) {
        sourcesSet.add(n.headerMeta.source);
      }
      n.tags.forEach(t => tagsSet.add(t));
    });

    const newReview = addReviewNote({
      type: activeTab,
      title,
      periodStart: startIso,
      periodEnd: endIso,
      content: summaryText ? `### Auto-Summary of Notes\n${summaryText}` : "",
      topLessons: "",
      keySources: Array.from(sourcesSet).join("\n"),
      ideasToRevisit: "",
      actionsToTake: "",
      summary: "",
      linkedNoteIds
    });
    setSelectedReviewId(newReview.id);
  };

  const handleUpdate = (field: keyof ReviewNote, value: string) => {
    if (selectedReviewId) {
      updateReviewNote(selectedReviewId, { [field]: value });
    }
  };

  if (selectedReview) {
    return (
      <div className="flex flex-col h-full bg-background overflow-y-auto">
        <div className="flex items-center gap-4 p-4 border-b border-border bg-surface sticky top-0 z-10">
          <button onClick={() => setSelectedReviewId(null)} className="p-2 hover:bg-surface-hover rounded-md text-text-secondary">
            <ArrowLeft size={18} />
          </button>
          <input 
            type="text" 
            value={selectedReview.title} 
            onChange={(e) => handleUpdate('title', e.target.value)} 
            className="bg-transparent text-xl font-semibold text-text-primary outline-none flex-1"
          />
        </div>
        <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface border border-border p-4 rounded-xl flex flex-col gap-2">
              <h3 className="font-semibold text-text-primary mb-1">Top Lessons</h3>
              <textarea 
                value={selectedReview.topLessons} 
                onChange={(e) => handleUpdate('topLessons', e.target.value)} 
                className="w-full h-32 bg-transparent text-sm resize-none outline-none text-text-secondary"
                placeholder="What did you learn?"
              />
            </div>
            <div className="bg-surface border border-border p-4 rounded-xl flex flex-col gap-2">
              <h3 className="font-semibold text-text-primary mb-1">Key Sources</h3>
              <textarea 
                value={selectedReview.keySources} 
                onChange={(e) => handleUpdate('keySources', e.target.value)} 
                className="w-full h-32 bg-transparent text-sm resize-none outline-none text-text-secondary"
                placeholder="Important links and sources..."
              />
            </div>
            <div className="bg-surface border border-border p-4 rounded-xl flex flex-col gap-2">
              <h3 className="font-semibold text-text-primary mb-1">Ideas to Revisit</h3>
              <textarea 
                value={selectedReview.ideasToRevisit} 
                onChange={(e) => handleUpdate('ideasToRevisit', e.target.value)} 
                className="w-full h-32 bg-transparent text-sm resize-none outline-none text-text-secondary"
                placeholder="Ideas to explore later..."
              />
            </div>
            <div className="bg-surface border border-border p-4 rounded-xl flex flex-col gap-2">
              <h3 className="font-semibold text-text-primary mb-1">Actions to Take</h3>
              <textarea 
                value={selectedReview.actionsToTake} 
                onChange={(e) => handleUpdate('actionsToTake', e.target.value)} 
                className="w-full h-32 bg-transparent text-sm resize-none outline-none text-text-secondary"
                placeholder="Action items..."
              />
            </div>
          </div>
          <div className="bg-surface border border-border p-4 rounded-xl flex flex-col gap-2">
            <h3 className="font-semibold text-text-primary mb-1">Summary / Free Notes</h3>
            <textarea 
              value={selectedReview.content} 
              onChange={(e) => handleUpdate('content', e.target.value)} 
              className="w-full h-40 bg-transparent text-sm resize-none outline-none text-text-secondary"
              placeholder="Write your review here..."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      <div className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary mb-1 flex items-center gap-2">
            <Calendar size={24} className="text-accent" />
            Periodic Reviews
          </h2>
          <p className="text-sm text-text-muted">Reflect on your notes and synthesize ideas over time.</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-md text-text-secondary">
          <ArrowLeft size={20} />
        </button>
      </div>
      
      <div className="flex border-b border-border bg-surface shrink-0 px-6 pt-2">
        {(['weekly', 'monthly', 'yearly'] as ReviewNoteType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={cn(
              "px-4 py-2 font-medium text-sm capitalize border-b-2 transition-colors",
              activeTab === type 
                ? "border-accent text-accent" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {type} Reviews
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-text-primary capitalize">{activeTab} Reviews</h3>
            <button 
              onClick={handleCreateReview}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-colors"
            >
              <Plus size={16} /> Create New
            </button>
          </div>

          <div className="grid gap-4">
            {filteredNotes.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-border rounded-xl text-text-muted">
                No {activeTab} reviews found. Create one to start reflecting!
              </div>
            ) : (
              filteredNotes.map(rn => (
                <div key={rn.id} className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:border-accent group transition-colors">
                  <div className="flex-1 cursor-pointer" onClick={() => setSelectedReviewId(rn.id)}>
                    <h4 className="font-medium text-text-primary mb-1">{rn.title}</h4>
                    <span className="text-xs text-text-muted">{new Date(rn.createdAt).toLocaleDateString()}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteReviewNote(rn.id); }}
                    className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
