import { GoogleGenAI, Type } from "@google/genai";
import { cleanArticleText } from "../lib/textCleaner";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedPlayer {
  name: string;
  context: string;
  bid: string | null;
  role: 'SP' | 'RP' | null;
}

export async function extractPlayerNames(input: { text?: string; url?: string }): Promise<{ players: ExtractedPlayer[]; cleanedText: string }> {
  const { text, url } = input;
  
  if (!text && !url) return { players: [], cleanedText: '' };

  try {
    let articleContent = text || '';
    let cleanedText = '';
    
    // If URL is provided, fetch it via our proxy first
    if (url) {
      try {
        const proxyResponse = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
        if (!proxyResponse.ok) {
          const errorData = await proxyResponse.json();
          throw new Error(errorData.error || `Proxy fetch failed: ${proxyResponse.statusText}`);
        }
        articleContent = await proxyResponse.text();
      } catch (proxyError) {
        console.error("Proxy error, falling back to urlContext:", proxyError);
        // Fallback to urlContext if proxy fails
      }
    }

     const prompt = `Extract all baseball player names mentioned in the ${url && !articleContent ? 'article at the provided URL' : 'following text'}. 
    For each player, extract:
    1. The player's name.
    2. 1-2 sentences from the article providing context about why they are mentioned.
    3. Any specific FAAB bid or monetary recommendation mentioned for them (e.g., "$15", "5%", "Budget candidate"). If not mentioned, use "None".
    4. If the player is a pitcher, determine if they are a Starting Pitcher ("SP") or Relief Pitcher/Closer ("RP") based on the text. For non-pitchers or if unknown, use "N/A".
    
    Return the results as a JSON array of objects, each with "name", "context", "bid", and "role" properties.
    Only include names that are likely to be professional baseball players.
    If you cannot access the content or find no players, return an empty array [].`;

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            context: { type: Type.STRING },
            bid: { type: Type.STRING },
            role: { type: Type.STRING }
          },
          required: ["name", "context", "bid", "role"]
        },
      },
    };

    // If we have content, clean it.
    let contents = '';
    if (articleContent) {
      cleanedText = cleanArticleText(articleContent);
      contents = `${prompt}\n\nText:\n${cleanedText}`;
    } else if (url) {
      // Fallback if proxy failed and we only have a URL
      contents = `${prompt}\n\nPlease try to analyze the content if you have access to this URL: ${url}`;
    }

    // Create a promise for the AI call
    const aiCall = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config,
    });

    // Add a 60-second timeout (increased from 30s)
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("The request timed out. This often happens with paywalled or slow websites.")), 60000)
    );

    const response = await Promise.race([aiCall, timeoutPromise]);

    if (!response.text) {
      return { players: [], cleanedText };
    }

    // Attempt to extract JSON from the response text
    // Sometimes AI wraps JSON in code blocks or adds extra text
    let jsonStr = response.text.trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const result = JSON.parse(jsonStr || "[]");
      const players = (Array.isArray(result) ? result : []).map((p: any) => ({
        ...p,
        bid: p.bid === "None" ? null : p.bid,
        role: (p.role === "N/A" || p.role === "None") ? null : p.role
      }));
      return { players, cleanedText };
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw text:", response.text);
      return { players: [], cleanedText };
    }
  } catch (error) {
    console.error("Error extracting player names:", error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("timed out")) {
      throw new Error("The article is taking too long to load. This is common with paywalled sites. Please try uploading a PDF of the article instead.");
    }
    
    if (errorMessage.includes("429")) {
      throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    }

    throw new Error(`Failed to identify player names: ${errorMessage}`);
  }
}
