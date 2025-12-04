import React from 'react';
import { Button } from '../UI';
import { Plus } from 'lucide-react';

interface StatsHeroProps {
    onAddDocument: () => void;
}

export const StatsHero: React.FC<StatsHeroProps> = ({ onAddDocument }) => {
    return (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div>
                <h2 className="text-slate-900 dark:text-slate-200 font-medium text-sm">Welcome back, Traveler!</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Your dashboard is synced with Supabase.</p>
            </div>
            <Button onClick={onAddDocument} variant="blue" className="w-full sm:w-auto text-xs py-2 sm:hidden">
                <Plus className="w-4 h-4" /> Add Document
            </Button>
        </div>
    );
};