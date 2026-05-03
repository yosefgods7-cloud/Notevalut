import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check } from 'lucide-react';

interface ImageCropModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (croppedBase64: string) => void;
}

export function ImageCropModal({ imageUrl, onClose, onSave }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;
    
    const crop = completedCrop;
    const image = imgRef.current;
    
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.95);
    onSave(base64Image);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-w-4xl max-h-[90vh] w-full animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-header">
          <h2 className="text-lg font-semibold text-text-primary">Crop Image</h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-auto flex items-center justify-center bg-background/50">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            <img 
              ref={imgRef}
              src={imageUrl} 
              alt="Crop preview" 
              className="max-w-full max-h-[60vh] object-contain"
            />
          </ReactCrop>
        </div>
        
        <div className="p-4 border-t border-border flex justify-end gap-3 bg-surface-header">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!completedCrop?.width || !completedCrop?.height}
            className="flex items-center gap-2 bg-accent text-white px-5 py-2 rounded-lg font-medium hover:bg-accent/90 focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-50"
          >
            <Check size={18} /> Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
