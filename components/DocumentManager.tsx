import React, { useState, useRef } from 'react';
import { NomadDocument, DocType } from '../types';
import { Card, Badge, Button, Spinner } from './UI';
import { UploadCloud, FileText, Trash2, Calendar, Search, ShieldAlert, CheckCircle, AlertTriangle, FileType } from 'lucide-react';
import { analyzeDocument, performRiskAnalysis } from '../services/geminiService';
import { processFile } from '../services/fileProcessingService';
import { v4 as uuidv4 } from 'uuid';

interface DocumentManagerProps {
    documents: NomadDocument[];
    setDocuments: React.Dispatch<React.SetStateAction<NomadDocument[]>>;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ documents, setDocuments }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [analyzingRiskId, setAnalyzingRiskId] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError(null);
        setIsUploading(true);

        try {
            // Process file using unified service
            const { content, mimeType, isText, preview } = await processFile(file);

            try {
                const extractedData = await analyzeDocument(content, mimeType, isText);

                const newDoc: NomadDocument = {
                    id: uuidv4(),
                    // For text, store content. For image, store preview/base64
                    fileData: isText ? content : (preview || ''), 
                    mimeType: mimeType,
                    fileName: file.name,
                    uploadDate: new Date().toISOString(),
                    extractedData: extractedData,
                    isTextBased: isText,
                    previewImage: preview
                };

                setDocuments(prev => [newDoc, ...prev]);
            } catch (err) {
                console.error(err);
                setUploadError("Failed to analyze document. Please try again.");
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (err) {
            console.error(err);
            setUploadError("Error processing file. Please ensure it is a supported format.");
            setIsUploading(false);
        }
    };

    const handleDelete = (id: string) => {
        if(confirm("Are you sure you want to delete this document?")) {
            setDocuments(prev => prev.filter(d => d.id !== id));
        }
    };

    const handleRiskAnalysis = async (doc: NomadDocument) => {
        setAnalyzingRiskId(doc.id);
        try {
            const riskData = await performRiskAnalysis(doc);
            setDocuments(prev => prev.map(d => {
                if(d.id === doc.id) {
                    return {
                        ...d,
                        extractedData: {
                            ...d.extractedData,
                            riskAnalysis: riskData
                        }
                    }
                }
                return d;
            }));
        } catch (e) {
            alert("Failed to perform risk analysis.");
        } finally {
            setAnalyzingRiskId(null);
        }
    };

    const filteredDocs = documents.filter(doc => 
        doc.extractedData.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.extractedData.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 pb-20">
            <h1 className="text-2xl font-bold text-slate-100">My Documents</h1>

            {/* Upload Area */}
            <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isUploading ? 'bg-slate-800 border-blue-500' : 'bg-slate-800/30 border-slate-700 hover:border-blue-500 hover:bg-slate-800/50'}`}
            >
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-4">
                        <Spinner />
                        <p className="mt-4 text-blue-400 font-medium">Analyzing with Gemini AI...</p>
                        <p className="text-sm text-slate-400">Extracting metadata & generating embeddings</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-12 h-12 bg-slate-700 text-blue-400 rounded-full flex items-center justify-center mb-3">
                            <UploadCloud className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-slate-200">Click to upload</h3>
                        <p className="text-sm text-slate-500 mt-1">Supports PDF, DOCX, JPG, PNG, TXT (Max 5MB)</p>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="hidden" 
                            accept="image/*,application/pdf,text/plain,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        />
                    </div>
                )}
                {uploadError && <p className="text-rose-500 text-sm mt-3">{uploadError}</p>}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                    type="text" 
                    placeholder="Search documents..." 
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDocs.map(doc => (
                    <Card key={doc.id} className="flex flex-col justify-between group">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <Badge color="bg-indigo-900/50 text-indigo-400 border border-indigo-700/30">{doc.extractedData.type}</Badge>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }} className="text-slate-500 hover:text-rose-500 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <h3 className="font-bold text-slate-200 mb-1">{doc.extractedData.title}</h3>
                            <p className="text-sm text-slate-400 line-clamp-2">{doc.extractedData.summary}</p>
                            
                            {(doc.extractedData.expiryDate || doc.extractedData.eventDate) && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                                    <Calendar className="w-3 h-3" />
                                    <span>{doc.extractedData.expiryDate || doc.extractedData.eventDate}</span>
                                </div>
                            )}

                            {/* Risk Analysis Section */}
                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                                {doc.extractedData.riskAnalysis ? (
                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-slate-300">Executive Scan</span>
                                            <Badge color={
                                                doc.extractedData.riskAnalysis.score > 80 ? 'bg-emerald-900/50 text-emerald-400' : 
                                                doc.extractedData.riskAnalysis.score > 50 ? 'bg-amber-900/50 text-amber-400' : 'bg-rose-900/50 text-rose-400'
                                            }>
                                                Score: {doc.extractedData.riskAnalysis.score}/100
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-2">{doc.extractedData.riskAnalysis.summary}</p>
                                        {doc.extractedData.riskAnalysis.factors.length > 0 && (
                                            <div className="space-y-1">
                                                {doc.extractedData.riskAnalysis.factors.slice(0, 2).map((factor, idx) => (
                                                    <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-300">
                                                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                                        <span>{factor.description}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <Button 
                                        variant="secondary" 
                                        className="w-full text-xs py-1.5"
                                        onClick={() => handleRiskAnalysis(doc)}
                                        disabled={analyzingRiskId === doc.id}
                                    >
                                        {analyzingRiskId === doc.id ? (
                                            <><Spinner /> Scanning...</>
                                        ) : (
                                            <><ShieldAlert className="w-3 h-3" /> Executive Scan</>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                        
                        {doc.isTextBased ? (
                             <div className="mt-4 h-32 w-full bg-slate-900 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-slate-600 relative overflow-hidden group-hover:bg-slate-800 transition-colors">
                                <FileType className="w-10 h-10 mb-2" />
                                <span className="text-xs uppercase font-bold">{doc.fileName.split('.').pop()}</span>
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-xs text-white">Preview Not Available</span>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 h-32 w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 relative group/image">
                                {doc.previewImage ? (
                                     <img src={doc.previewImage} alt="Preview" className="w-full h-full object-cover opacity-60 group-hover/image:opacity-90 transition-opacity" />
                                ) : (
                                     <img src={doc.fileData} alt="Preview" className="w-full h-full object-cover opacity-60 group-hover/image:opacity-90 transition-opacity" />
                                )}
                                
                                {doc.mimeType === 'image/png' && doc.fileName.toLowerCase().endsWith('.pdf') && (
                                    <div className="absolute top-1 right-1 bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded shadow">PDF</div>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                                     <Button variant="secondary" className="text-xs scale-90" onClick={() => {
                                         const win = window.open();
                                         if (win) {
                                            if (doc.fileData) {
                                                 win.document.write('<iframe src="' + doc.fileData + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
                                            }
                                         }
                                    }}>View Document</Button>
                                </div>
                            </div>
                        )}
                    </Card>
                ))}
                
                {filteredDocs.length === 0 && !isUploading && (
                    <div className="col-span-full text-center py-10 text-slate-500">
                        No documents found. Upload one to get started!
                    </div>
                )}
            </div>
        </div>
    );
};