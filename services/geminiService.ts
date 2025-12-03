import { GoogleGenAI, Type } from "@google/genai";
import { NomadDocument, ChatMessage, DocType, Reminder, RiskAnalysis } from "../types";

// Vite replaces process.env.API_KEY with the actual string literal at build time.
// We access it directly.
const getApiKey = () => {
    return process.env.API_KEY || '';
};

// Singleton instance
let aiClient: GoogleGenAI | null = null;

const getAI = () => {
    if (!aiClient) {
        const apiKey = getApiKey();
        // Initialize with a placeholder if missing to prevent constructor crash, 
        // calls will simply fail with 401 later which can be handled UI-side.
        aiClient = new GoogleGenAI({ apiKey: apiKey || 'MISSING_API_KEY' });
    }
    return aiClient;
};

// --- Helpers ---

// Calculate Cosine Similarity between two vectors
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    if (vecA.length !== vecB.length) return 0;

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
};

// Generate Embedding for text
export const generateEmbedding = async (text: string): Promise<number[]> => {
    if (!text || !text.trim()) return [];
    try {
        const ai = getAI();
        const response = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: text
        });
        return response.embeddings?.[0]?.values || [];
    } catch (e) {
        console.error("Embedding generation failed", e);
        return [];
    }
};

// --- Services ---

/**
 * Analyzes a document which can be either an Image (Base64) or Raw Text.
 */
export const analyzeDocument = async (
    content: string, 
    mimeType: string, 
    isText: boolean
): Promise<any> => {
    try {
        const ai = getAI();
        // Construct prompts based on input type
        const systemPrompt = `Analyze this travel document. Extract the following information in JSON format:
        - title: A short, descriptive title (e.g., "Visa for Thailand", "Flight to Bali", "Apartment Lease").
        - type: The type of document (Visa, Passport, Insurance, Ticket, Contract, Reservation, ID, Other).
        - expiryDate: The expiration date if applicable (YYYY-MM-DD).
        - eventDate: The date of the event/travel/start if applicable (YYYY-MM-DD).
        - summary: A brief summary of key details (max 2 sentences).
        - reminders: An array of specific action items or reminders derived from the document.
          Each reminder should have:
          - title: The reminder text (e.g. "Check-in online", "Pay rent").
          - date: The date for the reminder (YYYY-MM-DD). Defaults to event/expiry date if specific reminder date isn't found.
          - time: Optional time string (e.g. "10:30 AM").
          - priority: "High", "Medium", or "Low".`;

        let parts = [];

        if (isText) {
            // Text-only mode (TXT, DOCX)
            parts = [
                { text: systemPrompt },
                { text: `DOCUMENT CONTENT:\n${content}` }
            ];
        } else {
            // Multimodal mode (Image, PDF converted to Image)
            parts = [
                {
                    inlineData: {
                        data: content,
                        mimeType: mimeType
                    }
                },
                { text: systemPrompt }
            ];
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        type: { 
                            type: Type.STRING, 
                            enum: [
                                DocType.VISA, 
                                DocType.PASSPORT, 
                                DocType.INSURANCE, 
                                DocType.TICKET, 
                                DocType.CONTRACT, 
                                DocType.RESERVATION, 
                                DocType.ID,
                                DocType.OTHER
                            ] 
                        },
                        expiryDate: { type: Type.STRING, nullable: true },
                        eventDate: { type: Type.STRING, nullable: true },
                        summary: { type: Type.STRING },
                        reminders: { 
                            type: Type.ARRAY, 
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    date: { type: Type.STRING },
                                    time: { type: Type.STRING, nullable: true },
                                    priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                                }
                            } 
                        }
                    }
                }
            }
        });

        // Use the proper property to get text from the response object
        const text = response.text || "{}";
        return JSON.parse(text);

    } catch (e) {
        console.error("Gemini Analysis Failed", e);
        throw e;
    }
};

/**
 * Chat with your documents using RAG (Retrieval Augmented Generation).
 * We will perform a simple in-memory search here for the prototype, 
 * but in production this uses Supabase Vector Store.
 */
export const chatWithDocuments = async (
    query: string, 
    documents: NomadDocument[],
    reminders: Reminder[],
    history: ChatMessage[]
): Promise<string> => {
    try {
        const ai = getAI();
        
        // 1. Prepare Context from Documents (Simple Client-Side RAG)
        // In a real app, we would embed the query and search Supabase vector store
        const relevantDocs = documents.slice(0, 5).map(d => 
            `Title: ${d.extractedData.title} (${d.extractedData.type})
             Date: ${d.extractedData.eventDate || d.extractedData.expiryDate || 'N/A'}
             Summary: ${d.extractedData.summary}`
        ).join('\n---\n');

        const relevantReminders = reminders.slice(0, 5).map(r => 
            `Reminder: ${r.title} due on ${r.date} (${r.priority} Priority)`
        ).join('\n');

        const context = `
        USER DOCUMENTS:
        ${relevantDocs}

        USER REMINDERS:
        ${relevantReminders}
        `;

        // 2. Chat
        // We use the model directly with context instead of chat session for RAG simplicity here
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `
            System: You are Travault, a helpful AI assistant for digital nomads. 
            Use the provided context to answer the user's question. 
            If you don't know the answer based on the context, say so politely.
            Keep answers concise and helpful.

            Context:
            ${context}

            Chat History:
            ${history.map(h => `${h.role}: ${h.text}`).join('\n')}

            User: ${query}
            `,
        });

        return response.text || "I couldn't generate a response.";

    } catch (e) {
        console.error("Chat Failed", e);
        return "Sorry, I'm having trouble connecting to the AI right now.";
    }
};

/**
 * Perform a risk analysis on a document.
 */
export const performRiskAnalysis = async (doc: NomadDocument): Promise<RiskAnalysis> => {
    try {
        const ai = getAI();
        const prompt = `
        Analyze this document for potential risks for a digital nomad/traveler.
        Document: ${doc.extractedData.title} (${doc.extractedData.type})
        Summary: ${doc.extractedData.summary}
        Date: ${doc.extractedData.eventDate || doc.extractedData.expiryDate}

        Identify:
        1. Ambiguities or missing critical info.
        2. Date conflicts or tight deadlines (assuming today is ${new Date().toISOString().split('T')[0]}).
        3. Compliance issues (visa expiry, insurance coverage gaps).

        Return JSON:
        {
            "score": number (0-100, 100 is safest),
            "summary": "Short risk summary",
            "factors": [
                { "risk": "Title", "severity": "High"|"Medium"|"Low", "description": "Details" }
            ]
        }
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.INTEGER },
                        summary: { type: Type.STRING },
                        factors: { 
                            type: Type.ARRAY, 
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    risk: { type: Type.STRING },
                                    severity: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                                    description: { type: Type.STRING }
                                }
                            } 
                        }
                    }
                }
            }
        });

        const text = response.text || "{}";
        return JSON.parse(text);

    } catch (e) {
        console.error("Risk Analysis Failed", e);
        return {
            score: 0,
            summary: "Analysis failed",
            factors: []
        };
    }
};