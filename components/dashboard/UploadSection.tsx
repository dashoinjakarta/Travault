
import React, { useState } from 'react';
import { Spinner } from '../UI';
import { UploadCloud, AlertCircle } from 'lucide-react';
import { checkDocumentExistsByHash } from '../../services/storageService';

interface UploadSectionProps {
    isUploading: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ isUploading, fileInputRef, onFileChange }) => {
    const [dragActive, setDragActive] = useState(false);

    // Wrapper to intercept and check duplicates before the main handler
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Calculate Hash immediately (Client-side)
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Check Database for duplicate
        const isDuplicate = await checkDocumentExistsByHash(hash);
        
        if (isDuplicate) {
            alert("Duplicate Detected: You have already uploaded this exact file.");
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // 3. Pass to parent for processing (compression, AI, etc)
        onFileChange(e);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            if (fileInputRef.current) {
                // Manually trigger the input change
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(e.dataTransfer.files[0]);
                fileInputRef.current.files = dataTransfer.files;
                
                // Create synthetic event to reuse handleFile logic
                const event = {
                    target: fileInputRef.current
                } as React.ChangeEvent<HTMLInputElement>;
                
                handleFile(event);
            }
        }
    };

    return (
        <section>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Upload Travel Documents</h2>
            </div>
            <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative overflow-hidden
                ${isUploading ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 cursor-wait' : 
                  dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]' :
                  'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
                {isUploading ? (
                    <>
                        <Spinner />
                        <p className="mt-4 text-blue-600 dark:text-blue-400 font-medium">Analyzing with Gemini...</p>
                        <p className="text-xs text-slate-500 mt-1">Smart compression & text extraction active...</p>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4 text-slate-500 dark:text-slate-400">
                            <UploadCloud className="w-6 h-6" />
                        </div>
                        <h3 className="text-slate-900 dark:text-slate-200 font-medium">
                            Drag & drop or <span className="text-blue-600 dark:text-blue-500">browse</span>
                        </h3>
                        <p className="text-slate-500 text-sm mt-2">
                            PDF, DOCX, Images (Max 10MB)
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2">
                            Auto-deduplication & Smart Compression Active
                        </p>
                    </>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFile} 
                    className="hidden" 
                    accept="image/*,application/pdf,text/plain,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                />
            </div>
        </section>
    );
};
