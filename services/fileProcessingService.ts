import mammoth from 'mammoth';
import { convertPdfToImage } from './pdfService';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessedFile {
    content: string; // Base64 or Text
    mimeType: string;
    isText: boolean;
    preview?: string; // Base64 Image for UI preview (if available)
    file?: File; // Original file ref
}

export const processFile = async (file: File): Promise<ProcessedFile> => {
    
    // 1. PDF Handling (Convert to Image for Vision AI)
    if (file.type === 'application/pdf') {
        try {
            const base64Image = await convertPdfToImage(file);
            return {
                content: base64Image.split(',')[1], // Remove data URL prefix for API
                mimeType: 'image/png', // We treat converted PDF as PNG
                isText: false,
                preview: base64Image,
                file: file
            };
        } catch (e) {
            console.error("PDF Processing failed", e);
            throw new Error("Failed to process PDF");
        }
    }

    // 2. Image Handling
    if (file.type.startsWith('image/')) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                resolve({
                    content: result.split(',')[1],
                    mimeType: file.type,
                    isText: false,
                    preview: result,
                    file: file
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 3. Text File Handling
    if (file.type === 'text/plain') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    content: reader.result as string,
                    mimeType: 'text/plain',
                    isText: true,
                    file: file
                });
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // 4. Word Document (.docx) Handling
    if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const arrayBuffer = event.target?.result as ArrayBuffer;
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    resolve({
                        content: result.value,
                        mimeType: 'text/plain', // Treat extracted text as plain text for AI
                        isText: true,
                        file: file
                    });
                } catch (e) {
                    console.error("DOCX extraction failed", e);
                    reject(new Error("Failed to read Word document"));
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    throw new Error("Unsupported file type");
};

export const uploadFileToStorage = async (file: File): Promise<string | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            throw new Error("User must be logged in to upload files.");
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        // Store in a folder named after the user ID for security
        const filePath = `${user.id}/${fileName}`;

        const { error } = await supabase.storage.from('documents').upload(filePath, file);
        
        if (error) {
            console.error("Storage upload error:", error);
            return null;
        }

        // Return the storage path (not the public URL) so we can generate signed URLs later
        return filePath;
    } catch (e) {
        console.error("Upload exception:", e);
        return null;
    }
};