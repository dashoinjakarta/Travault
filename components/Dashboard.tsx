import React, { useRef, useState, useMemo } from 'react';
import { NomadDocument, DocType, Reminder } from '../types';
import { Card, Badge, Button, Spinner } from './UI';
import { 
    Calendar, AlertCircle, FileText, UploadCloud, Plane, 
    Hotel, FileCheck, Shield, CreditCard, MoreHorizontal,
    Search, Plus, Trash2, Edit2, X, Check, FileType, Download,
    Clock
} from 'lucide-react';
import { format, differenceInDays, parseISO, isPast, isToday, isTomorrow } from 'date-fns';
import { analyzeDocument } from '../services/geminiService';
import { processFile, uploadFileToStorage } from '../services/fileProcessingService';
import { saveDocumentToSupabase, deleteDocumentFromSupabase, saveManualReminderToSupabase, deleteReminderFromSupabase } from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';
import { EditDocumentModal } from './EditDocumentModal';
import { downloadCalendarFile } from '../services/calendarService';

interface DashboardProps {
    documents: NomadDocument[];
    setDocuments: React.Dispatch<React.SetStateAction<NomadDocument[]>>;
    manualReminders: Reminder[];
    setManualReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
    documents, setDocuments, 
    manualReminders, setManualReminders 
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [filter, setFilter] = useState<string>('All Documents');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddReminder, setShowAddReminder] = useState(false);
    const [editingDoc, setEditingDoc] = useState<NomadDocument | null>(null);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    
    // New Reminder Form State
    const [newReminder, setNewReminder] = useState<{title: string, date: string, time: string, priority: 'High'|'Medium'|'Low'}>({
        title: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '',
        priority: 'Medium'
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Upload Logic ---
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // 1. Process local file for AI
            const { content, mimeType, isText, preview } = await processFile(file);

            // 2. Upload to Supabase Storage (Background)
            const publicUrl = await uploadFileToStorage(file);

            // 3. Analyze with AI (Frontend for now, moving to Edge Function soon)
            try {
                const extractedData = await analyzeDocument(content, mimeType, isText);
                
                const docId = uuidv4();
                
                // Process reminders
                const processedReminders: Reminder[] = (extractedData.reminders || []).map((r: any) => ({
                    ...r,
                    id: uuidv4(),
                    docId: docId,
                    source: 'document'
                }));

                const newDoc: NomadDocument = {
                    id: docId,
                    fileData: isText ? content : (preview || ''), 
                    file_path: publicUrl || undefined,
                    fileName: file.name,
                    mimeType: mimeType,
                    uploadDate: new Date().toISOString(),
                    extractedData: extractedData,
                    processedReminders: processedReminders,
                    isTextBased: isText,
                    previewImage: preview 
                };
                
                // 4. Persist to Supabase Database
                await saveDocumentToSupabase(newDoc);

                setDocuments(prev => [newDoc, ...prev]);
            } catch (err) {
                console.error(err);
                alert("Failed to analyze document.");
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (err) {
            console.error(err);
            alert("Error processing file. Make sure it's a valid format.");
            setIsUploading(false);
        }
    };

    const handleDeleteDoc = async (id: string) => {
        if(confirm("Delete this document?")) {
            setDeletingIds(prev => new Set(prev).add(id));
            try {
                await deleteDocumentFromSupabase(id);
                setDocuments(prev => prev.filter(d => d.id !== id));
            } catch (error) {
                console.error(error);
                alert("Failed to delete document from server. Please try again.");
            } finally {
                setDeletingIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
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

    const handleAddReminder = async () => {
        if(!newReminder.title || !newReminder.date) return;
        
        const reminder: Reminder = {
            id: uuidv4(),
            title: newReminder.title,
            date: newReminder.date,
            time: newReminder.time || undefined,
            priority: newReminder.priority,
            source: 'manual'
        };
        
        await saveManualReminderToSupabase(reminder);

        setManualReminders(prev => [...prev, reminder]);
        setShowAddReminder(false);
        setNewReminder({
            title: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            time: '',
            priority: 'Medium'
        });
    };

    const handleDeleteReminder = async (id: string, source?: string, docId?: string) => {
        if (source === 'manual') {
            await deleteReminderFromSupabase(id);
            setManualReminders(prev => prev.filter(r => r.id !== id));
        } else if (docId) {
            // This is complex for document reminders as they are tied to doc
            // For now, simple client-side hide, or we implement a delete endpoint for specific doc reminders
            const doc = documents.find(d => d.id === docId);
            if (doc) {
                const updatedDoc = {
                    ...doc,
                    processedReminders: doc.processedReminders?.filter(r => r.id !== id)
                };
                // We save the entire doc state again
                await saveDocumentToSupabase(updatedDoc);
                setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d));
            }
        }
    };

    const handleExportCalendar = () => {
        downloadCalendarFile(documents, allReminders);
    };

    // --- Computed Data ---
    const allReminders = useMemo(() => {
        // Enhance reminders with document type info
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

    const timelineEvents = useMemo(() => {
        const events = documents
            .filter(d => d.extractedData.eventDate || d.extractedData.expiryDate)
            .map(d => ({
                id: d.id,
                title: d.extractedData.title,
                date: d.extractedData.eventDate || d.extractedData.expiryDate,
                type: d.extractedData.type,
                summary: d.extractedData.summary
            }))
            .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
        return events;
    }, [documents]);

    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.extractedData.title.toLowerCase().includes(searchTerm.toLowerCase());
        if (filter === 'All Documents') return matchesSearch;
        if (filter === 'Flights') return matchesSearch && doc.extractedData.type === DocType.TICKET;
        if (filter === 'Hotels') return matchesSearch && (doc.extractedData.type === DocType.RESERVATION || doc.extractedData.type === DocType.CONTRACT);
        if (filter === 'Visas') return matchesSearch && doc.extractedData.type === DocType.VISA;
        if (filter === 'Insurance') return matchesSearch && doc.extractedData.type === DocType.INSURANCE;
        return matchesSearch && doc.extractedData.type === DocType.OTHER;
    });

    const getIconForType = (type: DocType | string, className="w-5 h-5") => {
        switch(type) {
            case DocType.TICKET: return <Plane className={className} />;
            case DocType.RESERVATION: return <Hotel className={className} />;
            case DocType.VISA: return <FileCheck className={className} />;
            case DocType.INSURANCE: return <Shield className={className} />;
            case DocType.PASSPORT:
            case DocType.ID: return <CreditCard className={className} />;
            case 'Manual': return <Clock className={className} />;
            default: return <FileText className={className} />;
        }
    };

    const getIconBgColor = (type: DocType) => {
        switch(type) {
            case DocType.TICKET: return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
            case DocType.RESERVATION: return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400';
            case DocType.VISA: return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400';
            case DocType.INSURANCE: return 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400';
            default: return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
        }
    };

    // Helper to get formatted relative time text
    const getRelativeTime = (dateStr: string) => {
        const date = parseISO(dateStr);
        if (isToday(date)) return "TODAY";
        if (isTomorrow(date)) return "TOMORROW";
        const days = differenceInDays(date, new Date());
        if (days < 0) return `${Math.abs(days)} DAYS AGO`;
        return `IN ${days} DAYS`;
    };

    return (
        <div className="space-y-6">
            
            {/* Edit Modal */}
            {editingDoc && (
                <EditDocumentModal 
                    document={editingDoc} 
                    onClose={() => setEditingDoc(null)} 
                    onSave={handleSaveDoc} 
                />
            )}

            {/* --- Hero / Stats --- */}
            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div>
                    <h2 className="text-slate-900 dark:text-slate-200 font-medium text-sm">Welcome back, James!</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Your dashboard is synced with Supabase.</p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()} variant="blue" className="w-full sm:w-auto text-xs py-2 sm:hidden">
                    <Plus className="w-4 h-4" /> Add Document
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* --- Left Column (Main) --- */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Upload Section */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Upload Travel Documents</h2>
                        </div>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative overflow-hidden
                            ${isUploading ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            {isUploading ? (
                                <>
                                    <Spinner />
                                    <p className="mt-4 text-blue-600 dark:text-blue-400 font-medium">Processing & Saving...</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4 text-slate-500 dark:text-slate-400">
                                        <UploadCloud className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-slate-900 dark:text-slate-200 font-medium">Drag and drop your files here, or <span className="text-blue-600 dark:text-blue-500">browse</span></h3>
                                    <p className="text-slate-500 text-sm mt-2">Supports: PDF, DOCX, JPG, PNG, TXT (Max 10MB)</p>
                                </>
                            )}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept="image/*,application/pdf,text/plain,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            />
                        </div>
                    </section>

                    {/* Documents Grid */}
                    <section>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Your Documents</h2>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                                <input 
                                    type="text" 
                                    placeholder="Search documents..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-400"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
                            {['All Documents', 'Flights', 'Hotels', 'Visas', 'Insurance', 'Others'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setFilter(tab)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                        filter === tab 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {filteredDocuments.map(doc => (
                                <Card key={doc.id} className="group hover:border-blue-500/30 transition-all relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`p-2 rounded-lg ${getIconBgColor(doc.extractedData.type)}`}>
                                            {getIconForType(doc.extractedData.type)}
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setEditingDoc(doc); }} 
                                                className="text-slate-400 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-500 p-1"
                                                title="Edit Document"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }} 
                                                className="text-slate-400 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-500 p-1"
                                                title="Delete Document"
                                                disabled={deletingIds.has(doc.id)}
                                            >
                                                {deletingIds.has(doc.id) ? (
                                                    <div className="w-4 h-4 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <Badge color="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 text-[10px] mb-2 inline-block border border-slate-200 dark:border-transparent">{doc.extractedData.type}</Badge>
                                        <h3 className="font-semibold text-slate-900 dark:text-slate-200 mb-1 truncate">{doc.extractedData.title}</h3>
                                        <p className="text-xs text-slate-500">{doc.extractedData.expiryDate || doc.extractedData.eventDate}</p>
                                    </div>
                                    {doc.isTextBased ? (
                                        <div className="w-full h-24 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-500 dark:text-slate-600 relative overflow-hidden group-hover:bg-slate-200 dark:group-hover:bg-slate-800 transition-colors">
                                            <FileType className="w-8 h-8 mb-2" />
                                            <span className="text-[10px] uppercase font-bold">{doc.fileName.split('.').pop()}</span>
                                        </div>
                                    ) : (
                                        <div className="w-full h-24 rounded-lg overflow-hidden relative bg-slate-100 dark:bg-slate-900">
                                            {doc.previewImage ? (
                                                <img src={doc.previewImage} className="w-full h-full object-cover opacity-80 dark:opacity-50 group-hover:opacity-100 dark:group-hover:opacity-80 transition-opacity" alt="preview" />
                                            ) : (
                                                <img src={doc.fileData} className="w-full h-full object-cover opacity-80 dark:opacity-50 group-hover:opacity-100 dark:group-hover:opacity-80 transition-opacity" alt="preview" />
                                            )}
                                            {doc.mimeType === 'image/png' && doc.fileName.toLowerCase().endsWith('.pdf') && (
                                                <div className="absolute top-1 right-1 bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded shadow">PDF</div>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    </section>
                    
                    {/* Trip Timeline */}
                    <section>
                         <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Trip Timeline</h2>
                         <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 shadow-sm">
                            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
                                {timelineEvents.length === 0 ? (
                                    <p className="text-slate-500 text-center text-sm py-4">No events scheduled.</p>
                                ) : (
                                    timelineEvents.map((event, idx) => (
                                        <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                                {getIconForType(event.type, "w-5 h-5 text-blue-500 dark:text-blue-400")}
                                            </div>
                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 shadow-sm hover:border-blue-500/30 transition-all">
                                                <div className="flex items-center justify-between space-x-2 mb-1">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{event.title}</div>
                                                    <time className="font-mono text-xs text-slate-500 whitespace-nowrap">{event.date ? event.date.split('T')[0] : 'N/A'}</time>
                                                </div>
                                                <div className="text-slate-600 dark:text-slate-400 text-xs line-clamp-2">
                                                    {event.summary}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                         </div>
                    </section>
                </div>

                {/* --- Right Column (Sidebar) --- */}
                <div className="space-y-6">
                    <Card className="h-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 relative shadow-sm dark:shadow-lg">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Smart Reminders</h2>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleExportCalendar}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                                    title="Sync to Calendar"
                                >
                                    <Download className="w-4 h-4"/>
                                </button>
                                <button 
                                    onClick={() => setShowAddReminder(!showAddReminder)} 
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                                    title="Add Reminder"
                                >
                                    {showAddReminder ? <X className="w-4 h-4"/> : <Plus className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Add Reminder Form */}
                        {showAddReminder && (
                            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                <input 
                                    type="text" 
                                    placeholder="Reminder title..." 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                                    value={newReminder.title}
                                    onChange={e => setNewReminder({...newReminder, title: e.target.value})}
                                />
                                <div className="flex gap-2">
                                    <input 
                                        type="date" 
                                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 flex-1"
                                        value={newReminder.date}
                                        onChange={e => setNewReminder({...newReminder, date: e.target.value})}
                                    />
                                    <input 
                                        type="time" 
                                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 w-24"
                                        value={newReminder.time}
                                        onChange={e => setNewReminder({...newReminder, time: e.target.value})}
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-1">
                                        {(['High', 'Medium', 'Low'] as const).map(p => (
                                            <button 
                                                key={p}
                                                onClick={() => setNewReminder({...newReminder, priority: p})}
                                                className={`text-[10px] px-2 py-0.5 rounded border ${
                                                    newReminder.priority === p 
                                                    ? 'bg-blue-600 border-blue-600 text-white' 
                                                    : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={handleAddReminder}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded transition-colors"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 max-h-[600px] overflow-y-auto no-scrollbar pr-1">
                            {allReminders.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 text-sm">
                                    <p>No active reminders.</p>
                                    <p className="text-xs mt-1">Upload documents to generate them or add manually.</p>
                                </div>
                            ) : (
                                allReminders.map((reminder) => {
                                    const dateObj = reminder.date ? parseISO(reminder.date) : new Date();
                                    const isExpired = isPast(dateObj) && !isToday(dateObj);
                                    
                                    return (
                                        <div key={reminder.id} className="relative flex bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all group">
                                            
                                            {/* Priority Color Stripe */}
                                            <div className={`w-1 flex-shrink-0 ${
                                                reminder.priority === 'High' ? 'bg-rose-500' :
                                                reminder.priority === 'Medium' ? 'bg-amber-500' :
                                                'bg-blue-500'
                                            }`}></div>

                                            {/* Left Column: Date */}
                                            <div className="w-20 sm:w-24 flex-shrink-0 bg-slate-50 dark:bg-slate-800/80 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-700/50 p-2 text-center">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                                                    {format(dateObj, 'MMM')}
                                                </div>
                                                <div className={`text-3xl font-bold leading-none mb-2 ${isExpired ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                                    {format(dateObj, 'd')}
                                                </div>
                                                {reminder.time && (
                                                    <div className="bg-slate-200 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 text-[9px] px-2 py-0.5 rounded-full font-mono">
                                                        {reminder.time}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right Column: Content */}
                                            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                                <div className="flex justify-between items-start mb-1 gap-2">
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        {/* Doc Type Badge */}
                                                        {reminder.docType && (
                                                            <div className="flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                                                {getIconForType(reminder.docType, "w-3 h-3")}
                                                                <span className="truncate max-w-[80px]">{reminder.docType}</span>
                                                            </div>
                                                        )}
                                                        {/* Relative Time Badge */}
                                                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                            {getRelativeTime(reminder.date)}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Delete Button */}
                                                    <button 
                                                        onClick={() => handleDeleteReminder(reminder.id, reminder.source, reminder.docId)}
                                                        className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-500 transition-colors -mr-1"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>

                                                <h4 className={`font-semibold text-sm leading-tight mb-1 truncate ${isExpired ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                                    {reminder.title}
                                                </h4>
                                                
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    {reminder.source === 'manual' ? (
                                                        <span>Manual Entry</span>
                                                    ) : (
                                                        <span>{reminder.priority} Priority Reminder</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {allReminders.length > 5 && (
                            <Button variant="secondary" className="w-full mt-6 text-sm">
                                View All Reminders
                            </Button>
                        )}
                    </Card>
                </div>

            </div>
        </div>
    );
};