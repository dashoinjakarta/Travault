import { NomadDocument, ChatMessage, Reminder, DocType } from "../types";
import { supabase } from "./supabase";

// --- Documents ---

export const saveDocumentToSupabase = async (doc: NomadDocument) => {
    try {
        // 1. Insert Document
        const { data: dbDoc, error: docError } = await supabase
            .from('documents')
            .upsert({
                id: doc.id, // Use existing ID if provided
                title: doc.extractedData.title,
                type: doc.extractedData.type,
                summary: doc.extractedData.summary,
                event_date: doc.extractedData.eventDate || null,
                expiry_date: doc.extractedData.expiryDate || null,
                extracted_data: doc.extractedData, // Store full JSON for frontend flexibility
                file_path: doc.fileData?.startsWith('data:') ? null : doc.fileData, // If it's a URL/path
                risk_analysis: doc.extractedData.riskAnalysis || null
            })
            .select()
            .single();

        if (docError) {
            console.error("Supabase Document Insert Error:", JSON.stringify(docError, null, 2));
            throw docError;
        }

        // 2. Insert Reminders
        if (doc.processedReminders && doc.processedReminders.length > 0) {
            // First delete existing reminders for this doc to avoid duplicates on update
            await supabase.from('reminders').delete().eq('document_id', doc.id);

            const remindersPayload = doc.processedReminders.map(r => ({
                id: r.id,
                document_id: doc.id,
                title: r.title,
                date: r.date,
                time: r.time,
                priority: r.priority,
                source: 'document'
            }));
            
            const { error: remError } = await supabase.from('reminders').insert(remindersPayload);
            if (remError) {
                console.error("Supabase Reminder Insert Error:", JSON.stringify(remError, null, 2));
                throw remError;
            }
        }

        return dbDoc;
    } catch (e) {
        console.error("Failed to save document to Supabase", e);
        throw e;
    }
};

export const loadDocumentsFromSupabase = async (): Promise<NomadDocument[]> => {
    try {
        const { data, error } = await supabase
            .from('documents')
            .select(`
                *,
                reminders (*)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            // Check for missing table error
            if (error.code === '42P01' || error.message.includes('Could not find the table')) {
                console.warn("TABLES MISSING: Please run the SQL from 'supabase/schema.sql' in your Supabase SQL Editor.");
                return []; // Return empty array so app doesn't crash, just shows empty state
            }
            console.error("Supabase Load Error:", JSON.stringify(error, null, 2));
            throw error;
        }

        // Transform DB shape back to Frontend shape
        return data.map((d: any) => ({
            id: d.id,
            fileName: d.title, // Fallback as we didn't store filename explicitly in top level
            fileData: d.file_path, // Could be null if we didn't upload
            mimeType: 'application/octet-stream', // Mock
            uploadDate: d.created_at,
            extractedData: {
                ...d.extracted_data,
                reminders: [], // We use processedReminders
                riskAnalysis: d.risk_analysis
            },
            processedReminders: (d.reminders || []).map((r: any) => ({
                id: r.id,
                title: r.title,
                date: r.date,
                time: r.time,
                priority: r.priority,
                source: r.source,
                docId: d.id
            })),
            isTextBased: d.extracted_data?.type === DocType.CONTRACT // Heuristic
        }));
    } catch (e) {
        console.error("Failed to load documents", e);
        return [];
    }
};

export const deleteDocumentFromSupabase = async (id: string) => {
    try {
        await supabase.from('documents').delete().eq('id', id);
    } catch (e) {
        console.error("Delete failed", e);
    }
};

// --- Reminders (Manual) ---

export const saveManualReminderToSupabase = async (reminder: Reminder) => {
    try {
        await supabase.from('reminders').upsert({
            id: reminder.id,
            title: reminder.title,
            date: reminder.date,
            time: reminder.time,
            priority: reminder.priority,
            source: 'manual'
        });
    } catch (e) {
        console.error("Failed to save manual reminder", e);
    }
};

export const loadManualRemindersFromSupabase = async (): Promise<Reminder[]> => {
    try {
        const { data, error } = await supabase
            .from('reminders')
            .select('*')
            .eq('source', 'manual');
            
        if (error) {
            if (error.code === '42P01' || error.message.includes('Could not find the table')) {
                 return [];
            }
            throw error;
        }

        return data.map((r: any) => ({
            id: r.id,
            title: r.title,
            date: r.date ? r.date.split('T')[0] : '', // Simple formatting
            time: r.time,
            priority: r.priority,
            source: 'manual'
        }));
    } catch (e) {
        return [];
    }
};

export const deleteReminderFromSupabase = async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id);
};

// --- Chat (Keep Local for now or create table) ---
const CHAT_KEY = 'nomadvault_chat';
export const saveChatHistory = (chat: ChatMessage[]) => localStorage.setItem(CHAT_KEY, JSON.stringify(chat));
export const loadChatHistory = (): ChatMessage[] => {
    const d = localStorage.getItem(CHAT_KEY);
    return d ? JSON.parse(d) : [];
};