
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
    const { content, mimeType, isText, fileName, userId, contentHash } = await req.json();

    // 1. Initialize Clients
    const supabaseClient = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    );
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY ?? '' });

    // 2. Duplicate Check (Backup)
    if (contentHash) {
        const { data } = await supabaseClient
            .from('documents')
            .select('id')
            .eq('user_id', userId)
            .eq('content_hash', contentHash)
            .maybeSingle();
        
        if (data) {
             return new Response(JSON.stringify({ error: "Duplicate document detected" }), {
                status: 409,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    }

    // 3. Construct Prompt (Strict Metadata vs Policy)
    const systemPrompt = `
    You are an expert Document Intelligence AI.
    Extract structured data.
    
    Goals:
    1. **Critical Metadata**: Event dates, Expiry dates, Location, Reference Numbers.
    2. **Policy Separation**:
       - 'importantDetails': Hard facts (Seat, Gate, Room).
       - 'policyRules': Soft rules (Luggage, Cancellation).
    `;
    
    let parts = [];
    if (isText) {
      parts = [{ text: systemPrompt }, { text: `DOCUMENT:\n${content}` }];
    } else {
      parts = [
        { inlineData: { data: content, mimeType: mimeType } },
        { text: systemPrompt }
      ];
    }

    // 4. Call Gemini
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
                location: { type: Type.STRING, nullable: true },
                referenceNumber: { type: Type.STRING, nullable: true },
                summary: { type: Type.STRING },
                
                importantDetails: { type: Type.ARRAY, items: { type: Type.STRING } },
                policyRules: { type: Type.ARRAY, items: { type: Type.STRING } },

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

    // 5. Save to Supabase DB
    const { data: docData, error: docError } = await supabaseClient
      .from('documents')
      .insert({
        user_id: userId,
        title: data.title,
        type: data.type,
        summary: data.summary,
        event_date: data.eventDate,
        expiry_date: data.expiryDate,
        extracted_data: data,
        content_hash: contentHash
      })
      .select()
      .single();

    if (docError) throw docError;

    // 6. Save Reminders
    if (data.reminders && data.reminders.length > 0) {
      const remindersPayload = data.reminders.map((r: any) => ({
        document_id: docData.id,
        title: r.title,
        date: r.date,
        time: r.time,
        priority: r.priority,
        source: 'document',
        user_id: userId
      }));
      
      await supabaseClient.from('reminders').insert(remindersPayload);
    }

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
