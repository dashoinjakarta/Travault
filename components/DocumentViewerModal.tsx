

import React, { useState } from 'react';
import { NomadDocument } from '../types';
import { X, Download, Calendar, MapPin, AlertCircle, FileText, CheckCircle2, Shield, Globe, Clock, File } from 'lucide-react';
import { Button } from './UI';
import { getIconForType, getIconBgColor } from '../utils/uiHelpers';

interface DocumentViewerModalProps {
    document: NomadDocument;
    onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ document, onClose }) => {
    // Modes: 'translated', 'text', 'file'
    const [viewMode, setViewMode] = useState<'translated' | 'text' | 'file'>('translated');

    const isUrl = document.fileData?.startsWith('http') || document.fileData?.startsWith('blob:');
    const isPdf = document.mimeType === 'application/pdf' || document.fileName.toLowerCase().endsWith('.pdf');
    const isImage = document.mimeType?.startsWith('image/');

    // Download Original (Compressed) File
    const handleDownloadOriginalFile = async () => {
        try {
            if (isUrl && document.fileData) {
                // Attempt to fetch as blob to force a proper "download" action with correct filename
                const response = await fetch(document.fileData);
                if (!response.ok) throw new Error("Network response was not ok");
                
                const blob = await response.blob();
                const downloadUrl = URL.createObjectURL(blob);
                const link = window.document.createElement('a');
                link.href = downloadUrl;
                link.download = document.fileName;
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
                URL.revokeObjectURL(downloadUrl);
            } else if (document.fileData) {
                // Base64 or Blob URL
                const link = window.document.createElement('a');
                link.href = document.fileData;
                link.download = document.fileName;
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
            }
        } catch (e) {
            console.warn("Direct download failed (likely CORS), falling back to open in tab:", e);
            // Fallback: If fetch fails (CORS), just open the URL. User can save from there.
            if (isUrl && document.fileData) {
                window.open(document.fileData, '_blank');
            } else {
                alert("Download failed. Please try again.");
            }
        }
    };

    // Download Text Content (Translated or Original)
    const handleDownloadText = (type: 'translated' | 'original') => {
        const content = type === 'translated' ? document.translatedContent : document.originalContent;
        const prefix = type === 'translated' ? 'Translated' : 'Original_Text';
        
        if (!content) return;
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = `${prefix}_${document.fileName}.txt`;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    const renderMainContent = () => {
        // Mode 1: Translated View
        if (viewMode === 'translated') {
            if (document.translatedContent) {
                return (
                    <div className="w-full h-full bg-white p-8 shadow-sm overflow-auto font-serif text-base leading-relaxed text-slate-800">
                        <div className="mb-6 border-b border-slate-100 pb-4">
                            <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-1">Translated Content</h3>
                            <div className="text-blue-600 font-medium flex items-center gap-2">
                                <Globe className="w-4 h-4" /> {document.translationLanguage || 'English'}
                            </div>
                        </div>
                        <div className="whitespace-pre-wrap">
                            {document.translatedContent}
                        </div>
                    </div>
                );
            }
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <Globe className="w-12 h-12 mb-4 opacity-20" />
                    <p>No translation available.</p>
                </div>
            );
        }

        // Mode 2: Original Extracted Text View
        if (viewMode === 'text') {
            if (document.originalContent) {
                 return (
                    <div className="w-full h-full bg-white p-8 shadow-sm overflow-auto font-mono text-xs whitespace-pre-wrap text-slate-600">
                        <div className="mb-6 border-b border-slate-100 pb-4">
                            <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-1">Original Extracted Text</h3>
                        </div>
                        {document.originalContent}
                    </div>
                );
            }
             return (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <FileText className="w-12 h-12 mb-4 opacity-20" />
                    <p>No text extracted.</p>
                </div>
            );
        }

        // Mode 3: Original File (Visual) View
        if (viewMode === 'file') {
            if (isUrl) {
                if (isPdf) {
                    return <iframe src={document.fileData} className="w-full h-full bg-white" title="Original" />;
                }
                if (isImage) {
                    return <div className="w-full h-full flex items-center justify-center bg-slate-900"><img src={document.fileData} alt="Original" className="max-w-full max-h-full object-contain" /></div>;
                }
            }
            // Base64 Image Fallback
            if (document.fileData?.startsWith('data:image')) {
                 return <div className="w-full h-full flex items-center justify-center bg-slate-900"><img src={document.fileData} alt="Original" className="max-w-full max-h-full object-contain" /></div>;
            }

            return <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <File className="w-12 h-12 mb-4 opacity-20" />
                <p>Preview not available for this file type.</p>
                <Button variant="ghost" onClick={handleDownloadOriginalFile} className="mt-4">Download to View</Button>
            </div>;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 dark:border-slate-700">
                
                {/* --- LEFT COLUMN: CONTENT PREVIEW --- */}
                <div className="w-full md:w-1/2 lg:w-3/5 bg-slate-100 dark:bg-slate-950/50 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 relative group">
                    
                    {/* Top Toolbar */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
                        <div className="flex gap-2 pointer-events-auto bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-full backdrop-blur-md shadow-sm">
                            <button 
                                onClick={() => setViewMode('translated')}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${viewMode === 'translated' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Translation
                            </button>
                             <button 
                                onClick={() => setViewMode('text')}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${viewMode === 'text' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Original Text
                            </button>
                            <button 
                                onClick={() => setViewMode('file')}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${viewMode === 'file' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Original File
                            </button>
                        </div>

                        {/* Download Buttons Contextual */}
                        <div className="flex gap-2 pointer-events-auto">
                             {viewMode === 'translated' && document.translatedContent && (
                                <button 
                                    onClick={() => handleDownloadText('translated')}
                                    className="bg-white/90 text-slate-700 p-2 rounded-full shadow-lg hover:bg-blue-600 hover:text-white transition-all"
                                    title="Download Translation"
                                >
                                    <Globe className="w-5 h-5" />
                                </button>
                            )}
                            {viewMode === 'text' && document.originalContent && (
                                <button 
                                    onClick={() => handleDownloadText('original')}
                                    className="bg-white/90 text-slate-700 p-2 rounded-full shadow-lg hover:bg-blue-600 hover:text-white transition-all"
                                    title="Download Original Text"
                                >
                                    <FileText className="w-5 h-5" />
                                </button>
                            )}
                            <button 
                                onClick={handleDownloadOriginalFile}
                                className="bg-white/90 text-slate-700 p-2 rounded-full shadow-lg hover:bg-blue-600 hover:text-white transition-all"
                                title="Download Original File"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content Renderer */}
                    <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-200/50 dark:bg-slate-900/50 p-4 pt-16">
                        <div className="w-full h-full shadow-lg rounded-lg overflow-hidden bg-white">
                            {renderMainContent()}
                        </div>
                    </div>
                </div>

                {/* --- RIGHT COLUMN: INTELLIGENCE --- */}
                <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col h-full bg-white dark:bg-slate-900">
                    
                    {/* Header */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`p-1.5 rounded-md ${getIconBgColor(document.extractedData.type)}`}>
                                    {getIconForType(document.extractedData.type, "w-4 h-4")}
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {document.extractedData.type}
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                {document.extractedData.title}
                            </h2>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                        
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                <Shield className="w-4 h-4" /> AI Summary
                            </h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {document.extractedData.summary}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Event Date & Time
                                </div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                    {document.extractedData.eventDate || 'N/A'}
                                </div>
                                {document.extractedData.eventTime && (
                                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                        <Clock className="w-3 h-3 text-blue-500" />
                                        {document.extractedData.eventTime}
                                    </div>
                                )}
                            </div>
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Location
                                </div>
                                <div className="font-medium text-slate-900 dark:text-slate-100 text-xs break-words">
                                    {document.extractedData.location || 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Crucial Details
                            </h3>
                            {document.extractedData.importantDetails?.length > 0 ? (
                                <ul className="space-y-3">
                                    {document.extractedData.importantDetails.map((detail, idx) => {
                                        // Try to split "Key: Value" or "Key - Value"
                                        const splitMatch = detail.match(/^([^:-]+)[:\-\s]+(.*)$/);
                                        
                                        if (splitMatch) {
                                            const [_, label, value] = splitMatch;
                                            return (
                                                <li key={idx} className="flex flex-col sm:flex-row rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
                                                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 sm:w-1/3 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-700 flex items-center">
                                                        {label.trim()}
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-900/50 px-3 py-2 text-slate-600 dark:text-slate-300 sm:w-2/3 break-words">
                                                        {value.trim()}
                                                    </div>
                                                </li>
                                            );
                                        }

                                        // Fallback for non-structured strings
                                        return (
                                            <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                {detail}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : <p className="text-sm text-slate-500 italic">No specific details extracted.</p>}
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500" /> Policy & Rules
                            </h3>
                            {document.extractedData.policyRules?.length > 0 ? (
                                <ul className="space-y-2">
                                    {document.extractedData.policyRules.map((rule, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                            {rule}
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm text-slate-500 italic">No specific policies found.</p>}
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                        <Button variant="primary" className="w-full sm:w-auto" onClick={handleDownloadOriginalFile}>
                            <Download className="w-4 h-4" /> Download Original File
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};