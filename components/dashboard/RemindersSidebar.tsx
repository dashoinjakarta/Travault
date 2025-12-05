
import React, { useState, useMemo } from 'react';
import { Reminder } from '../../types';
import { Card, Button } from '../UI';
import { X, Plus, Check, Download, Edit2, FileText, MessageSquare, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { getIconForType, getRelativeTime } from '../../utils/uiHelpers';
import { format, isPast, isToday, parseISO } from 'date-fns';

interface RemindersSidebarProps {
    reminders: (Reminder & { docType?: string })[];
    onAddReminder: (title: string, date: string, time: string, priority: 'High'|'Medium'|'Low') => Promise<void>;
    onDeleteReminder: (id: string, source?: string, docId?: string) => Promise<void>;
    onUpdateReminder: (reminder: Reminder) => Promise<void>;
    onExportCalendar: () => void;
    onViewDocument: (docId: string) => void;
    onAskAI: (context: string) => void;
}

export const RemindersSidebar: React.FC<RemindersSidebarProps> = ({ 
    reminders, 
    onAddReminder, 
    onDeleteReminder,
    onUpdateReminder,
    onExportCalendar,
    onViewDocument,
    onAskAI
}) => {
    const [showAddReminder, setShowAddReminder] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Reminder | null>(null);
    
    // Pagination State
    const [visibleLimit, setVisibleLimit] = useState(5);

    const [newReminder, setNewReminder] = useState<{title: string, description: string, date: string, time: string, priority: 'High'|'Medium'|'Low'}>({
        title: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '',
        priority: 'Medium'
    });

    const upcomingReminders = useMemo(() => {
        return reminders.filter(r => {
            const date = parseISO(r.date);
            return isToday(date) || !isPast(date);
        });
    }, [reminders]);

    const displayedReminders = useMemo(() => {
        return upcomingReminders.slice(0, visibleLimit);
    }, [upcomingReminders, visibleLimit]);

    // Group reminders by "Month Year"
    const groupedReminders = useMemo(() => {
        const groups: { [key: string]: typeof displayedReminders } = {};
        
        displayedReminders.forEach(reminder => {
            if (!reminder.date) return;
            const date = parseISO(reminder.date);
            const monthKey = format(date, 'MMMM yyyy'); // e.g. "September 2026"
            
            if (!groups[monthKey]) {
                groups[monthKey] = [];
            }
            groups[monthKey].push(reminder);
        });
        
        return groups;
    }, [displayedReminders]);

    const handleAdd = async () => {
        if(!newReminder.title || !newReminder.date) return;
        
        await onAddReminder(newReminder.title, newReminder.date, newReminder.time, newReminder.priority);
        
        setNewReminder({
            title: '',
            description: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            time: '',
            priority: 'Medium'
        });
        setShowAddReminder(false);
    };

    const startEdit = (reminder: Reminder) => {
        setEditingId(reminder.id);
        setEditForm({ ...reminder });
    };

    const handleUpdate = async () => {
        if (editForm) {
            await onUpdateReminder(editForm);
            setEditingId(null);
            setEditForm(null);
        }
    };

    const handleShowMore = () => {
        setVisibleLimit(prev => prev + 5);
    };
    
    const handleShowLess = () => {
        setVisibleLimit(5);
    };

    const renderReminderCard = (reminder: Reminder & { docType?: string }) => {
        const dateObj = reminder.date ? new Date(reminder.date) : new Date();
        const isEditing = editingId === reminder.id;

        return (
            <div key={reminder.id} className="relative flex bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all group mb-3">
                
                {/* Priority Color Stripe */}
                <div className={`w-1 flex-shrink-0 ${
                    reminder.priority === 'High' ? 'bg-rose-500' :
                    reminder.priority === 'Medium' ? 'bg-amber-500' :
                    'bg-blue-500'
                }`}></div>

                {/* Left Column: Date */}
                <div className="w-16 sm:w-20 flex-shrink-0 bg-slate-50 dark:bg-slate-800/80 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-700/50 p-2 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                        {format(dateObj, 'EEE')}
                    </div>
                    <div className="text-2xl font-bold leading-none mb-2 text-slate-800 dark:text-slate-100">
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
                    
                    {isEditing && editForm ? (
                        <div className="space-y-2">
                            <input 
                                className="w-full text-xs bg-white dark:bg-slate-800 border rounded px-1 py-0.5"
                                value={editForm.title}
                                onChange={e => setEditForm({...editForm, title: e.target.value})}
                                placeholder="Title"
                            />
                            <input 
                                className="w-full text-xs bg-white dark:bg-slate-800 border rounded px-1 py-0.5 text-slate-500"
                                value={editForm.description || ''}
                                onChange={e => setEditForm({...editForm, description: e.target.value})}
                                placeholder="Description..."
                            />
                            <div className="flex gap-1">
                                <input 
                                    type="date"
                                    className="w-full text-xs bg-white dark:bg-slate-800 border rounded px-1 py-0.5"
                                    value={editForm.date}
                                    onChange={e => setEditForm({...editForm, date: e.target.value})}
                                />
                                <input 
                                    type="time"
                                    className="w-16 text-xs bg-white dark:bg-slate-800 border rounded px-1 py-0.5"
                                    value={editForm.time || ''}
                                    onChange={e => setEditForm({...editForm, time: e.target.value})}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingId(null)} className="text-xs text-slate-500">Cancel</button>
                                <button onClick={handleUpdate} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded flex items-center gap-1">
                                    <Save className="w-3 h-3"/> Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start mb-1 gap-2">
                                <div className="flex flex-wrap gap-2 items-center">
                                    {reminder.docType && (
                                        <div className="flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                            {getIconForType(reminder.docType, "w-3 h-3")}
                                            <span className="truncate max-w-[80px]">{reminder.docType}</span>
                                        </div>
                                    )}
                                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        {getRelativeTime(reminder.date)}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => startEdit(reminder)}
                                        className="text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 p-0.5"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button 
                                        onClick={() => onDeleteReminder(reminder.id, reminder.source, reminder.docId)}
                                        className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-500 p-0.5"
                                        title="Delete"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <h4 className="font-semibold text-sm leading-tight mb-1 truncate text-slate-800 dark:text-slate-100">
                                {reminder.title}
                            </h4>

                            {reminder.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                                    {reminder.description}
                                </p>
                            )}
                            
                            <div className="flex justify-between items-end mt-1">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {reminder.source === 'manual' ? (
                                        <span>Manual Entry</span>
                                    ) : (
                                        <span>{reminder.priority} Priority</span>
                                    )}
                                </div>

                                <div className="flex gap-2 items-center">
                                    <button 
                                        onClick={() => onAskAI(`What do I need to prepare for this task: "${reminder.title}" on ${reminder.date}?`)}
                                        className="group/btn flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all duration-300 ease-out p-1.5"
                                        title="Ask AI"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="max-w-0 overflow-hidden opacity-0 whitespace-nowrap group-hover/btn:max-w-[60px] group-hover/btn:opacity-100 group-hover/btn:ml-1.5 transition-all duration-300 ease-out text-[10px] font-medium">
                                            Ask AI
                                        </span>
                                    </button>
                                    
                                    {reminder.docId && (
                                        <button 
                                            onClick={() => onViewDocument(reminder.docId!)}
                                            className="group/btn flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-300 ease-out p-1.5"
                                            title="View Doc"
                                        >
                                            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="max-w-0 overflow-hidden opacity-0 whitespace-nowrap group-hover/btn:max-w-[60px] group-hover/btn:opacity-100 group-hover/btn:ml-1.5 transition-all duration-300 ease-out text-[10px] font-medium">
                                                View Doc
                                            </span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Card className="h-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 relative shadow-sm dark:shadow-lg flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Smart Reminders</h2>
                <div className="flex gap-2">
                    <button 
                        onClick={onExportCalendar}
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
                            onClick={handleAdd}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded transition-colors"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar pr-1">
                {Object.keys(groupedReminders).length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-sm">
                        <p>No upcoming reminders.</p>
                        <p className="text-xs mt-1">Upload documents to generate them or add manually.</p>
                    </div>
                ) : (
                    <>
                        {Object.keys(groupedReminders).map((monthKey) => (
                            <div key={monthKey}>
                                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white dark:bg-slate-800 z-10 py-1 border-b border-transparent">
                                    {monthKey}
                                </h3>
                                {groupedReminders[monthKey].map(reminder => renderReminderCard(reminder))}
                            </div>
                        ))}
                        
                        {/* Load More / Less Actions */}
                        {upcomingReminders.length > 5 && (
                            <div className="pt-2 flex justify-center">
                                {visibleLimit < upcomingReminders.length ? (
                                    <Button variant="ghost" className="text-xs w-full" onClick={handleShowMore}>
                                        Load More ({upcomingReminders.length - visibleLimit} left) <ChevronDown className="w-3 h-3 ml-1"/>
                                    </Button>
                                ) : (
                                    <Button variant="ghost" className="text-xs w-full" onClick={handleShowLess}>
                                        Show Less <ChevronUp className="w-3 h-3 ml-1"/>
                                    </Button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </Card>
    );
};
