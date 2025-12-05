
import React, { useMemo, useState } from 'react';
import { NomadDocument } from '../../types';
import { getIconForType } from '../../utils/uiHelpers';
import { isPast, isToday, isFuture, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { Button } from '../UI';

interface TimelineSectionProps {
    documents: NomadDocument[];
    onView: (doc: NomadDocument) => void;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({ documents, onView }) => {
    const [showPast, setShowPast] = useState(false);

    const { upcomingEvents, pastEvents } = useMemo(() => {
        const events = documents
            .filter(d => d.extractedData.eventDate || d.extractedData.expiryDate)
            .map(d => ({
                doc: d, // Keep ref to full doc for onClick
                id: d.id,
                title: d.extractedData.title,
                date: d.extractedData.eventDate || d.extractedData.expiryDate || '',
                type: d.extractedData.type,
                summary: d.extractedData.summary,
                location: d.extractedData.location
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const now = new Date();
        // Reset time to start of day for accurate comparison
        now.setHours(0,0,0,0);

        const past: typeof events = [];
        const upcoming: typeof events = [];

        events.forEach(e => {
            const eventDate = parseISO(e.date);
            // If date is before today, it's past. If today or future, it's upcoming.
            if (isPast(eventDate) && !isToday(eventDate)) {
                past.push(e);
            } else {
                upcoming.push(e);
            }
        });

        // Past events should be sorted newest first (closest to now)
        return { 
            upcomingEvents: upcoming, 
            pastEvents: past.reverse() 
        };
    }, [documents]);

    const renderEvent = (event: any, isNextUp: boolean, isLast: boolean) => (
        <div 
            key={event.id} 
            onClick={() => onView(event.doc)}
            className={`relative flex gap-4 group cursor-pointer`}
        >
            {/* Timeline Line */}
            {/* If it is the last item, we still want the line to extend down to the 'End Cap' dot */}
            <div className="absolute left-[19px] top-8 bottom-[-32px] w-0.5 bg-slate-200 dark:bg-slate-700"></div>

            {/* Icon/Dot */}
            <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 shrink-0 transition-colors ${
                isNextUp 
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 group-hover:border-blue-500'
            }`}>
                {getIconForType(event.type, isNextUp ? "w-5 h-5 text-white" : "w-5 h-5")}
                
                {isNextUp && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                )}
            </div>

            {/* Content Card */}
            <div className={`flex-1 mb-8 p-4 rounded-xl border transition-all ${
                isNextUp 
                ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' 
                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-700'
            }`}>
                <div className="flex justify-between items-start mb-1">
                    <div>
                         <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 block ${isNextUp ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                            {event.date} {isNextUp && "• NEXT UP"}
                        </span>
                        <h3 className={`font-bold text-sm ${isNextUp ? 'text-blue-900 dark:text-blue-100' : 'text-slate-800 dark:text-slate-200'}`}>
                            {event.title}
                        </h3>
                    </div>
                </div>
                
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                    {event.summary}
                </p>

                {event.location && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3 h-3" /> {event.location}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <section>
             <div className="flex justify-between items-end mb-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Your Journey</h2>
             </div>
             
             <div className="space-y-0">
                
                {/* Past Events Toggle */}
                {pastEvents.length > 0 && (
                    <div className="mb-6">
                        <Button 
                            variant="ghost" 
                            className="text-xs w-full flex items-center justify-between text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2"
                            onClick={() => setShowPast(!showPast)}
                        >
                            <span>{pastEvents.length} Past Events</span>
                            {showPast ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                        </Button>
                        
                        {showPast && (
                            <div className="mt-4 opacity-75 grayscale hover:grayscale-0 transition-all">
                                {pastEvents.map((event, idx) => renderEvent(event, false, false))}
                            </div>
                        )}
                    </div>
                )}

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 ? (
                    <div>
                        {upcomingEvents.map((event, idx) => renderEvent(event, idx === 0, idx === upcomingEvents.length - 1))}
                        
                        {/* End Cap Dot */}
                        <div className="relative flex gap-4">
                            <div className="relative z-10 flex items-center justify-center w-10 h-10 shrink-0">
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 ring-4 ring-white dark:ring-slate-900"></div>
                            </div>
                            <div className="flex-1 py-2">
                                <span className="text-[10px] text-slate-400 dark:text-slate-600 font-medium uppercase tracking-wider">Plan ahead</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-dashed">
                        <p className="text-slate-500 text-sm">No upcoming trips planned.</p>
                        <p className="text-xs text-slate-400 mt-1">Upload a ticket to start your timeline.</p>
                    </div>
                )}
             </div>
        </section>
    );
};
