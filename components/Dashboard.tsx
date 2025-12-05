
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { NomadDocument, Reminder } from '../types';
import { Button } from './UI';
import { Trash2 } from 'lucide-react';
import { analyzeDocument } from '../services/geminiService';
import { processFile, uploadFileToStorage } from '../services/fileProcessingService';
import { saveDocumentToSupabase, deleteDocumentFromSupabase, saveManualReminderToSupabase, deleteReminderFromSupabase, updateReminderInSupabase } from '../services/storageService';
import { getUserProfile } from '../services/authService';
import { v4 as uuidv4 } from 'uuid';
import { EditDocumentModal } from './EditDocumentModal';
import { DocumentViewerModal } from './DocumentViewerModal';
import { downloadCalendarFile } from '../services/calendarService';
import { useAuth } from '../contexts/AuthContext';

// Sub-components
import { StatsHero } from './dashboard/StatsHero';
import { UploadSection } from './dashboard/UploadSection';
import { DocumentGrid } from './dashboard/DocumentGrid';
import { TimelineSection } from './dashboard/TimelineSection';
import { RemindersSidebar } from './dashboard/RemindersSidebar';

interface DashboardProps {
    documents: NomadDocument[];
    setDocuments: React.Dispatch<React.SetStateAction<NomadDocument[]>>;
    manualReminders: Reminder[];
    setManualReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
    onOpenChat: (message?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
    documents, setDocuments, 
    manualReminders, setManualReminders,
    onOpenChat
}) => {
    const { user } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [filter, setFilter] = useState<string>('All Documents');
    const [searchTerm, setSearchTerm] = useState('');
    const [userLanguage, setUserLanguage] = useState('English');
    
    // Modal States
    const [editingDoc, setEditingDoc] = useState<NomadDocument | null>(null);
    const [viewingDoc, setViewingDoc] = useState<NomadDocument | null>(null);
    const [docToDelete, setDocToDelete] = useState<string | null>(null);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchLang = async () => {
            const profile = await getUserProfile();
            if (profile?.language) {
                setUserLanguage(profile.language);
            }
        };
        fetchLang();
    }, []);

    // --- Computed Data ---
    const allReminders = useMemo(() => {
        let reminders: (Reminder & { docType?: string })[] = manualReminders.map(r => ({...r, docType: 'Manual'}));
        
        documents.forEach(doc => {
            if (doc.processedReminders) {
                doc.processedReminders.forEach(r => {
                    reminders.push({
                        ...r,
                        docType: doc.extractedData.type || 'Document'
                    });
                });
            }
        });
        return reminders.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }, [documents, manualReminders]);

    // --- Handlers ---
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        try {
            // 1. Process local file (Compress, Hash, Extract Text)
            const { content, mimeType, isText, preview, file: processedFile, hash } = await processFile(file);

            // 2. Upload to Supabase Storage
            const publicUrl = await uploadFileToStorage(processedFile, user.id);

            // 3. Analyze with AI & Translate
            try {
                const extractedData = await analyzeDocument(content, mimeType, isText, userLanguage);
                const docId = uuidv4();
                
                // Process reminders
                const processedReminders: Reminder[] = (extractedData.reminders || []).map((r: any) => ({
                    ...r,
                    id: uuidv4(),
                    docId: docId,
                    source: 'document'
                }));

                // DETERMINISTIC ORIGINAL CONTENT LOGIC:
                // If isText is true, 'content' variable holds the actual text extracted by PDF.js/Mammoth.
                // We use that directly instead of relying on AI to echo it back.
                // If isText is false (Image), 'content' is Base64. We rely on AI's OCR result (extractedData.originalContent).
                const finalOriginalContent = isText ? content : extractedData.originalContent;

                const newDoc: NomadDocument = {
                    id: docId,
                    contentHash: hash,
                    fileData: isText ? content : (preview || ''), 
                    file_path: publicUrl || undefined,
                    fileName: file.name,
                    mimeType: mimeType,
                    uploadDate: new Date().toISOString(),
                    extractedData: {
                        ...extractedData,
                        originalContent: finalOriginalContent // Override with robust logic
                    },
                    processedReminders: processedReminders,
                    isTextBased: isText,
                    previewImage: preview,
                    translatedContent: extractedData.translatedContent,
                    translationLanguage: userLanguage,
                    originalContent: finalOriginalContent // Ensure top-level access
                };
                
                // 4. Persist to Supabase Database
                await saveDocumentToSupabase(newDoc);

                setDocuments(prev => [newDoc, ...prev]);
            } catch (err: any) {
                console.error(err);
                const errorMessage = err instanceof Error ? err.message : String(err || "Failed to analyze document.");
                alert(errorMessage);
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (err: any) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : String(err || "Error processing file.");
            alert(errorMessage);
            setIsUploading(false);
        }
    };

    const handleDeleteDoc = async (id: string) => {
        setDeletingIds(prev => new Set(prev).add(id));
        try {
            await deleteDocumentFromSupabase(id);
            setDocuments(prev => prev.filter(d => d.id !== id));
        } catch (error: any) {
            console.error("Delete failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            alert(`Failed to delete document: ${errorMessage}`);
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleSaveDoc = async (updatedDoc: NomadDocument) => {
        try {
            await saveDocumentToSupabase(updatedDoc);
            setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
            setEditingDoc(null);
        } catch (error) {
            console.error(error);
            alert("Failed to save changes.");
        }
    };

    const handleAddReminder = async (title: string, date: string, time: string, priority: 'High'|'Medium'|'Low') => {
        const reminder: Reminder = {
            id: uuidv4(),
            title,
            date,
            time: time || undefined,
            priority,
            source: 'manual'
        };
        await saveManualReminderToSupabase(reminder);
        setManualReminders(prev => [...prev, reminder]);
    };

    const handleUpdateReminder = async (updated: Reminder) => {
        try {
            await updateReminderInSupabase(updated);
            if (updated.source === 'manual') {
                setManualReminders(prev => prev.map(r => r.id === updated.id ? updated : r));
            } else {
                // Update inside document
                const doc = documents.find(d => d.id === updated.docId);
                if (doc) {
                    const newReminders = doc.processedReminders?.map(r => r.id === updated.id ? updated : r) || [];
                    const newDoc = { ...doc, processedReminders: newReminders };
                    setDocuments(prev => prev.map(d => d.id === doc.id ? newDoc : d));
                }
            }
        } catch (e) {
            alert("Failed to update reminder");
        }
    };

    const handleDeleteReminder = async (id: string, source?: string, docId?: string) => {
        if (source === 'manual') {
            await deleteReminderFromSupabase(id);
            setManualReminders(prev => prev.filter(r => r.id !== id));
        } else if (docId) {
            const doc = documents.find(d => d.id === docId);
            if (doc) {
                const updatedDoc = {
                    ...doc,
                    processedReminders: doc.processedReminders?.filter(r => r.id !== id)
                };
                await saveDocumentToSupabase(updatedDoc);
                setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d));
            }
        }
    };

    const handleViewDocument = (docId: string) => {
        const doc = documents.find(d => d.id === docId);
        if (doc) setViewingDoc(doc);
    };

    const handleExportCalendar = () => {
        downloadCalendarFile(documents, allReminders);
    };

    return (
        <div className="space-y-6">
            {/* --- Modals --- */}
            
            {editingDoc && (
                <EditDocumentModal 
                    document={editingDoc} 
                    onClose={() => setEditingDoc(null)} 
                    onSave={handleSaveDoc} 
                />
            )}

            {viewingDoc && (
                <DocumentViewerModal 
                    document={viewingDoc} 
                    onClose={() => setViewingDoc(null)} 
                />
            )}

            {docToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700 transform scale-100 animate-in zoom-in-95 duration-200">
                         <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-500 rounded-full flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Document?</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                                Are you sure you want to delete this document? This action cannot be undone.
                            </p>
                            <div className="flex w-full gap-3">
                                <Button variant="ghost" className="flex-1" onClick={() => setDocToDelete(null)}>Cancel</Button>
                                <Button variant="danger" className="flex-1" onClick={() => {
                                    if (docToDelete) handleDeleteDoc(docToDelete);
                                    setDocToDelete(null);
                                }}>Delete</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <StatsHero onAddDocument={() => fileInputRef.current?.click()} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* --- Left Column (Main) --- */}
                <div className="lg:col-span-2 space-y-6">
                    
                    <UploadSection 
                        isUploading={isUploading} 
                        fileInputRef={fileInputRef} 
                        onFileChange={handleFileChange} 
                    />

                    <DocumentGrid 
                        documents={documents}
                        filter={filter}
                        setFilter={setFilter}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        deletingIds={deletingIds}
                        onEdit={setEditingDoc}
                        onDelete={setDocToDelete}
                        onView={setViewingDoc}
                    />
                    
                    <TimelineSection documents={documents} onView={setViewingDoc} />
                </div>

                {/* --- Right Column (Sidebar) --- */}
                <div className="space-y-6">
                    <RemindersSidebar 
                        reminders={allReminders}
                        onAddReminder={handleAddReminder}
                        onDeleteReminder={handleDeleteReminder}
                        onUpdateReminder={handleUpdateReminder}
                        onExportCalendar={handleExportCalendar}
                        onViewDocument={handleViewDocument}
                        onAskAI={onOpenChat}
                    />
                </div>
            </div>
        </div>
    );
};
