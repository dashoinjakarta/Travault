
import React, { useState, useEffect } from 'react';
import { NomadDocument } from '../types';
import { X, Download, Calendar, MapPin, AlertCircle, FileText, CheckCircle2, Shield, Loader2 } from 'lucide-react';
import { Button, Badge } from './UI';
import { getIconForType, getIconBgColor } from '../utils/uiHelpers';

interface DocumentViewerModalProps {
    document: NomadDocument;
    onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ document, onClose }) => {
    const [textContent, setTextContent] = useState<string | null>(null);
    const [isLoadingText, setIsLoadingText] = useState(false);

    const isUrl = document.fileData?.startsWith('http') || document.fileData?.startsWith('blob:');
    const isPdf = document.mimeType === 'application/pdf' || document.fileName.toLowerCase().endsWith('.pdf');
    const isImage = document.mimeType?.startsWith('image/');
    const isTextFile = document.isTextBased && !isPdf;

    // Smart Text Fetching: If it's a server URL pointing to a text file, fetch the content.
    useEffect(() => {
        if (isTextFile) {
            if (isUrl) {
                setIsLoadingText(true);
                fetch(document.fileData!)
                    .then(res => {
                        if (!res.ok) throw new Error("Failed to fetch text");
                        // Ensure we read as UTF-8
                        return res.text();
                    })
                    .then(text => setTextContent(text))
                    .catch(err => {
                        console.error("Error loading text content:", err);
                        setTextContent("Error loading document content.");
                    })
                    .finally(() => setIsLoadingText(false));
            } else {
                // If not a URL, the fileData IS the content (e.g. from local upload before refresh)
                setTextContent(document.fileData || '');
            }
        }
    }, [document, isUrl, isTextFile]);

    // Robust Download Handler with Encoding Fix
    const handleDownload = async () => {
        try {
            let blob: Blob;
            let downloadUrl: string;

            if (isTextFile && textContent) {
                // FORCE UTF-8 Encoding for text files to fix "nonsense characters" (Mojibake)
                blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                downloadUrl = URL.createObjectURL(blob);
            } else if (isUrl) {
                // Fetch binary data for PDFs/Images to avoid browser display issues
                const response = await fetch(document.fileData!);
                blob = await response.blob();
                downloadUrl = URL.createObjectURL(blob);
            } else {
                // Fallback for base64 data URIs
                const link = window.document.createElement('a');
                link.href = document.fileData || '';
                link.download = document.fileName;
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
                return;
            }

            // Trigger download
            const link = window.document.createElement('a');
            link.href = downloadUrl;
            link.download = document.fileName;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            
            // Cleanup
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);

        } catch (e) {
            console.error("Download failed:", e);
            alert("Failed to download file.");
        }
    };
    
    // Helper to determine render mode
    const renderPreviewContent = () => {
        // 1. Loading State
        if (isLoadingText) {
            return (
                <div className="flex flex-col items-center justify-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <p>Loading document...</p>
                </div>
            );
        }

        // 2. Text Content (Fetched or Local)
        if (isTextFile && textContent) {
            return (
                <div className="w-full h-full bg-white p-8 shadow-sm overflow-auto font-mono text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
                    {textContent}
                </div>
            );
        }

        // 3. URLs (PDF / Image)
        if (isUrl) {
            if (isPdf) {
                return (
                    <iframe 
                        src={document.fileData} 
                        className="w-full h-full rounded-lg shadow-sm bg-white" 
                        title="Document Preview"
                    />
                );
            }
            if (isImage) {
                return (
                     <img 
                        src={document.fileData} 
                        alt="Document" 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                    />
                );
            }
            // Fallback for unknown types loaded via URL
            return (
                <div className="text-center text-slate-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Preview not available for this file type.</p>
                    <Button variant="secondary" className="mt-4" onClick={handleDownload}>
                        Download to View
                    </Button>
                </div>
            );
        }

        // 4. Base64 Fallbacks (Local Uploads)
        if (document.fileData?.startsWith('data:image')) {
             return (
                 <img 
                    src={document.fileData} 
                    alt="Document" 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                />
            );
        }

        return (
            <div className="text-center text-slate-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No preview data available.</p>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 dark:border-slate-700">
                
                {/* --- LEFT COLUMN: FILE PREVIEW --- */}
                <div className="w-full md:w-1/2 lg:w-3/5 bg-slate-100 dark:bg-slate-950/50 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 relative group">
                    
                    {/* Toolbar */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
                        <Badge color="bg-black/50 text-white backdrop-blur-md border border-white/10 shadow-sm pointer-events-auto">
                            {document.fileName}
                        </Badge>
                        <button 
                            onClick={handleDownload}
                            className="bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 p-2 rounded-full shadow-lg hover:bg-blue-600 hover:text-white transition-all pointer-events-auto cursor-pointer"
                            title="Download Original"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content Renderer */}
                    <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                        {renderPreviewContent()}
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
                        
                        {/* Summary Block */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                <Shield className="w-4 h-4" /> AI Summary
                            </h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {document.extractedData.summary}
                            </p>
                        </div>

                        {/* Key Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Event Date
                                </div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    {document.extractedData.eventDate || 'N/A'}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Location
                                </div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                    {document.extractedData.location || 'N/A'}
                                </div>
                            </div>
                        </div>

                        {/* Crucial Details */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Crucial Details
                            </h3>
                            {document.extractedData.importantDetails && document.extractedData.importantDetails.length > 0 ? (
                                <ul className="space-y-2">
                                    {document.extractedData.importantDetails.map((detail, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                            {detail}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-500 italic">No specific details extracted.</p>
                            )}
                        </div>

                        {/* Policy Rules */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500" /> Policy & Rules
                            </h3>
                            {document.extractedData.policyRules && document.extractedData.policyRules.length > 0 ? (
                                <ul className="space-y-2">
                                    {document.extractedData.policyRules.map((rule, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                            {rule}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-500 italic">No specific policies found.</p>
                            )}
                        </div>
                        
                        {/* Risk Analysis (If exists) */}
                        {document.extractedData.riskAnalysis && (
                             <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Risk Assessment</h3>
                                    <Badge color={document.extractedData.riskAnalysis.score > 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}>
                                        Safety Score: {document.extractedData.riskAnalysis.score}/100
                                    </Badge>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{document.extractedData.riskAnalysis.summary}</p>
                            </div>
                        )}

                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                         <div className="w-full sm:w-auto">
                            <Button variant="primary" className="w-full sm:w-auto" onClick={handleDownload}>
                                <Download className="w-4 h-4" /> Download Original
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
