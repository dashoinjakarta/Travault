
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
    isText: boolean,
    targetLanguage: string = 'English'
): Promise<any> => {
    try {
        const ai = getAI();
        const currentDate = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear();
        
        const systemPrompt = `
        You are an expert Document Intelligence AI for digital nomads.
        Your job is to extract structured data and translate the document into CLEAN, PROFESSIONAL PLAIN TEXT.
        
        CONTEXT:
        - Current Date: ${currentDate}
        - Current Year: ${currentYear}
        - User Preferred Language: "${targetLanguage}"

        CRITICAL TASKS:
        1. **Extraction**: Extract metadata (dates, locations, rules).
        2. **OCR (IMPORTANT)**: 
           - If the document is an IMAGE or PDF-SCAN, you MUST perform OCR and output the **verbatim** text in 'originalContent'.
           - If provided as text, you can summarize it in 'originalContent', but ensure the main text body is preserved.
        3. **Translation & Structuring**: 
           - Translate the FULL document text into "${targetLanguage}".
           
           **FORMATTING RULES (STRICT - NO MARKDOWN):**
           - Output **CLEAN PLAIN TEXT** only.
           - **DO NOT** use Markdown characters (NO asterisks **, NO hashes #, NO underscores _).
           - **HEADERS**: Use UPPERCASE for section headers (e.g. PASSENGER DETAILS).
           - **LISTS**: Use a simple hyphen (-) for lists.
           - **Structure**: Use double newlines to separate sections.
           - **Artifacts**: REMOVE visual artifacts like '______' (signature lines), '-----' (dividers), or page numbers.
           - **Flow**: Ensure the text reads naturally, not like a code dump.

        CRITICAL RULES:
        1. **Date Hallucinations**:
           - Flight/Event dates are usually in ${currentYear} or ${currentYear + 1}.
           - If you see a date like "2030", "2035", etc., it is a PASSPORT/ID EXPIRY date. **DO NOT** use it as the 'eventDate'.
        
        2. **Time Extraction (NO GUESSING)**: 
           - Extract the specific Time (HH:MM) ONLY if explicitly stated in the text.
           - **CRITICAL**: If NO time is found, return NULL or empty string. **DO NOT** guess 12:00 or 00:00.
           - Format: "HH:MM" (24-hour) if present.

        3. **Priority Rules (CONSISTENCY)**:
           - **High**: Flights, Train Departures, Visa Expiries, Passport Expiries, Legal Deadlines, Court Dates.
           - **Medium**: Hotel Check-ins, Rental Payments, Bill Due Dates, Reservations.
           - **Low**: General reminders, "Print this", "Check email", "Review policy".

        4. **Recurring Events (Contracts/Subscriptions)**:
           - If the document implies a recurring obligation (e.g., "Monthly Rent of $500 due on the 1st of each month", "Weekly subscription"), generate a SEPARATE reminder for EACH occurrence.
           - **Limit**: Generate reminders for the duration of the contract OR up to the next 12 months if indefinite.
           - Example: A 1-year lease starting Jan 1st = 12 separate reminders.

        5. **Reminders**: 
           - Create a specific reminder for the *exact time* of the event (if time exists).
           - Create a reminder 2 hours before for "Check-in/Boarding" for flights.
           - **Description**: For each reminder, provide a short, one-sentence description of the action required (e.g., "Go to Gate D12 for boarding" or "Pay monthly rent to Landlord").
        
        6. **Structured Details**:
           - For 'importantDetails', format strings as "Key: Value" (e.g., "Seat: 45A", "Gate: D12").

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
                        title: { type: Type.STRING, description: "Concise title: 'Flight TG102 to BKK'" },
                        type: { 
                            type: Type.STRING, 
                            enum: Object.values(DocType) 
                        },
                        categoryConfidence: { type: Type.NUMBER },
                        summary: { type: Type.STRING, description: `Summary in ${targetLanguage}` },
                        
                        originalContent: { 
                            type: Type.STRING, 
                            description: "The raw, verbatim text extracted from the document in its original language. Clean text only. REQUIRED." 
                        },
                        translatedContent: { 
                            type: Type.STRING, 
                            description: `Professional PLAIN TEXT translation in ${targetLanguage}. No Markdown syntax. Use CAPS for headers.` 
                        },
                        
                        // Critical Metadata
                        eventDate: { type: Type.STRING, description: "Date of the flight/event (YYYY-MM-DD)." },
                        eventTime: { type: Type.STRING, nullable: true, description: "Time of the event (HH:MM) 24h format. NULL if not found." },
                        expiryDate: { type: Type.STRING, description: "Expiration date of document (YYYY-MM-DD)" },
                        location: { type: Type.STRING },
                        referenceNumber: { type: Type.STRING },
                        
                        // Fact Separation
                        importantDetails: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: `Hard facts translated to ${targetLanguage}. Format as 'Label: Value'` 
                        },
                        policyRules: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: `Soft rules translated to ${targetLanguage}` 
                        },

                        // Actions
                        reminders: { 
                            type: Type.ARRAY, 
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING, description: "Short one-sentence description of what to do." },
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
             Details: ${d.extractedData.importantDetails?.join(', ') || ''}`
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
