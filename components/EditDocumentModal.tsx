import React, { useState } from 'react';
import { NomadDocument, DocType } from '../types';
import { X, Save } from 'lucide-react';
import { Button } from './UI';

interface EditDocumentModalProps {
    document: NomadDocument;
    onClose: () => void;
    onSave: (updatedDoc: NomadDocument) => void;
}

export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({ document, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: document.extractedData.title,
        type: document.extractedData.type,
        eventDate: document.extractedData.eventDate || '',
        expiryDate: document.extractedData.expiryDate || '',
        summary: document.extractedData.summary
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedDoc: NomadDocument = {
            ...document,
            extractedData: {
                ...document.extractedData,
                title: formData.title,
                type: formData.type,
                eventDate: formData.eventDate || undefined,
                expiryDate: formData.expiryDate || undefined,
                summary: formData.summary
            }
        };
        onSave(updatedDoc);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
                    <h3 className="text-lg font-bold text-slate-100">Edit Document</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                        <input 
                            type="text" 
                            required
                            value={formData.title}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                            <select 
                                value={formData.type}
                                onChange={e => setFormData({...formData, type: e.target.value as DocType})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                            >
                                {Object.values(DocType).map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-slate-400 mb-1">Event Date</label>
                             <input 
                                type="date" 
                                value={formData.eventDate}
                                onChange={e => setFormData({...formData, eventDate: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Expiry Date</label>
                         <input 
                            type="date" 
                            value={formData.expiryDate}
                            onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Summary</label>
                        <textarea 
                            rows={3}
                            value={formData.summary}
                            onChange={e => setFormData({...formData, summary: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none resize-none text-sm"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant="primary">
                            <Save className="w-4 h-4" /> Save Changes
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};