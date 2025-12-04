
import React from 'react';
import { NomadDocument, DocType } from '../../types';
import { Card, Badge } from '../UI';
import { Search, Edit2, Trash2, FileType, ImageOff } from 'lucide-react';
import { getIconBgColor, getIconForType } from '../../utils/uiHelpers';

interface DocumentGridProps {
    documents: NomadDocument[];
    filter: string;
    setFilter: (f: string) => void;
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    deletingIds: Set<string>;
    onEdit: (doc: NomadDocument) => void;
    onDelete: (id: string) => void;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({
    documents,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    deletingIds,
    onEdit,
    onDelete
}) => {
    
    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.extractedData.title.toLowerCase().includes(searchTerm.toLowerCase());
        if (filter === 'All Documents') return matchesSearch;
        if (filter === 'Flights') return matchesSearch && doc.extractedData.type === DocType.TICKET;
        if (filter === 'Hotels') return matchesSearch && (doc.extractedData.type === DocType.RESERVATION || doc.extractedData.type === DocType.CONTRACT);
        if (filter === 'Visas') return matchesSearch && doc.extractedData.type === DocType.VISA;
        if (filter === 'Insurance') return matchesSearch && doc.extractedData.type === DocType.INSURANCE;
        return matchesSearch && doc.extractedData.type === DocType.OTHER;
    });

    return (
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
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <div className={`p-2 rounded-lg ${getIconBgColor(doc.extractedData.type as DocType)}`}>
                                {getIconForType(doc.extractedData.type)}
                            </div>
                            {/* Buttons Container with Z-Index and Backdrop */}
                            <div className="flex gap-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-0.5 relative z-20">
                                <button 
                                    type="button"
                                    onClick={(e) => { 
                                        e.preventDefault();
                                        e.stopPropagation(); 
                                        onEdit(doc);
                                    }} 
                                    className="text-slate-400 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-500 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Document"
                                >
                                    <Edit2 className="w-4 h-4 pointer-events-none" />
                                </button>
                                <button 
                                    type="button"
                                    onClick={(e) => { 
                                        e.preventDefault();
                                        e.stopPropagation(); 
                                        onDelete(doc.id);
                                    }} 
                                    className="text-slate-400 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-500 p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Document"
                                    disabled={deletingIds.has(doc.id)}
                                >
                                    {deletingIds.has(doc.id) ? (
                                        <div className="w-4 h-4 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
                                    ) : (
                                        <Trash2 className="w-4 h-4 pointer-events-none" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="mb-4">
                            <Badge color="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 text-[10px] mb-2 inline-block border border-slate-200 dark:border-transparent">{doc.extractedData.type}</Badge>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-200 mb-1 truncate">{doc.extractedData.title}</h3>
                            <p className="text-xs text-slate-500">
                                {doc.extractedData.eventDate ? `Event: ${doc.extractedData.eventDate}` : 
                                 doc.extractedData.expiryDate ? `Expires: ${doc.extractedData.expiryDate}` : 
                                 'No date'}
                            </p>
                        </div>
                        
                        {/* Preview Section */}
                        {doc.isTextBased && !doc.previewImage ? (
                            <div className="w-full h-24 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-500 dark:text-slate-600 relative overflow-hidden group-hover:bg-slate-200 dark:group-hover:bg-slate-800 transition-colors">
                                <FileType className="w-8 h-8 mb-2" />
                                <span className="text-[10px] uppercase font-bold">{doc.fileName.split('.').pop()}</span>
                            </div>
                        ) : (
                            <div className="w-full h-24 rounded-lg overflow-hidden relative bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                                {(doc.previewImage || (doc.fileData && !doc.isTextBased)) ? (
                                    <img 
                                        src={doc.previewImage || doc.fileData} 
                                        className="w-full h-full object-cover opacity-80 dark:opacity-50 group-hover:opacity-100 dark:group-hover:opacity-80 transition-opacity" 
                                        alt="preview"
                                        onError={(e) => {
                                            // Fallback if image fails to load
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                        }}
                                    />
                                ) : (
                                    <div className="text-slate-400 flex flex-col items-center">
                                        <ImageOff className="w-6 h-6 mb-1 opacity-50" />
                                        <span className="text-[10px]">No Preview</span>
                                    </div>
                                )}
                                
                                {doc.mimeType === 'image/png' && doc.fileName.toLowerCase().endsWith('.pdf') && (
                                    <div className="absolute top-1 right-1 bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded shadow z-10">PDF</div>
                                )}
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </section>
    );
};
