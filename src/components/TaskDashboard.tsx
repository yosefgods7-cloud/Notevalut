import React, { useEffect, useState } from "react";
import { Editor } from "@tiptap/react";
import { CheckSquare, Square, CheckCircle2, ListTodo } from "lucide-react";

interface TaskDashboardProps {
  editor: Editor;
}

interface TaskItem {
  text: string;
  checked: boolean;
  pos: number;
}

export const TaskDashboard: React.FC<TaskDashboardProps> = ({ editor }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  useEffect(() => {
    const updateTasks = () => {
      const newTasks: TaskItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "taskItem") {
          newTasks.push({
            text: node.textContent,
            checked: node.attrs.checked,
            pos,
          });
        }
      });
      setTasks(newTasks);
    };

    updateTasks();
    editor.on("update", updateTasks);

    return () => {
      editor.off("update", updateTasks);
    };
  }, [editor]);

  const toggleTask = (pos: number, currentChecked: boolean) => {
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        checked: !currentChecked,
      })
    );
  };

  const completedCount = tasks.filter((t) => t.checked).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (tasks.length === 0) return null;

  return (
    <div className="w-72 sm:w-80 border-l border-border bg-background overflow-y-auto no-scrollbar flex flex-col hidden lg:flex">
      <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2 text-text-primary font-medium mb-3">
          <ListTodo size={18} className="text-accent" />
          <h3>Task Summary</h3>
        </div>
        
        <div className="flex items-center justify-between text-xs text-text-muted mb-2">
          <span>{completedCount} of {totalCount} completed</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2">
        {tasks.map((task, idx) => (
          <div 
            key={`${task.pos}-${idx}`}
            className={`flex items-start gap-2 p-2 rounded-lg border transition-colors cursor-pointer group ${
              task.checked 
                ? "bg-surface/50 border-transparent text-text-muted" 
                : "bg-surface border-border hover:border-accent/50 text-text-primary"
            }`}
            onClick={() => toggleTask(task.pos, task.checked)}
          >
            <button 
              className="mt-0.5 shrink-0 transition-colors"
            >
              {task.checked ? (
                <CheckSquare size={16} className="text-accent" />
              ) : (
                <Square size={16} className="group-hover:text-accent text-text-muted" />
              )}
            </button>
            <span className={`text-sm leading-tight break-words flex-1 ${task.checked ? "line-through" : ""}`}>
              {task.text || <span className="italic text-text-muted/50">Empty task...</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
