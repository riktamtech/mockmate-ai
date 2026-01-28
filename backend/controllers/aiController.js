const { GoogleGenAI, Type, Modality } = require("@google/genai");
const Interview = require('../models/Interview');

// Initialize Gemini API with validation
if (!process.env.GOOGLE_API_KEY) {
  console.error('FATAL: GOOGLE_API_KEY not set in environment variables. Backend will not function.');
  console.error('Set GOOGLE_API_KEY in your .env file before starting the server.');
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || '' });

// Map prefixed models to actual Gemini models
const MODEL_MAP = {
  'mockmate-coordinator': 'gemini-3-flash-preview',
  'mockmate-interviewer': 'gemini-3-flash-preview',
  'mockmate-tts': 'gemini-2.5-flash-preview-tts'
};

const getActualModel = (prefixedName) => {
  return MODEL_MAP[prefixedName] || 'gemini-3-flash-preview';
};

// --- Resume Analysis with Function Calling ---
exports.analyzeResume = async (req, res) => {
  const { base64, mimeType, language } = req.body;

  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Missing base64 or mimeType' });
  }

  try {
    const actualModel = getActualModel('mockmate-coordinator');
    
    let languageInstruction = '';
    if (language && language !== 'English') {
      languageInstruction = `\n\nIMPORTANT: Provide the analysis text fields (greeting, strengthsSummary, suggestion) in ${language}.`;
    }

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: `Analyze this resume and extract structured information about the candidate. Identify their core strengths, suggest 2-3 interview roles they would be well-suited for, and provide a brief professional assessment.${languageInstruction}` }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            candidateName: { 
              type: Type.STRING, 
              description: "Full name of the candidate" 
            },
            currentRole: { 
              type: Type.STRING, 
              description: "Current or most recent job title" 
            },
            experienceLevel: { 
              type: Type.STRING, 
              enum: ["fresher", "junior", "mid-level", "senior", "lead", "manager", "executive"],
              description: "Experience level based on years and role progression" 
            },
            yearsOfExperience: { 
              type: Type.NUMBER, 
              description: "Estimated total years of professional experience" 
            },
            coreStrengths: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Top 3-5 core technical or professional strengths" 
            },
            keyTechnologies: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Primary technologies, tools, or skills the candidate is proficient in" 
            },
            suggestedRoles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING, description: "Suggested interview role title" },
                  focusArea: { type: Type.STRING, description: "Key focus areas for this role" },
                  reason: { type: Type.STRING, description: "Brief reason why this role fits the candidate" }
                },
                required: ["role", "focusArea", "reason"]
              },
              description: "2-3 suggested interview roles based on the resume"
            },
            greeting: {
              type: Type.STRING,
              description: "A brief personalized greeting addressing the candidate by name (1 sentence)"
            },
            strengthsSummary: {
              type: Type.STRING,
              description: "A concise summary of the candidate's core strengths (1-2 sentences)"
            },
            suggestion: {
              type: Type.STRING,
              description: "A brief suggestion asking them to choose a role for practice (1 sentence)"
            },
            roleType: {
              type: Type.STRING,
              enum: ["tech", "non-tech", "hybrid"],
              description: "Whether the candidate is primarily technical, non-technical, or hybrid"
            }
          },
          required: ["candidateName", "currentRole", "experienceLevel", "coreStrengths", "keyTechnologies", "suggestedRoles", "greeting", "strengthsSummary", "suggestion", "roleType"]
        },
        temperature: 0.3,
        maxOutputTokens: 2048
      }
    });

    if (response.text) {
      const analysisData = JSON.parse(response.text);
      res.json(analysisData);
    } else {
      throw new Error("No analysis generated");
    }
  } catch (error) {
    console.error("Resume Analysis Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// --- Chat Stream Proxy ---
exports.chatStream = async (req, res) => {
  const { history, message, interviewId, systemInstruction, modelName, maxOutputTokens, language } = req.body;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    const actualModel = getActualModel(modelName);
    
    // Inject Language Instruction
    let finalSystemInstruction = systemInstruction || '';
    if (language && language !== 'English') {
      finalSystemInstruction += `\n\nIMPORTANT: You must conduct this entire interview/conversation in ${language}. Ensure all your responses are in ${language}.`;
    }

    let contents = [];
    let interviewDoc = null;

    // DATA PERSISTENCE: If interviewId is provided, use DB history
    if (interviewId) {
      interviewDoc = await Interview.findById(interviewId);
      if (interviewDoc) {
        // Use history from DB
        // We need to convert Mongoose array to plain object for Gemini SDK if necessary, 
        // but typically the structure matches.
        contents = interviewDoc.history.map(h => ({
          role: h.role,
          parts: h.parts.map(p => {
            const part = {};
            if (p.text) {
              part.text = p.text;
            } else if (p.inlineData) {
              part.inlineData = p.inlineData;
            }
            return part;
          })
        }));

        // Handle User Input format
        let userParts = [];
        if (typeof message === 'string') {
          userParts = [{ text: message }];
        } else if (message.parts) {
          userParts = message.parts;
        }

        // Save User Message to DB
        interviewDoc.history.push({ role: 'user', parts: userParts });
        await interviewDoc.save();

        // Add to current context
        contents.push({ role: 'user', parts: userParts });
      }
    } else {
      // Ephemeral mode (Coordinator)
      contents = [...(history || [])];
      if (typeof message === 'string') {
          contents.push({ role: 'user', parts: [{ text: message }] });
      } else if (message.parts) {
          contents.push({ role: 'user', parts: message.parts });
      }
    }

    const result = await ai.models.generateContentStream({
      model: actualModel,
      contents: contents,
      config: {
        systemInstruction: finalSystemInstruction,
        maxOutputTokens: maxOutputTokens || 1024,
        temperature: 0.7
      }
    });

    let fullResponse = "";

    for await (const chunk of result) {
      if (chunk.text) {
        res.write(chunk.text);
        fullResponse += chunk.text;
      }
    }

    // DATA PERSISTENCE: Save Model Response to DB
    if (interviewDoc && fullResponse) {
      // Re-fetch to minimize race conditions, though strictly we are linear here
      const freshDoc = await Interview.findById(interviewId);
      if (freshDoc) {
        freshDoc.history.push({ role: 'model', parts: [{ text: fullResponse }] });
        await freshDoc.save();
      }
    }

    res.end();

  } catch (error) {
    console.error("AI Stream Error:", error);
    const errorMsg = error.message || 'Unknown error occurred';
    
    if (errorMsg.includes('Could not load the default credentials') || errorMsg.includes('GOOGLE_API_KEY')) {
      console.error('Auth Error: GOOGLE_API_KEY is not set or invalid');
      if (!res.headersSent) {
        res.status(500).json({ error: 'API authentication failed. Ensure GOOGLE_API_KEY is set in server environment.' });
      }
    } else if (!res.headersSent) {
        res.status(500).json({ error: errorMsg });
    } else {
        res.end();
    }
  }
};

// --- Feedback Gen ---
exports.generateFeedback = async (req, res) => {
  const { prompt, language } = req.body;
  
  try {
    const actualModel = getActualModel('mockmate-interviewer');
    
    let adjustedPrompt = prompt;
    if (language && language !== 'English') {
      adjustedPrompt += `\n\nPlease generate the analysis and feedback strictly in ${language}.`;
    }

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: adjustedPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            communicationScore: { type: Type.NUMBER },
            technicalScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestion: { type: Type.STRING },
          },
          required: ["overallScore", "communicationScore", "technicalScore", "strengths", "weaknesses", "suggestion"]
        }
      }
    });

    if (response.text) {
        res.json(JSON.parse(response.text));
    } else {
        throw new Error("No feedback generated");
    }
  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// --- TTS ---
exports.generateSpeech = async (req, res) => {
  const { text } = req.body;
  try {
    const actualModel = getActualModel('mockmate-tts');
    const response = await ai.models.generateContent({
      model: actualModel,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // Available voices: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: 'Kore' }, 
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        res.json({ audio: base64Audio });
    } else {
        res.status(400).json({ error: "No audio generated" });
    }
  } catch (error) {
    console.error("TTS Error:", error);
    res.status(500).json({ error: error.message });
  }
};