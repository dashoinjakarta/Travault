import { NomadDocument, Reminder } from "../types";
import { format } from 'date-fns';

const formatICSDate = (dateStr: string, timeStr?: string): string => {
    // Input date is YYYY-MM-DD
    // Input time is HH:MM (optional)
    // Output for Date: YYYYMMDD
    // Output for DateTime: YYYYMMDDTHHMMSS
    
    const cleanDate = dateStr.replace(/-/g, '');
    
    if (timeStr) {
        const cleanTime = timeStr.replace(/:/g, '') + '00';
        return `DTSTART:${cleanDate}T${cleanTime}`;
    }
    
    // All day event
    return `DTSTART;VALUE=DATE:${cleanDate}`;
};

export const downloadCalendarFile = (documents: NomadDocument[], reminders: Reminder[]) => {
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Travault//Nomad Assistant//EN',
        'CALSCALE:GREGORIAN'
    ];

    // 1. Convert Documents (Events & Expiry)
    documents.forEach(doc => {
        const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
        
        // Event Date
        if (doc.extractedData.eventDate) {
            icsContent.push(
                'BEGIN:VEVENT',
                `UID:${doc.id}-event@travault.app`,
                `DTSTAMP:${now}`,
                formatICSDate(doc.extractedData.eventDate),
                `SUMMARY:✈️ ${doc.extractedData.title}`,
                `DESCRIPTION:${doc.extractedData.summary || ''} (Type: ${doc.extractedData.type})`,
                'END:VEVENT'
            );
        }

        // Expiry Date
        if (doc.extractedData.expiryDate) {
            icsContent.push(
                'BEGIN:VEVENT',
                `UID:${doc.id}-expiry@travault.app`,
                `DTSTAMP:${now}`,
                formatICSDate(doc.extractedData.expiryDate),
                `SUMMARY:⚠️ Expiring: ${doc.extractedData.title}`,
                `DESCRIPTION:Document Expiry. ${doc.extractedData.summary || ''}`,
                'END:VEVENT'
            );
        }
    });

    // 2. Convert Reminders
    reminders.forEach(reminder => {
        const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
        const priorityIcon = reminder.priority === 'High' ? '🔴' : reminder.priority === 'Medium' ? '🟡' : '🔵';
        
        icsContent.push(
            'BEGIN:VEVENT',
            `UID:${reminder.id}@travault.app`,
            `DTSTAMP:${now}`,
            formatICSDate(reminder.date, reminder.time),
            `SUMMARY:${priorityIcon} ${reminder.title}`,
            `DESCRIPTION:Travault Reminder. Priority: ${reminder.priority}`,
            'END:VEVENT'
        );
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'travault_schedule.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};