import React, { useState, useEffect } from 'react';

type DialogType = 'PROMPT' | 'CONFIRM';

interface DialogOptions {
  message: string;
  defaultValue?: string;
  onConfirm: (val: string | boolean) => void;
  onCancel: () => void;
  type: DialogType;
}

let activeDialogManager: ((options: DialogOptions) => void) | null = null;

export const appPrompt = (message: string, defaultValue: string = ''): Promise<string | null> => {
   return new Promise((resolve) => {
      if(!activeDialogManager) {
        // Fallback to window.prompt if component isn't mounted yet
        resolve(window.prompt(message, defaultValue));
        return;
      }
      activeDialogManager({
         message,
         defaultValue,
         type: 'PROMPT',
         onConfirm: (val: string | boolean) => resolve(val as string),
         onCancel: () => resolve(null)
      });
   });
};

export const appConfirm = (message: string): Promise<boolean> => {
   return new Promise((resolve) => {
      if(!activeDialogManager) {
        // Fallback to window.confirm
        resolve(window.confirm(message));
        return;
      }
      activeDialogManager({
         message,
         type: 'CONFIRM',
         onConfirm: () => resolve(true),
         onCancel: () => resolve(false)
      });
   });
};

export const GlobalDialogs: React.FC = () => {
    const [dialog, setDialog] = useState<DialogOptions | null>(null);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        activeDialogManager = (options: DialogOptions) => {
            setDialog(options);
            setInputValue(options.defaultValue || '');
        };
        return () => {
            activeDialogManager = null;
        };
    }, []);

    if (!dialog) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
           <div className="bg-surface border border-border p-6 rounded-xl shadow-2xl w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
              <p className="font-semibold text-text-primary whitespace-pre-wrap">{dialog.message}</p>
              {dialog.type === 'PROMPT' && (
                 <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent text-text-primary"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            dialog.onConfirm(inputValue);
                            setDialog(null);
                        } else if (e.key === 'Escape') {
                            dialog.onCancel();
                            setDialog(null);
                        }
                    }}
                 />
              )}
              <div className="flex justify-end gap-2 mt-2">
                 <button 
                    onClick={() => { dialog.onCancel(); setDialog(null); }}
                    className="px-4 py-2 rounded-md hover:bg-surface-hover text-text-secondary text-sm font-medium transition-colors"
                 >
                    Cancel
                 </button>
                 <button 
                    onClick={() => { dialog.onConfirm(dialog.type === 'PROMPT' ? inputValue : true); setDialog(null); }}
                    className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium shadow-sm transition-colors"
                 >
                    OK
                 </button>
              </div>
           </div>
        </div>
    );
};
