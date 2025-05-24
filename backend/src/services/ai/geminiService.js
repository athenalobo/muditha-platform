const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Updated model name - gemini-pro is deprecated
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Mental health conversation context
    this.systemPrompt = `You are Muditha, an AI companion for mental health support.
You are empathetic, non-judgmental, and supportive.
Your responses should be:
- Warm and understanding
- 2-3 sentences max unless user needs detailed guidance
- Focus on active listening and validation
- Suggest healthy coping strategies when appropriate
- NEVER provide medical diagnoses or replace professional therapy
- If crisis detected, gently encourage professional help

Remember: You're here to support, not diagnose or treat.`;
  }

  async generateResponse(userMessage, conversationHistory = []) {
    try {
      // Build conversation context
      let prompt = this.systemPrompt + '\n\n';
      
      // Add recent conversation history (last 5 messages)
      const recentHistory = conversationHistory.slice(-5);
      recentHistory.forEach(msg => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      
      prompt += `User: ${userMessage}\nMuditha:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        message: response.text(),
        timestamp: new Date(),
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      return {
        message: "I'm here to listen. Sometimes I need a moment to process - could you tell me more about how you're feeling?",
        timestamp: new Date(),
        model: 'fallback'
      };
    }
  }

  async analyzeEmotionalState(message) {
    try {
      const prompt = `Analyze the emotional state of this message and return ONLY a JSON object:
"${message}"

Return format: {"emotion": "primary emotion", "intensity": 1-10, "concernLevel": "low/medium/high"}
Emotions: happy, sad, anxious, angry, frustrated, hopeful, confused, lonely, excited, overwhelmed`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return JSON.parse(response.text());
    } catch (error) {
      console.error('Emotion analysis error:', error);
      return { emotion: 'neutral', intensity: 5, concernLevel: 'low' };
    }
  }
}

module.exports = new GeminiService();