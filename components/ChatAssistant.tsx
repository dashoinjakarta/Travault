import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, NomadDocument, Reminder } from '../types';
import { chatWithDocuments } from '../services/geminiService';
import { Button } from './UI';
import { Send, Bot, Trash2, MessageCircle, X } from 'lucide-react';
import { saveChatHistory } from '../services/storageService';

interface ChatAssistantProps {
    documents: NomadDocument[];
    history: ChatMessage[];
    setHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    manualReminders: Reminder[];
    isOpen: boolean;
    onClose: () => void;
    initialMessage?: string;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ 
    documents, 
    history, 
    setHistory, 
    manualReminders,
    isOpen,
    onClose,
    initialMessage 
}) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            if (initialMessage) {
                setInput(initialMessage);
            }
        }
    }, [isOpen, initialMessage]);

    useEffect(() => {
        saveChatHistory(history);
    }, [history]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: Date.now()
        };

        setHistory(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const responseText = await chatWithDocuments(userMsg.text, documents, manualReminders, history);
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: responseText,
                timestamp: Date.now()
            };
            setHistory(prev => [...prev, aiMsg]);
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: "Sorry, I encountered an error. Please try again.",
                timestamp: Date.now()
            };
            setHistory(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        if(confirm("Clear chat history?")) {
            setHistory([]);
        }
    };

    // If closed, show just FAB? No, usually FAB opens it. 
    // We will render FAB outside if needed, or handle it here.
    // The previous implementation had FAB inside. We'll keep the FAB logic here
    // but clicking it triggers the props.

    if (!isOpen) {
        return (
             <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
                <button 
                    onClick={onClose} // This effectively "toggles" if the parent handles it right, but here we assume parent passes correct handler. 
                    // Actually, if !isOpen, onClose doesn't make sense to "open".
                    // The App.tsx should handle the toggling. 
                    // Let's assume passed prop 'isOpen' controls visibility of window.
                    // The FAB needs to call a callback to OPEN.
                    // But the interface is `onClose`.
                    // Let's assume the parent handles the state completely.
                    // We need an onToggle or onOpen prop?
                    // To keep it simple, we'll assume the FAB is part of this component's "Closed State" UI.
                    // But `onClose` suggests only closing.
                    // Let's cheat slightly: The parent passes `onClose` which toggles the state in App.tsx
                    // e.g. setIsOpen(!isOpen). So we can use it to open too.
                    className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 bg-blue-600 hover:bg-blue-500 text-white hover:scale-105`}
                >
                    <MessageCircle className="w-6 h-6" />
                </button>
             </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            
            {/* Chat Window */}
            <div className="mb-4 w-[350px] md:w-[400px] h-[500px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
                {/* Header */}
                <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        <div>
                            <h2 className="font-bold text-sm">Travault Assistant</h2>
                            <p className="text-xs text-blue-100">Ask about your documents</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                            <button onClick={handleClear} className="text-white/80 hover:text-white p-1 rounded hover:bg-blue-500" title="Clear History">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded hover:bg-blue-500">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                    {history.length === 0 && (
                        <div className="text-center text-slate-500 mt-10">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bot className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                            </div>
                            <p className="text-sm">How can I help you today?</p>
                            <p className="text-xs mt-2">"When is my flight to Tokyo?"</p>
                        </div>
                    )}
                    
                    {history.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-600 shadow-sm'
                            }`}>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-tl-none px-4 py-3 border border-slate-200 dark:border-slate-600 shadow-sm">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type..."
                            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={isLoading}
                            autoFocus
                        />
                        <button 
                            onClick={handleSend} 
                            disabled={isLoading || !input.trim()}
                            className="w-9 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* FAB (Visible when open too, to close) */}
            <button 
                onClick={onClose}
                className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-white rotate-90`}
            >
                <X className="w-6 h-6" />
            </button>
        </div>
    );
};