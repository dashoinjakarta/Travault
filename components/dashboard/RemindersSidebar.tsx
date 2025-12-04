import React, { useState } from 'react';
import { Reminder } from '../../types';
import { Card, Button } from '../UI';
import { X, Plus, Check, Download } from 'lucide-react';
import { getIconForType, getRelativeTime } from '../../utils/uiHelpers';
import { format, isPast, isToday } from 'date-fns';

interface RemindersSidebarProps {
    reminders: (Reminder & { docType?: string })[];
    onAddReminder: (title: string, date: string, time: string, priority: 'High'|'Medium'|'Low') => Promise<void>;
    onDeleteReminder: (id: string, source?: string, docId?: string) => Promise<void>;
    onExportCalendar: () => void;
}

export const RemindersSidebar: React.FC<RemindersSidebarProps> = ({ 
    reminders, 
    onAddReminder, 
    onDeleteReminder,
    onExportCalendar 
}) => {
    const [showAddReminder, setShowAddReminder] = useState(false);
    const [newReminder, setNewReminder] = useState<{title: string, date: string, time: string, priority: 'High'|'Medium'|'Low'}>({
        title: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '',
        priority: 'Medium'
    });

    const handleAdd = async () => {
        if(!newReminder.title || !newReminder.date) return;
        await onAddReminder(newReminder.title, newReminder.date, newReminder.time, newReminder.priority);
        setNewReminder({
            title: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            time: '',
            priority: 'Medium'
        });
        setShowAddReminder(false);
    };

    return (
        <Card className="h-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 relative shadow-sm dark:shadow-lg">
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

            <div className="space-y-3 max-h-[600px] overflow-y-auto no-scrollbar pr-1">
                {reminders.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-sm">
                        <p>No active reminders.</p>
                        <p className="text-xs mt-1">Upload documents to generate them or add manually.</p>
                    </div>
                ) : (
                    reminders.map((reminder) => {
                        const dateObj = reminder.date ? new Date(reminder.date) : new Date();
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
                                            onClick={() => onDeleteReminder(reminder.id, reminder.source, reminder.docId)}
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

            {reminders.length > 5 && (
                <Button variant="secondary" className="w-full mt-6 text-sm">
                    View All Reminders
                </Button>
            )}
        </Card>
    );
};