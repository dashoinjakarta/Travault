
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
    location?: string; // Airport code, City, Address
    referenceNumber?: string; // Booking Ref, Ticket #, Policy #
    summary: string; // High level summary
    importantDetails: string[]; // Specific metadata (Gate, Seat, etc)
    policyRules: string[]; // "Soft" info: Luggage rules, Cancellation policy
    reminders: Omit<Reminder, 'id'>[];
    riskAnalysis?: RiskAnalysis;
}

export interface NomadDocument {
    id: string;
    user_id?: string;
    contentHash?: string; // SHA-256 fingerprint for duplicate detection
    fileData?: string; // Base64 (image) or Raw Text (Frontend only)
    file_path?: string; // Supabase Storage Path
    mimeType?: string;
    fileName: string;
    fileSize?: number; // Bytes
    uploadDate: string;
    extractedData: ExtractedData;
    processedReminders?: Reminder[]; 
    isTextBased?: boolean; // True for txt/docx/pdf-text, False for image/scan
    previewImage?: string; // Optional image preview for PDF/Images
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

export type ViewState = 'dashboard' | 'documents' | 'reminders' | 'settings';
