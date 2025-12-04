
import { GoogleGenAI, Type } from "@google/genai";
import { NomadDocument, ChatMessage, DocType, Reminder, RiskAnalysis } from "../types";

// Vite safe API Key access
const getApiKey = (): string => {
    // @ts-ignore
    return process.env.API_KEY || '';
};

// Singleton instance
let aiClient: GoogleGenAI | null = null;

const getAI = () => {
    if (!aiClient) {
        const apiKey = getApiKey();
        aiClient = new GoogleGenAI({ apiKey: apiKey || 'MISSING_API_KEY' });
    }
    return aiClient;
};

// --- Services ---

export const analyzeDocument = async (
    content: string, 
    mimeType: string, 
    isText: boolean
): Promise<any> => {
    try {
        const ai = getAI();
        const currentDate = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear();
        
        const systemPrompt = `
        You are an expert Document Intelligence AI for digital nomads.
        Your job is to extract structured data from travel documents.
        
        CONTEXT:
        - Current Date: ${currentDate}
        - Current Year: ${currentYear}
        - Use this date to resolve relative dates (e.g., "next Tuesday").

        CRITICAL RULES:
        1. **Date Hallucinations**:
           - Flight/Event dates are usually in ${currentYear} or ${currentYear + 1}.
           - If you see a date like "2030", "2035", etc., it is a PASSPORT/ID EXPIRY date. **DO NOT** use it as the 'eventDate'.
        2. **Time Extraction**: 
           - You MUST extract the specific Time (Departure, Check-in) for the 'Reminders'.
           - Format: "HH:MM" (24-hour).
        3. **Reminders**: 
           - Create a specific reminder for the *exact time* of the event (e.g. "Flight TG102 Departure").
           - Create a reminder 2 hours before for "Check-in/Boarding".

        Return valid JSON only.
        `;

        let parts = [];

        if (isText) {
            parts = [
                { text: systemPrompt },
                { text: `DOCUMENT CONTENT:\n${content}` }
            ];
        } else {
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
                        title: { type: Type.STRING, description: "Concise title: 'Flight TG102 to BKK' or 'Hotel Hilton Stay'" },
                        type: { 
                            type: Type.STRING, 
                            enum: Object.values(DocType) 
                        },
                        categoryConfidence: { type: Type.NUMBER },
                        summary: { type: Type.STRING },
                        
                        // Critical Metadata
                        eventDate: { type: Type.STRING, description: "Date of the flight/event (YYYY-MM-DD). NOT expiry date." },
                        expiryDate: { type: Type.STRING, description: "Expiration date of document (YYYY-MM-DD)" },
                        location: { type: Type.STRING },
                        referenceNumber: { type: Type.STRING },
                        
                        // Fact Separation
                        importantDetails: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "Hard facts: Gate 4, Seat 22A, Boarding 14:00." 
                        },
                        policyRules: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "Soft rules: 20kg limit, Non-refundable." 
                        },

                        // Actions - CRITICAL
                        reminders: { 
                            type: Type.ARRAY, 
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING, description: "E.g. 'Boarding for TG102'" },
                                    date: { type: Type.STRING, description: "YYYY-MM-DD" },
                                    time: { type: Type.STRING, description: "HH:MM (24h format). Extract this carefully!" },
                                    priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                                }
                            } 
                        }
                    }
                }
            }
        });

        const text = response.text || "{}";
        const result = JSON.parse(text);

        // Safety cleanup
        if (!result.policyRules) result.policyRules = [];
        if (!result.importantDetails) result.importantDetails = [];

        return result;

    } catch (e) {
        console.error("Gemini Analysis Failed", e);
        throw e;
    }
};

export const chatWithDocuments = async (
    query: string, 
    documents: NomadDocument[],
    reminders: Reminder[],
    history: ChatMessage[]
): Promise<string> => {
    try {
        const ai = getAI();
        const currentDate = new Date().toISOString().split('T')[0];
        
        const relevantDocs = documents.slice(0, 5).map(d => 
            `[Doc: ${d.extractedData.title}] (${d.extractedData.type})
             Event Date: ${d.extractedData.eventDate || 'N/A'}
             Expiry Date: ${d.extractedData.expiryDate || 'N/A'}
             Location: ${d.extractedData.location || 'N/A'}
             Details: ${d.extractedData.importantDetails?.join(', ') || ''}
             Rules: ${d.extractedData.policyRules?.join(', ') || ''}`
        ).join('\n---\n');

        const context = `USER DOCUMENTS:\n${relevantDocs}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `
            System: You are Travault, an intelligent travel assistant.
            Current Date: ${currentDate}.
            
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

export const performRiskAnalysis = async (doc: NomadDocument): Promise<RiskAnalysis> => {
    try {
        const ai = getAI();
        const prompt = `
        Analyze this document for travel risks.
        Doc: ${doc.extractedData.title} (${doc.extractedData.type})
        Rules: ${doc.extractedData.policyRules?.join('; ') || ''}
        Date: ${doc.extractedData.eventDate || doc.extractedData.expiryDate}
        Current Date: ${new Date().toISOString().split('T')[0]}

        Identify conflicts, missing requirements, or strict penalties.
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

        return JSON.parse(response.text || "{}");

    } catch (e) {
        return { score: 0, summary: "Analysis failed", factors: [] };
    }
};