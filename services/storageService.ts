import { NomadDocument, ChatMessage, Reminder, DocType } from "../types";
import { supabase } from "./supabase";

// --- Documents ---

export const saveDocumentToSupabase = async (doc: NomadDocument) => {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("User not authenticated");
        }

        // 1. Insert Document
        const { data: dbDoc, error: docError } = await supabase
            .from('documents')
            .upsert({
                id: doc.id, // Use existing ID if provided
                user_id: user.id, // Securely link to user
                title: doc.extractedData.title,
                type: doc.extractedData.type,
                summary: doc.extractedData.summary,
                event_date: doc.extractedData.eventDate || null,
                expiry_date: doc.extractedData.expiryDate || null,
                extracted_data: doc.extractedData, // Store full JSON for frontend flexibility
                file_path: doc.file_path || null, // Prefer specific path (Storage URL)
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
                source: 'document',
                user_id: user.id // Ensure reminders are also owned by the user
            }));
            
            const { error: remError } = await supabase.from('reminders').insert(remindersPayload);
            if (remError) {
                console.error("Supabase Reminder Insert Error:", JSON.stringify(remError, null, 2));
                throw remError;
            }
        }

        // 3. Insert Embedding Chunk (for RAG/Vector Search)
        if (doc.extractedData.embedding && doc.extractedData.embedding.length > 0) {
            // Delete existing chunks for this doc first
            await supabase.from('document_chunks').delete().eq('document_id', doc.id);

            const chunkText = `Document: ${doc.extractedData.title} (${doc.extractedData.type})
Summary: ${doc.extractedData.summary}
Date: ${doc.extractedData.eventDate || doc.extractedData.expiryDate || 'N/A'}`;

            const { error: chunkError } = await supabase.from('document_chunks').insert({
                document_id: doc.id,
                content: chunkText,
                embedding: doc.extractedData.embedding
            });

            if (chunkError) {
                 // Log but don't fail the whole operation if vector insert fails
                 console.error("Supabase Chunk Insert Error:", JSON.stringify(chunkError, null, 2));
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
        // Supabase client automatically applies RLS based on the authenticated user's token
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
                console.warn("TABLES MISSING: Please run the SQL from 'supabase/policies.txt' in your Supabase SQL Editor.");
                return []; // Return empty array so app doesn't crash, just shows empty state
            }
            console.error("Supabase Load Error:", JSON.stringify(error, null, 2));
            throw error;
        }

        // Map data and generate signed URLs for private images
        const documents = await Promise.all(data.map(async (d: any) => {
            let fileUrl = d.file_path;

            // If we have a stored path, generate a temporary signed URL
            // This is required because we are making the bucket private
            if (d.file_path && !d.file_path.startsWith('http')) {
                const { data: signedData } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(d.file_path, 3600); // URL valid for 1 hour
                
                if (signedData) {
                    fileUrl = signedData.signedUrl;
                }
            }

            return {
                id: d.id,
                fileName: d.title, // Fallback as we didn't store filename explicitly in top level
                fileData: fileUrl, 
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
            };
        }));

        return documents;
    } catch (e) {
        console.error("Failed to load documents", e);
        return [];
    }
};

export const deleteDocumentFromSupabase = async (id: string) => {
    try {
        // 1. Fetch document to get file path
        const { data: doc, error: fetchError } = await supabase
            .from('documents')
            .select('file_path')
            .eq('id', id)
            .maybeSingle();

        if (fetchError) {
            console.warn("Could not fetch doc details before delete, attempting row deletion anyway.", fetchError);
        }

        // 2. Delete file from Storage if we have a path
        if (doc && doc.file_path) {
            try {
                let filePath = doc.file_path;
                
                // Handle legacy full URLs if stored that way (backwards compatibility)
                if (doc.file_path.includes('/documents/')) {
                    const parts = doc.file_path.split('/documents/');
                    if (parts.length > 1) {
                        filePath = parts[1]; 
                    }
                }
                
                filePath = decodeURIComponent(filePath);

                const { error: storageError } = await supabase.storage
                    .from('documents')
                    .remove([filePath]);
                
                if (storageError) {
                    console.error("Supabase Storage Delete Error (Non-fatal):", storageError);
                }
            } catch (storageErr) {
                console.error("Failed to parse file path for storage deletion", storageErr);
            }
        }

        // 3. Delete from Database (Cascades to reminders and chunks)
        const { error: dbError } = await supabase.from('documents').delete().eq('id', id);
        
        if (dbError) {
            console.error("Supabase DB Delete Error:", dbError);
            throw dbError;
        }

    } catch (e) {
        console.error("Delete operation failed", e);
        throw e;
    }
};

// --- Reminders (Manual) ---

export const saveManualReminderToSupabase = async (reminder: Reminder) => {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Silently fail or handle error if not logged in (app logic prevents this mostly)
            console.error("Cannot save manual reminder: User not authenticated");
            return;
        }

        await supabase.from('reminders').upsert({
            id: reminder.id,
            title: reminder.title,
            date: reminder.date,
            time: reminder.time,
            priority: reminder.priority,
            source: 'manual',
            user_id: user.id // Manual reminders now belong to the user
        });
    } catch (e) {
        console.error("Failed to save manual reminder", e);
    }
};

export const loadManualRemindersFromSupabase = async (): Promise<Reminder[]> => {
    try {
        // RLS will automatically filter this to only show the user's manual reminders
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