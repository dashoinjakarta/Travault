

export enum DocType {
    VISA = 'Visa',
    PASSPORT = 'Passport',
    INSURANCE = 'Insurance',
    TICKET = 'Ticket',
    CONTRACT = 'Contract',
    RESERVATION = 'Reservation',
    ID = 'ID',
    OTHER = 'Other'
}

export interface Reminder {
    id: string;
    title: string;
    description?: string; // Short one-sentence explanation
    date: string; // ISO Date string
    time?: string;
    priority: 'High' | 'Medium' | 'Low';
    source?: 'document' | 'manual';
    docId?: string;
}

export interface RiskFactor {
    risk: string;
    severity: 'High' | 'Medium' | 'Low';
    description: string;
}

export interface RiskAnalysis {
    score: number; // 0-100 safety score
    summary: string;
    factors: RiskFactor[];
}

export interface ExtractedData {
    title: string;
    type: DocType;
    categoryConfidence: number; // 0-1
    expiryDate?: string; // ISO Date string
    eventDate?: string; // ISO Date string
    eventTime?: string; // HH:MM 24h format
    location?: string; // Airport code, City, Address
    referenceNumber?: string; // Booking Ref, Ticket #, Policy #
    summary: string; // High level summary
    importantDetails: string[]; // Specific metadata (Gate, Seat, etc)
    policyRules: string[]; // "Soft" info: Luggage rules, Cancellation policy
    reminders: Omit<Reminder, 'id'>[];
    riskAnalysis?: RiskAnalysis;
    translatedContent?: string; // The full translated text
    originalContent?: string; // The raw extracted text (OCR/PDF text)
}

export interface NomadDocument {
    id: string;
    user_id?: string;
    contentHash?: string; // SHA-256 fingerprint for duplicate detection
    fileData?: string; // Base64 (image) or Raw Text (Frontend only) or Signed URL
    file_path?: string; // Supabase Storage Path
    mimeType?: string;
    fileName: string;
    fileSize?: number; // Bytes
    uploadDate: string;
    extractedData: ExtractedData;
    processedReminders?: Reminder[]; 
    isTextBased?: boolean; // True for txt/docx/pdf-text, False for image/scan
    previewImage?: string; // Optional image preview for PDF/Images
    translatedContent?: string; // Stored translation
    originalContent?: string; // Stored raw text
    translationLanguage?: string; // e.g., "Spanish"
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

export interface UserProfile {
    id: string;
    first_name: string;
    last_name: string;
    nationality: string;
    language: string;
    phone_country_code: string;
    phone_local_number: string;
    email: string;
}

export type ViewState = 'dashboard' | 'documents' | 'settings';
