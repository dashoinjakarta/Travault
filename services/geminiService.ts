import { GoogleGenAI, Type } from "@google/genai";
import { NomadDocument, ChatMessage, DocType, Reminder, RiskAnalysis } from "../types";

const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

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
        // Fix: Use 'content' (singular) for single embedding request
        const response = await ai.models.embedContent({
            model: "text-embedding-004",
            content: { parts: [{ text }] }
        });
        return response.embedding?.values || [];
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
                                    priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                                },
                                required: ['title', 'date', 'priority']
                            } 
                        }
                    },
                    required: ["title", "type", "summary", "reminders"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        
        const data = JSON.parse(text);
        
        // Generate embedding
        const embeddingText = `${data.title} ${data.type} ${data.summary}`;
        const embedding = await generateEmbedding(embeddingText);
        
        return { ...data, embedding };

    } catch (error) {
        console.error("Analysis failed:", error);
        throw error;
    }
};

export const performRiskAnalysis = async (document: NomadDocument): Promise<RiskAnalysis> => {
    try {
        let parts = [];

        if (document.isTextBased) {
            // Text based analysis
            parts = [
                { text: `You are an Executive Risk Analyst for a digital nomad. Review this document content (${document.extractedData.type}) for potential risks.` },
                { text: document.fileData || '' } // fileData contains raw text for text docs
            ];
        } else {
            // Image based analysis
            const base64Data = document.fileData?.split(',')[1] || '';
            const mimeType = document.mimeType || 'image/png';
            
            parts = [
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                },
                {
                    text: `You are an Executive Risk Analyst for a digital nomad. Review this document (${document.extractedData.type}) for potential risks, strict cancellations, hidden fees, or non-standard clauses.`
                }
            ];
        }
        
        // Add common schema instruction
        parts.push({
            text: `Return JSON:
            - score: A safety score from 0 (Dangerous) to 100 (Safe).
            - summary: A one sentence executive summary of the risk profile.
            - factors: A list of risk factors found (risk, severity, description).`
        });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
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

        const text = response.text;
        if (!text) throw new Error("No response");
        return JSON.parse(text);
    } catch (error) {
        console.error("Risk analysis failed", error);
        throw error;
    }
};

export const chatWithDocuments = async (
    query: string, 
    documents: NomadDocument[], 
    manualReminders: Reminder[],
    chatHistory: ChatMessage[]
): Promise<string> => {
    try {
        const queryEmbedding = await generateEmbedding(query);

        // Filter out docs without embeddings and perform similarity search
        const rankedDocs = documents
            .filter(doc => doc.extractedData.embedding && doc.extractedData.embedding.length > 0)
            .map(doc => {
                const score = cosineSimilarity(queryEmbedding, doc.extractedData.embedding!);
                return { doc, score };
            })
            .sort((a, b) => b.score - a.score);

        const relevantDocs = rankedDocs.slice(0, 5).map(d => d.doc);

        const docContext = relevantDocs.map(d => 
            `ID: ${d.id}
             Title: ${d.extractedData.title}
             Type: ${d.extractedData.type}
             Expiry: ${d.extractedData.expiryDate || 'N/A'}
             Event Date: ${d.extractedData.eventDate || 'N/A'}
             Summary: ${d.extractedData.summary}
             Risk Analysis: ${d.extractedData.riskAnalysis ? JSON.stringify(d.extractedData.riskAnalysis) : 'Not performed'}
             Reminders: ${JSON.stringify(d.processedReminders || d.extractedData.reminders)}`
        ).join('\n---\n');

        const reminderContext = manualReminders.length > 0 ? 
            `MANUAL REMINDERS:\n${manualReminders.map(r => 
                `- [${r.priority}] ${r.title} due on ${r.date} ${r.time || ''}`
            ).join('\n')}` : '';

        const systemInstruction = `You are Travault AI, a smart assistant for digital nomads. 
        You have access to the user's uploaded travel documents (filtered by relevance) and manual reminders. 
        
        Answer specific questions about dates, deadlines, and details.
        If asked about risks, refer to the Risk Analysis if available.
        If a document is expired or expiring soon, warn the user.
        Keep answers concise, professional, and helpful.
        
        RELEVANT DOCUMENTS:
        ${docContext}
        
        ${reminderContext}`;

        const historyParts = chatHistory.slice(-6).map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: historyParts,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        const result = await chat.sendMessage({ message: query });
        return result.text || "I couldn't process that response.";

    } catch (error) {
        console.error("Chat failed:", error);
        return "Sorry, I'm having trouble connecting to the Travault assistant right now.";
    }
};