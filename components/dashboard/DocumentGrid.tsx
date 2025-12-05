
import React, { useState } from 'react';
import { NomadDocument, DocType } from '../../types';
import { Card, Badge, Button } from '../UI';
import { Search, Edit2, Trash2, FileType, Eye, LayoutGrid, List, ChevronDown, ChevronUp } from 'lucide-react';
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
    onView: (doc: NomadDocument) => void;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({
    documents,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    deletingIds,
    onEdit,
    onDelete,
    onView
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [visibleLimit, setVisibleLimit] = useState(4);
    
    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.extractedData.title.toLowerCase().includes(searchTerm.toLowerCase());
        if (filter === 'All Documents') return matchesSearch;
        if (filter === 'Flights') return matchesSearch && doc.extractedData.type === DocType.TICKET;
        if (filter === 'Hotels') return matchesSearch && (doc.extractedData.type === DocType.RESERVATION || doc.extractedData.type === DocType.CONTRACT);
        if (filter === 'Visas') return matchesSearch && doc.extractedData.type === DocType.VISA;
        if (filter === 'Insurance') return matchesSearch && doc.extractedData.type === DocType.INSURANCE;
        return matchesSearch && doc.extractedData.type === DocType.OTHER;
    });

    const displayedDocuments = filteredDocuments.slice(0, visibleLimit);
    const hasMore = visibleLimit < filteredDocuments.length;

    const handleLoadMore = () => {
        setVisibleLimit(prev => prev + 4);
    };

    const handleShowLess = () => {
        setVisibleLimit(4);
    };

    return (
        <section>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Your Documents</h2>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                            title="List View"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
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
                        onClick={() => { setFilter(tab); setVisibleLimit(4); }}
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

            {viewMode === 'grid' ? (
                // GRID VIEW
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {displayedDocuments.map(doc => (
                        <Card 
                            key={doc.id} 
                            onClick={() => onView(doc)}
                            className="group hover:border-blue-500/30 transition-all relative cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-3 relative z-10">
                                {/* Combined Icon + Filename Box */}
                                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${getIconBgColor(doc.extractedData.type as DocType)}`}>
                                    {getIconForType(doc.extractedData.type)}
                                    <span className="text-[10px] font-semibold truncate max-w-[120px]">{doc.fileName}</span>
                                </div>

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
                                <h3 className="font-semibold text-slate-900 dark:text-slate-200 mb-1 truncate">{doc.extractedData.title}</h3>
                                <p className="text-xs text-slate-500">
                                    {doc.extractedData.eventDate ? `Event: ${doc.extractedData.eventDate}` : 
                                     doc.extractedData.expiryDate ? `Expires: ${doc.extractedData.expiryDate}` : 
                                     'No date'}
                                </p>
                            </div>
                            
                            {doc.isTextBased && !doc.previewImage ? (
                                <div className="w-full h-24 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-500 dark:text-slate-600 relative overflow-hidden group-hover:bg-slate-200 dark:group-hover:bg-slate-800 transition-colors">
                                    <FileType className="w-8 h-8 mb-2" />
                                    <span className="text-[10px] uppercase font-bold">{doc.fileName?.split('.').pop() || 'DOC'}</span>
                                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="bg-white/90 dark:bg-slate-800/90 text-xs px-2 py-1 rounded-full shadow text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                            <Eye className="w-3 h-3" /> View
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-24 rounded-lg overflow-hidden relative bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                                    <img 
                                        src={doc.previewImage || doc.fileData} 
                                        className="w-full h-full object-cover opacity-80 dark:opacity-50 group-hover:opacity-100 dark:group-hover:opacity-80 transition-opacity" 
                                        alt="preview"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                        }}
                                    />
                                    {doc.mimeType === 'image/png' && doc.fileName.toLowerCase().endsWith('.pdf') && (
                                        <div className="absolute top-1 right-1 bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded shadow z-10">PDF</div>
                                    )}
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="bg-white/90 dark:bg-slate-800/90 text-xs px-3 py-1.5 rounded-full shadow text-slate-700 dark:text-slate-200 flex items-center gap-1.5 font-medium transform scale-95 group-hover:scale-100 transition-transform">
                                            <Eye className="w-3.5 h-3.5" /> View Details
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            ) : (
                // LIST VIEW
                <div className="space-y-3">
                    {displayedDocuments.map(doc => (
                        <div 
                            key={doc.id}
                            onClick={() => onView(doc)} 
                            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer group shadow-sm"
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`p-3 rounded-lg flex-shrink-0 flex flex-col items-center justify-center gap-1 w-20 ${getIconBgColor(doc.extractedData.type as DocType)}`}>
                                    {getIconForType(doc.extractedData.type)}
                                    <span className="text-[10px] font-semibold truncate w-full text-center">{doc.fileName.split('.').pop()?.toUpperCase()}</span>
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {/* Filename Badge for List View */}
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded border border-slate-200 dark:border-transparent truncate max-w-[200px]">
                                            {doc.fileName}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate pr-4">
                                        {doc.extractedData.title}
                                    </h3>
                                    <p className="text-xs text-slate-500 truncate">
                                        {doc.extractedData.eventDate ? `Event: ${doc.extractedData.eventDate}` : 
                                         doc.extractedData.expiryDate ? `Expires: ${doc.extractedData.expiryDate}` : 
                                         'No date'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button 
                                    type="button"
                                    onClick={(e) => { 
                                        e.preventDefault();
                                        e.stopPropagation(); 
                                        onEdit(doc);
                                    }} 
                                    className="p-2 text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                                    title="Edit"
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
                                    className="p-2 text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                    title="Delete"
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
                    ))}
                </div>
            )}

            {filteredDocuments.length === 0 && (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    No documents found.
                </div>
            )}

            {filteredDocuments.length > 4 && (
                <div className="mt-6 flex justify-center">
                    {hasMore ? (
                        <Button variant="ghost" className="text-sm" onClick={handleLoadMore}>
                            Load More ({filteredDocuments.length - visibleLimit} left) <ChevronDown className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button variant="ghost" className="text-sm" onClick={handleShowLess}>
                            Show Less <ChevronUp className="w-4 h-4 ml-1" />
                        </Button>
                    )}
                </div>
            )}
        </section>
    );
};
