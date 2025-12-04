
import { NomadDocument, ChatMessage, Reminder, DocType } from "../types";
import { supabase } from "./supabase";

// --- Helpers ---

const getMimeType = (fileName: string): string => {
    if (!fileName) return 'application/octet-stream';
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    switch (ext) {
        case 'pdf': return 'application/pdf';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'webp': return 'image/webp';
        case 'txt': return 'text/plain';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'doc': return 'application/msword';
        default: return 'application/octet-stream';
    }
};

// --- Documents ---

/**
 * Checks if a document with the same content hash exists for the current user.
 */
export const checkDocumentExistsByHash = async (hash: string): Promise<boolean> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Note: 'content_hash' column must exist in Supabase 'documents' table
        const { data, error } = await supabase
            .from('documents')
            .select('id')
            .eq('user_id', user.id)
            .eq('content_hash', hash)
            .maybeSingle();

        if (error && error.code !== 'PGRST100') { 
            return false;
        }

        return !!data;
    } catch (e) {
        return false;
    }
};

export const saveDocumentToSupabase = async (doc: NomadDocument) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        // 1. Insert Document
        const { data: dbDoc, error: docError } = await supabase
            .from('documents')
            .upsert({
                id: doc.id, 
                user_id: user.id,
                title: doc.extractedData.title,
                type: doc.extractedData.type,
                summary: doc.extractedData.summary,
                event_date: doc.extractedData.eventDate || null,
                expiry_date: doc.extractedData.expiryDate || null,
                extracted_data: doc.extractedData, // Saves 'policyRules' and 'importantDetails'
                file_path: doc.file_path || null,
                risk_analysis: doc.extractedData.riskAnalysis || null,
                content_hash: doc.contentHash || null
            })
            .select()
            .single();

        if (docError) {
            console.error("Supabase Insert Error", docError);
            // Error 42703 is "undefined_column" in Postgres. 
            // This means the user hasn't run the SQL to add 'content_hash'.
            if (docError.code === '42703' || docError.message.includes('content_hash')) {
                throw new Error("Database Error: Missing 'content_hash' column. Please run the 'add_content_hash.txt' SQL script.");
            }
            throw new Error(`Database Error: ${docError.message}`);
        }

        // 2. Insert Reminders
        if (doc.processedReminders && doc.processedReminders.length > 0) {
            await supabase.from('reminders').delete().eq('document_id', doc.id);

            const remindersPayload = doc.processedReminders.map(r => ({
                id: r.id,
                document_id: doc.id,
                title: r.title,
                date: r.date,
                time: r.time,
                priority: r.priority,
                source: 'document',
                user_id: user.id
            }));
            
            const { error: remError } = await supabase.from('reminders').insert(remindersPayload);
            if (remError) {
                console.error("Reminder Insert Error", remError);
                // Check for missing column error
                if (remError.message.includes("Could not find the 'user_id' column") || remError.code === '42703') {
                     throw new Error("Database Error: 'reminders' table is missing 'user_id' column. Please run the 'fix_reminders_table.txt' SQL script.");
                }
                throw new Error(`Failed to save reminders: ${remError.message}`);
            }
        }

        return dbDoc;
    } catch (e: any) {
        console.error("Failed to save document to Supabase", e);
        // Ensure we always throw an Error object, not a plain object
        if (e instanceof Error) throw e;
        throw new Error(e?.message || JSON.stringify(e) || "Unknown database error");
    }
};

export const loadDocumentsFromSupabase = async (): Promise<NomadDocument[]> => {
    try {
        const { data, error } = await supabase
            .from('documents')
            .select(`*, reminders (*)`)
            .order('created_at', { ascending: false });

        if (error) return [];

        const documents = await Promise.all(data.map(async (d: any) => {
            let fileUrl = d.file_path;

            if (d.file_path && !d.file_path.startsWith('http')) {
                const { data: signedData } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(d.file_path, 3600);
                
                if (signedData) fileUrl = signedData.signedUrl;
            }

            const fileName = d.title || 'document';
            const mimeType = getMimeType(d.file_path || fileName);
            
            // Determine if it's text based (PDF, Docx, TXT) vs Image based
            // This helps the UI decide whether to show an iframe or an img tag
            const isTextBased = mimeType === 'application/pdf' || 
                                mimeType === 'text/plain' || 
                                mimeType.includes('wordprocessingml') ||
                                mimeType.includes('msword');

            return {
                id: d.id,
                fileName: fileName,
                fileData: fileUrl, 
                mimeType: mimeType,
                uploadDate: d.created_at,
                contentHash: d.content_hash,
                extractedData: {
                    ...d.extracted_data,
                    reminders: [], 
                    riskAnalysis: d.risk_analysis,
                    importantDetails: d.extracted_data?.importantDetails || [],
                    policyRules: d.extracted_data?.policyRules || []
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
                isTextBased: isTextBased
            };
        }));

        return documents;
    } catch (e) {
        return [];
    }
};

export const deleteDocumentFromSupabase = async (id: string) => {
    try {
        const { data: doc } = await supabase.from('documents').select('file_path').eq('id', id).maybeSingle();

        if (doc && doc.file_path) {
            // Sanitize path: Remove leading slash if present
            let filePath = doc.file_path;
            
            // Remove full URL prefix if present
            if (doc.file_path.includes('/documents/')) {
                const parts = doc.file_path.split('/documents/');
                if (parts.length > 1) filePath = parts[1]; 
            }
            
            // Decode URL encoding
            filePath = decodeURIComponent(filePath);
            
            // CRITICAL: Supabase Storage paths must NOT start with /
            if (filePath.startsWith('/')) {
                filePath = filePath.substring(1);
            }

            const { error: storageError } = await supabase.storage.from('documents').remove([filePath]);
            if (storageError) console.warn("Storage delete warning:", storageError);
        }

        const { error: dbError } = await supabase.from('documents').delete().eq('id', id);
        if (dbError) throw new Error(`Database delete failed: ${dbError.message}`);

    } catch (e: any) {
        console.error("Delete operation failed", e);
        if (e instanceof Error) throw e;
        throw new Error(e?.message || "Unknown error during deletion");
    }
};

// --- Reminders ---

export const saveManualReminderToSupabase = async (reminder: Reminder) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('reminders').upsert({ ...reminder, user_id: user.id });
    if (error) console.error("Error saving reminder:", error);
};

export const loadManualRemindersFromSupabase = async (): Promise<Reminder[]> => {
    const { data, error } = await supabase.from('reminders').select('*').eq('source', 'manual');
    if (error) return [];
    return data.map((r: any) => ({
        id: r.id,
        title: r.title,
        date: r.date ? r.date.split('T')[0] : '',
        time: r.time,
        priority: r.priority,
        source: 'manual'
    }));
};

export const deleteReminderFromSupabase = async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id);
};

// --- Chat ---
const CHAT_KEY = 'nomadvault_chat';
export const saveChatHistory = (chat: ChatMessage[]) => localStorage.setItem(CHAT_KEY, JSON.stringify(chat));
export const loadChatHistory = (): ChatMessage[] => {
    const d = localStorage.getItem(CHAT_KEY);
    return d ? JSON.parse(d) : [];
};
