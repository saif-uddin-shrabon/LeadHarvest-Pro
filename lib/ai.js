/**
 * LeadHarvest Pro — AI Helper Module
 * Integration with OpenAI API for data extraction and outreach personalization.
 */

/**
 * Call OpenAI Chat Completions API.
 * @param {string} systemPrompt - Instruction for the AI behavior.
 * @param {string} userPrompt - The actual task or data to process.
 * @param {string} apiKey - Users private OpenAI API key.
 * @param {Object} options - Optional parameters (temperature, model).
 */
export async function callGPT(systemPrompt, userPrompt, apiKey, options = {}) {
    if (!apiKey) throw new Error('OpenAI API Key is required.');

    const model = options.model || 'gpt-4o-mini';
    const temperature = options.temperature ?? 0.7;

    try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature
            })
        });

        if (!resp.ok) {
            const errorData = await resp.json();
            const msg = errorData.error?.message || resp.statusText;

            // Surface friendly messages for common billing/auth errors
            if (resp.status === 429) {
                throw new Error('OpenAI quota exceeded. Please add credits at platform.openai.com/settings/billing and try again.');
            }
            if (resp.status === 401) {
                throw new Error('Invalid OpenAI API Key. Please check the key in Settings and try again.');
            }

            throw new Error(`OpenAI API Error: ${msg}`);
        }

        const data = await resp.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (error) {
        console.error('GPT Call Failed:', error);
        throw error;
    }
}

/**
 * Generate a personalized outreach sequence using AI.
 * @param {Object} lead - The lead data object.
 * @param {string} customNote - User provided personalization context.
 * @param {string} apiKey - OpenAI API key.
 */
export async function generateAIOutreach(lead, customNote, apiKey) {
    const systemPrompt = `You are an expert sales outreach assistant. 
Your goal is to write a highly personalized, 3-step email sequence for a lead.
The tone should be professional, helpful, and not pushy.

Lead Data:
- Name: ${lead.name || 'N/A'}
- Company: ${lead.company || 'N/A'}
- Title: ${lead.title || 'N/A'}
- Industry: ${lead.industry || 'N/A'}
- Website: ${lead.website || 'N/A'}
- Extra Context: ${customNote || 'No specific note provided.'}

Output Format: JSON array of 3 email objects. Each object should have:
- name: (e.g., "Initial Outreach", "Follow-Up")
- day: (e.g., "Day 1", "Day 4")
- subject: String
- body: String (Use single newlines for spacing)

Only return the JSON array, no other text.`;

    const userPrompt = `Write the sequence now based on the lead data.`;

    const response = await callGPT(systemPrompt, userPrompt, apiKey, { temperature: 0.8 });

    try {
        // Remove markdown code blocks if present
        const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse AI response:', response);
        throw new Error('AI generated an invalid format. Please try again.');
    }
}
