import React, { useMemo } from 'react';
import { NomadDocument } from '../../types';
import { getIconForType } from '../../utils/uiHelpers';

interface TimelineSectionProps {
    documents: NomadDocument[];
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({ documents }) => {
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

    return (
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
    );
};