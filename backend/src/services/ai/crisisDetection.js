class CrisisDetectionService {
    constructor() {
      this.crisisKeywords = [
        'suicide', 'kill myself', 'end it all', 'not worth living',
        'hurt myself', 'self harm', 'cutting', 'overdose',
        'nobody cares', 'better off dead', 'cant go on'
      ];
      
      this.urgentKeywords = [
        'tonight', 'today', 'right now', 'about to', 'going to'
      ];
    }
  
    assessCrisisRisk(message) {
      const text = message.toLowerCase();
      let riskScore = 0;
      let triggeredKeywords = [];
      
      // Check for crisis keywords
      this.crisisKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          riskScore += 3;
          triggeredKeywords.push(keyword);
        }
      });
      
      // Check for urgency
      this.urgentKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          riskScore += 2;
        }
      });
      
      // Classify risk level
      let riskLevel = 'low';
      if (riskScore >= 5) riskLevel = 'high';
      else if (riskScore >= 3) riskLevel = 'medium';
      
      return {
        riskLevel,
        riskScore,
        triggeredKeywords,
        requiresIntervention: riskLevel === 'high',
        timestamp: new Date()
      };
    }
  
    generateCrisisResponse(riskLevel) {
      const responses = {
        high: "I'm really concerned about you right now. Please know that you matter and there are people who want to help. Can you reach out to someone you trust, or would you like me to connect you with a crisis helpline?",
        medium: "It sounds like you're going through a really difficult time. You don't have to face this alone. Have you been able to talk to anyone about how you're feeling?",
        low: "I hear that you're struggling. Your feelings are valid, and I'm here to listen. What's been the hardest part of your day?"
      };
      
      return responses[riskLevel] || responses.low;
    }
  }
  
  module.exports = new CrisisDetectionService();