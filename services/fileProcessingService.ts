
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// Handle module structure differences in CDN environments
// @ts-ignore
const pdfLib = pdfjsLib.default || pdfjsLib;

// CRITICAL FIX: Ensure Worker version matches the package.json version (3.11.174)
// Since we removed the importmap, we are using the local package version.
try {
    if (pdfLib && pdfLib.GlobalWorkerOptions) {
        pdfLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
} catch (e) {
    console.warn("Failed to initialize PDF Worker.", e);
}

export interface ProcessedFile {
    content: string; // The content sent to AI (Text or Base64 Image)
    mimeType: string;
    isText: boolean; // Tells Gemini if it should read as text or vision
    preview?: string; // Data URL for UI display
    file: File; // The optimized file object (compressed)
    hash: string; // SHA-256 fingerprint
}

// --- 1. Deduplication Logic ---

const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// --- 2. Compression Logic ---

/**
 * Compresses an image file if it's larger than 1MB.
 * Resizes max dimension to 2000px and converts to JPEG 80%.
 */
const compressImage = async (file: File): Promise<File> => {
    if (file.size <= 1 * 1024 * 1024) return file; // < 1MB, keep original

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 2000;
            let width = img.width;
            let height = img.height;

            if (width > height && width > maxDim) {
                height *= maxDim / width;
                width = maxDim;
            } else if (height > maxDim) {
                width *= maxDim / height;
                height = maxDim;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                resolve(file); 
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) {
                    // Return new compressed file
                    resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' }));
                } else {
                    resolve(file);
                }
            }, 'image/jpeg', 0.8);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };

        img.src = url;
    });
};

// --- 3. Text Extraction Logic ---

const extractTextFromPDF = async (file: File): Promise<string | null> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        let fullText = '';
        
        // Scan first 5 pages max (sufficient for travel docs)
        const maxPages = Math.min(pdf.numPages, 5);
        
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
        }

        // Heuristic: If < 50 chars, it's likely a scan (image inside PDF)
        if (fullText.trim().length < 50) return null;
        
        return fullText;
    } catch (e) {
        console.warn("PDF Text Extraction Failed:", e);
        return null;
    }
};

const generatePdfPreview = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        // Scale 1.5 for better thumbnail quality
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) throw new Error("Canvas context missing");

        await page.render({ canvasContext: context, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
        console.warn("PDF Preview generation failed", e);
        return ""; // Return empty string so UI shows fallback instead of broken image
    }
};

// --- Main Pipeline ---

export const processFile = async (originalFile: File): Promise<ProcessedFile> => {
    
    // Step A: Hash original file for duplicate checking
    const hash = await calculateFileHash(originalFile);

    let fileToUpload = originalFile;
    let contentForAI = "";
    let isText = false;
    let mimeTypeForAI = originalFile.type;
    let preview = "";

    // Step B: Route by File Type

    // Case 1: PDF
    if (originalFile.type === 'application/pdf') {
        // Attempt preview generation first (Critical for UI)
        preview = await generatePdfPreview(originalFile);
        
        const extractedText = await extractTextFromPDF(originalFile);

        if (extractedText) {
            // Text Layer Found -> Send Text to AI (Efficient)
            contentForAI = extractedText;
            isText = true;
            mimeTypeForAI = 'text/plain';
            fileToUpload = originalFile; // Keep PDF for storage
        } else {
            // Scan Found -> Send Image to AI (Vision)
            // If we have a preview, use that base64 as the input for Gemini Vision
            if (preview) {
                contentForAI = preview.split(',')[1];
                isText = false;
                mimeTypeForAI = 'image/jpeg';
            }
            fileToUpload = originalFile; // Keep PDF for storage
        }
    }
    // Case 2: Images
    else if (originalFile.type.startsWith('image/')) {
        // Compress the image for Storage AND AI
        fileToUpload = await compressImage(originalFile);
        
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(fileToUpload);
        });
        
        const base64Data = await base64Promise;
        preview = base64Data;
        contentForAI = base64Data.split(',')[1];
        mimeTypeForAI = 'image/jpeg';
        isText = false;
    }
    // Case 3: DOCX / Text
    else if (originalFile.name.endsWith('.docx')) {
        const arrayBuffer = await originalFile.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        contentForAI = result.value;
        isText = true;
        mimeTypeForAI = 'text/plain';
        // Fake preview for docx
        preview = ""; 
    }
    else if (originalFile.type === 'text/plain') {
        contentForAI = await originalFile.text();
        isText = true;
        mimeTypeForAI = 'text/plain';
        preview = "";
    }

    return {
        content: contentForAI,
        mimeType: mimeTypeForAI,
        isText,
        preview, // Can be empty string if failed
        file: fileToUpload,
        hash
    };
};

export const uploadFileToStorage = async (file: File, userId: string): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error } = await supabase.storage.from('documents').upload(filePath, file);
        if (error) throw error;

        return filePath;
    } catch (e) {
        console.error("Storage upload error:", e);
        return null;
    }
};