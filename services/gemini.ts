import { GoogleGenAI } from "@google/genai";
import { Category, MonthlyLogs, LogState } from "../types";

export const getInsights = async (
  monthLabel: string,
  categories: Category[],
  logs: MonthlyLogs
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Format data for AI
  const summary = categories.map(cat => {
    const daysActive = Object.values(logs).filter(dayLog => dayLog.entries?.[cat.id] === LogState.ON).length;
    const daysQuestionable = Object.values(logs).filter(dayLog => dayLog.entries?.[cat.id] === LogState.QUESTIONABLE).length;
    return `${cat.name}: ${daysActive} days active, ${daysQuestionable} days questionable.`;
  }).join('\n');

  // Include notes in summary
  const notesSummary = Object.entries(logs)
    .filter(([_, log]) => log.note)
    .map(([day, log]) => `Day ${day}: ${log.note}`)
    .join('\n');

  const prompt = `
    Based on the following activity logs and marginalia for ${monthLabel}, provide a concise, motivational, and analytical insight. 
    Identify patterns, successes, and correlations between specific habits and observations. Keep it under 150 words.
    
    Activity Data:
    ${summary}

    Marginalia (Observations):
    ${notesSummary}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional life coach and data analyst. Provide actionable insights based on habit tracking data and qualitative marginalia.",
        temperature: 0.7,
      }
    });
    return response.text || "No insights available at this time.";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Failed to fetch AI insights. Please check your connection or try again later.";
  }
};