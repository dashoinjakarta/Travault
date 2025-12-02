import React, { useState, useEffect } from 'react';
import { NomadDocument, ViewState, ChatMessage, Reminder } from './types';
import { Dashboard } from './components/Dashboard';
import { ChatAssistant } from './components/ChatAssistant';
import { Bell, Plus } from 'lucide-react';
import { loadDocumentsFromSupabase, loadChatHistory, loadManualRemindersFromSupabase } from './services/storageService';
import { Button } from './components/UI';

const App: React.FC = () => {
    const [view, setView] = useState<ViewState>('dashboard');
    const [documents, setDocuments] = useState<NomadDocument[]>([]);
    const [manualReminders, setManualReminders] = useState<Reminder[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // We use Promise.allSettled to ensure that if one fails (e.g., DB not ready), 
                // the app still loads partially
                const results = await Promise.allSettled([
                    loadDocumentsFromSupabase(),
                    loadManualRemindersFromSupabase()
                ]);

                const docs = results[0].status === 'fulfilled' ? results[0].value : [];
                const reminders = results[1].status === 'fulfilled' ? results[1].value : [];

                // Check for errors to log them
                if (results[0].status === 'rejected') console.error("Docs load failed", results[0].reason);
                if (results[1].status === 'rejected') console.error("Reminders load failed", results[1].reason);

                const chat = loadChatHistory(); // Keep chat local for now
                
                setDocuments(docs);
                setManualReminders(reminders);
                setChatHistory(chat);
            } catch (e) {
                console.error("Initialization failed critical error", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center">
                <div className="text-center">
                     <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                     <p>Loading Travault...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500/30">
            
            {/* Top Navigation */}
            <nav className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        
                        {/* Logo & Nav Links */}
                        <div className="flex items-center gap-12">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">Travault</span>
                            </div>
                            <div className="hidden md:flex items-baseline space-x-4">
                                {['Dashboard', 'Documents', 'Reminders', 'Settings'].map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => setView(item.toLowerCase() as ViewState)}
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                            (view === item.toLowerCase() || (view === 'dashboard' && item === 'Dashboard'))
                                            ? 'text-blue-400 bg-blue-500/10' 
                                            : 'text-slate-400 hover:text-slate-100'
                                        }`}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-6">
                            {/* Progress (Mock) */}
                            <div className="hidden lg:flex items-center gap-3">
                                <span className="text-xs text-slate-400">Completion</span>
                                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 w-1/2"></div>
                                </div>
                                <span className="text-xs font-mono text-blue-400">50%</span>
                            </div>

                            <Button variant="blue" className="hidden sm:flex text-sm py-1.5 px-3" onClick={() => document.getElementById('upload-input')?.click()}>
                                <Plus className="w-4 h-4" /> Add Document
                            </Button>

                            <div className="flex items-center gap-4 border-l border-slate-700 pl-6">
                                <div className="relative cursor-pointer group">
                                    <Bell className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-rose-500 rounded-full border-2 border-slate-800 flex items-center justify-center text-[10px] font-bold text-white">3</span>
                                </div>
                                <div className="flex items-center gap-2 cursor-pointer">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-400 flex items-center justify-center text-xs font-bold text-white">
                                        JD
                                    </div>
                                    <span className="text-sm font-medium hidden lg:block">James Donovan</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {view === 'dashboard' || view === 'documents' || view === 'reminders' ? (
                     <Dashboard 
                        documents={documents} 
                        setDocuments={setDocuments} 
                        manualReminders={manualReminders}
                        setManualReminders={setManualReminders}
                     />
                ) : (
                    <div className="text-center py-20">
                        <h2 className="text-xl text-slate-400">Settings Under Construction</h2>
                    </div>
                )}
            </main>

            {/* Chat Widget */}
            <ChatAssistant 
                documents={documents} 
                history={chatHistory} 
                setHistory={setChatHistory} 
                manualReminders={manualReminders}
            />
        </div>
    );
};

export default App;