import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { NomadDocument, ViewState, ChatMessage, Reminder } from './types';
import { Dashboard } from './components/Dashboard';
import { ChatAssistant } from './components/ChatAssistant';
import { Plus, Sun, Moon, LogOut } from 'lucide-react';
import { loadDocumentsFromSupabase, loadChatHistory, loadManualRemindersFromSupabase } from './services/storageService';
import { Button } from './components/UI';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { SignUp } from './components/SignUp';

// --- Authenticated App Layout (Existing Logic) ---

const AuthenticatedApp: React.FC = () => {
    const { user, signOut } = useAuth();
    const [view, setView] = useState<ViewState>('dashboard');
    const [documents, setDocuments] = useState<NomadDocument[]>([]);
    const [manualReminders, setManualReminders] = useState<Reminder[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Data Load
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const results = await Promise.allSettled([
                    loadDocumentsFromSupabase(),
                    loadManualRemindersFromSupabase()
                ]);

                const docs = results[0].status === 'fulfilled' ? results[0].value : [];
                const reminders = results[1].status === 'fulfilled' ? results[1].value : [];

                const chat = loadChatHistory();
                
                setDocuments(docs);
                setManualReminders(reminders);
                setChatHistory(chat);
            } catch (e) {
                console.error("Initialization failed", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 font-sans selection:bg-blue-500/30 transition-colors duration-200">
            {/* Top Navigation */}
            <nav className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo & Nav Links */}
                        <div className="flex items-center gap-12">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">Travault</span>
                            </div>
                            <div className="hidden md:flex items-baseline space-x-4">
                                {['Dashboard', 'Documents', 'Reminders'].map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => setView(item.toLowerCase() as ViewState)}
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                            (view === item.toLowerCase() || (view === 'dashboard' && item === 'Dashboard'))
                                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' 
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                                        }`}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-6">
                            <ThemeToggle />

                            <div className="hidden lg:flex items-center gap-3">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Setup</span>
                                <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 w-3/4"></div>
                                </div>
                            </div>

                            <Button variant="blue" className="hidden sm:flex text-sm py-1.5 px-3" onClick={() => document.getElementById('upload-input')?.click()}>
                                <Plus className="w-4 h-4" /> Add Doc
                            </Button>

                            <div className="flex items-center gap-4 border-l border-slate-200 dark:border-slate-700 pl-6 transition-colors">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-400 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <button onClick={() => signOut()} title="Sign Out" className="text-slate-400 hover:text-rose-500 transition-colors">
                                        <LogOut className="w-5 h-5" />
                                    </button>
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
                        <h2 className="text-xl text-slate-500 dark:text-slate-400">Settings Under Construction</h2>
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

// --- Theme Component ---
const ThemeToggle = () => {
    const [theme, setTheme] = useState<'light'|'dark'>('dark');

    useEffect(() => {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            setTheme('dark');
            document.documentElement.classList.add('dark');
        } else {
            setTheme('light');
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = () => {
        if (theme === 'dark') {
            setTheme('light');
            localStorage.theme = 'light';
            document.documentElement.classList.remove('dark');
        } else {
            setTheme('dark');
            localStorage.theme = 'dark';
            document.documentElement.classList.add('dark');
        }
    };

    return (
        <button 
            onClick={toggleTheme}
            className="p-2 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            title="Toggle Theme"
        >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
    );
}

// --- Route Protection ---
const ProtectedRoute = () => {
    const { user, loading } = useAuth();
    if (loading) return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );
    if (!user) return <Navigate to="/login" replace />;
    return <Outlet />;
};

// --- Main Router ---
const App: React.FC = () => {
    return (
        <AuthProvider>
            <HashRouter>
                <Routes>
                    <Route path="/login" element={<><div className="absolute top-4 right-4"><ThemeToggle /></div><Login /></>} />
                    <Route path="/signup" element={<><div className="absolute top-4 right-4"><ThemeToggle /></div><SignUp /></>} />
                    
                    <Route element={<ProtectedRoute />}>
                        <Route path="/*" element={<AuthenticatedApp />} />
                    </Route>
                </Routes>
            </HashRouter>
        </AuthProvider>
    );
};

export default App;