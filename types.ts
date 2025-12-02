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
    expiryDate?: string; // ISO Date string
    eventDate?: string; // ISO Date string
    summary: string;
    relevantPeople?: string[];
    reminders: Omit<Reminder, 'id'>[];
    riskAnalysis?: RiskAnalysis;
    embedding?: number[]; // Vector for RAG
}

export interface NomadDocument {
    id: string;
    fileData?: string; // Base64 (image) or Raw Text (Frontend only)
    file_path?: string; // Supabase Storage Path
    mimeType?: string;
    fileName: string;
    uploadDate: string;
    extractedData: ExtractedData;
    processedReminders?: Reminder[]; 
    isTextBased?: boolean; // True for txt/docx, False for image/pdf
    previewImage?: string; // Optional image preview for PDF/Images
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

export type ViewState = 'dashboard' | 'documents' | 'reminders' | 'settings';
