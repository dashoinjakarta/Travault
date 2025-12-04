import React from 'react';
import { DocType } from '../types';
import { 
    Plane, Hotel, FileCheck, Shield, CreditCard, 
    Clock, FileText 
} from 'lucide-react';
import { differenceInDays, isToday, isTomorrow, isToday as isDateToday } from 'date-fns';

export const getIconForType = (type: DocType | string, className="w-5 h-5") => {
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

export const getIconBgColor = (type: DocType) => {
    switch(type) {
        case DocType.TICKET: return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
        case DocType.RESERVATION: return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400';
        case DocType.VISA: return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400';
        case DocType.INSURANCE: return 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400';
        default: return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
    }
};

export const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "TODAY";
    if (isTomorrow(date)) return "TOMORROW";
    const days = differenceInDays(date, new Date());
    if (days < 0) return `${Math.abs(days)} DAYS AGO`;
    return `IN ${days} DAYS`;
};