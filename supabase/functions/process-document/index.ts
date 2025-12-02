import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GoogleGenAI, Type } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { content, mimeType, isText, fileName, userId } = await req.json();

    // 1. Initialize Clients
    const supabaseClient = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    );
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY ?? '' });

    // 2. Construct Prompt (Same as Frontend logic)
    const systemPrompt = `Analyze this travel document. Extract in JSON: title, type, dates, summary, reminders.`;
    
    let parts = [];
    if (isText) {
      parts = [{ text: systemPrompt }, { text: `DOCUMENT:\n${content}` }];
    } else {
      parts = [
        { inlineData: { data: content, mimeType: mimeType } },
        { text: systemPrompt }
      ];
    }

    // 3. Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                type: { type: Type.STRING },
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
                            priority: { type: Type.STRING }
                        }
                    } 
                }
            }
        }
      }
    });

    const data = JSON.parse(response.text);

    // 4. Save to Supabase DB
    const { data: docData, error: docError } = await supabaseClient
      .from('documents')
      .insert({
        user_id: userId,
        title: data.title,
        type: data.type,
        summary: data.summary,
        event_date: data.eventDate,
        expiry_date: data.expiryDate,
        extracted_data: data
      })
      .select()
      .single();

    if (docError) throw docError;

    // 5. Save Reminders
    if (data.reminders && data.reminders.length > 0) {
      const remindersPayload = data.reminders.map((r: any) => ({
        document_id: docData.id,
        title: r.title,
        date: r.date, // Ensure DB expects standard ISO or handle casting
        time: r.time,
        priority: r.priority,
        source: 'document'
      }));
      
      await supabaseClient.from('reminders').insert(remindersPayload);
    }

    // 6. Generate Embeddings (Optional, if you want to do RAG immediately)
    // ... embedding logic here ...

    return new Response(JSON.stringify({ success: true, document: docData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});