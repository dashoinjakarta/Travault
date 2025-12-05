
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
                extracted_data: doc.extractedData, // Saves 'policyRules' etc.
                file_path: doc.file_path || null,
                risk_analysis: doc.extractedData.riskAnalysis || null,
                content_hash: doc.contentHash || null,
                translated_content: doc.extractedData.translatedContent || null,
                original_content: doc.extractedData.originalContent || null,
                translation_language: doc.translationLanguage || 'English'
            })
            .select()
            .single();

        if (docError) {
            console.error("Supabase Insert Error", docError);
            if (docError.code === '42703' || docError.message.includes('content_hash') || docError.message.includes('original_content')) {
                throw new Error("Database Error: Missing columns. Please run 'add_content_hash.txt', 'add_translation_columns.txt' and 'add_original_content.txt'.");
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
                description: r.description,
                date: r.date,
                time: r.time,
                priority: r.priority,
                source: 'document',
                user_id: user.id
            }));
            
            const { error: remError } = await supabase.from('reminders').insert(remindersPayload);
            if (remError) {
                console.error("Reminder Insert Error", remError);
                if (remError.message.includes("Could not find the 'user_id' column") || remError.code === '42703') {
                     throw new Error("Database Error: 'reminders' table is missing 'user_id' or 'description' column. Run 'fix_reminders_table.txt' and 'add_reminder_description.txt'.");
                }
                throw new Error(`Failed to save reminders: ${remError.message}`);
            }
        }

        return dbDoc;
    } catch (e: any) {
        console.error("Failed to save document to Supabase", e);
        if (e instanceof Error) throw e;
        throw new Error(e?.message || JSON.stringify(e) || "Unknown database error");
    }
};

export const loadDocumentsFromSupabase = async (): Promise<NomadDocument[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('documents')
            .select(`*, reminders (*)`)
            .eq('user_id', user.id)
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
                translatedContent: d.translated_content,
                originalContent: d.original_content,
                translationLanguage: d.translation_language,
                extractedData: {
                    ...d.extracted_data,
                    reminders: [], 
                    riskAnalysis: d.risk_analysis,
                    importantDetails: d.extracted_data?.importantDetails || [],
                    policyRules: d.extracted_data?.policyRules || [],
                    translatedContent: d.translated_content,
                    originalContent: d.original_content
                },
                processedReminders: (d.reminders || []).map((r: any) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description,
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { data: doc } = await supabase.from('documents').select('file_path').eq('id', id).maybeSingle();

        if (doc && doc.file_path) {
            let filePath = doc.file_path;
            
            // 1. Robust URL cleaning
            if (filePath.startsWith('http')) {
                 try {
                    const url = new URL(filePath);
                    const pathParts = url.pathname.split('/');
                    const docIndex = pathParts.indexOf('documents');
                    if (docIndex !== -1) {
                        filePath = pathParts.slice(docIndex + 1).join('/');
                    }
                 } catch (e) {
                 }
            }
            
            // 2. Remove any URL encoding
            filePath = decodeURIComponent(filePath);

            // 3. Remove ALL leading slashes
            filePath = filePath.replace(/^\/+/, '');

            // Ensure we are operating in the user's folder
            // If the path stored doesn't include user ID but is just filename, prepend it (Heuristic)
            if (!filePath.startsWith(user.id) && !filePath.includes('/')) {
                 filePath = `${user.id}/${filePath}`;
            }

            console.log("Attempting to delete storage file:", filePath);

            // Attempt 1: Direct Delete
            let { data, error: storageError } = await supabase.storage.from('documents').remove([filePath]);
            
            // SMART DELETE: If direct delete fails (0 items removed or error), try to find the file
            if (storageError || (data && data.length === 0)) {
                console.warn("Direct delete returned 0 items. Attempting Smart Discovery in storage...");
                
                // Extract just the filename (e.g. "file.pdf" from "userid/file.pdf")
                const fileName = filePath.split('/').pop();
                
                if (fileName) {
                    // List all files in the user's folder
                    const { data: files, error: listError } = await supabase.storage
                        .from('documents')
                        .list(user.id);

                    if (!listError && files) {
                        // Find a file that matches the name
                        const match = files.find(f => f.name === fileName);
                        if (match) {
                            const foundPath = `${user.id}/${match.name}`;
                            console.log("Smart Discovery found file at:", foundPath);
                            
                            // Attempt 2: Delete with the discovered authoritative path
                            const { error: retryError } = await supabase.storage
                                .from('documents')
                                .remove([foundPath]);
                                
                            if (retryError) {
                                console.error("Smart Delete retry failed:", retryError);
                            } else {
                                console.log("Smart Delete successful.");
                                storageError = null; // Clear error since we succeeded
                            }
                        } else {
                            console.warn("Smart Discovery: File not found in listing.");
                        }
                    } else {
                        console.warn("Smart Discovery: Failed to list files.", listError);
                    }
                }
            }
            
            if (storageError) {
                console.error("Storage delete error:", storageError);
                // We log but continue to DB delete so the UI doesn't get stuck with a zombie record
            }
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
    const { error } = await supabase.from('reminders').upsert({ 
        ...reminder, 
        user_id: user.id 
    });
    if (error) console.error("Error saving reminder:", error);
};

export const updateReminderInSupabase = async (reminder: Reminder) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('reminders')
        .update({
            title: reminder.title,
            description: reminder.description,
            date: reminder.date,
            time: reminder.time,
            priority: reminder.priority
        })
        .eq('id', reminder.id)
        .eq('user_id', user.id);

    if (error) {
        console.error("Error updating reminder:", error);
        throw new Error("Failed to update reminder");
    }
};

export const loadManualRemindersFromSupabase = async (): Promise<Reminder[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('source', 'manual')
        .eq('user_id', user.id); 
        
    if (error) return [];
    return data.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
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
