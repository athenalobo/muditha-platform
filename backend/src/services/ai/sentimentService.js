const natural = require('natural');
const sentiment = require('sentiment');
const Sentiment = new sentiment();

class SentimentService {
  analyzeSentiment(text) {
    const result = Sentiment.analyze(text);
    
    return {
      score: result.score,
      comparative: result.comparative,
      classification: this.classifyMood(result.score),
      positive: result.positive,
      negative: result.negative,
      timestamp: new Date()
    };
  }

  classifyMood(score) {
    if (score >= 3) return 'very_positive';
    if (score >= 1) return 'positive';
    if (score >= -1) return 'neutral';
    if (score >= -3) return 'negative';
    return 'very_negative';
  }

  detectKeywords(text) {
    const anxietyWords = ['anxious', 'worried', 'panic', 'nervous', 'scared', 'afraid'];
    const depressionWords = ['sad', 'hopeless', 'empty', 'worthless', 'depressed'];
    const positiveWords = ['happy', 'grateful', 'excited', 'hopeful', 'better'];
    
    const words = text.toLowerCase().split(/\s+/);
    
    return {
      anxiety: anxietyWords.filter(word => words.includes(word)),
      depression: depressionWords.filter(word => words.includes(word)),
      positive: positiveWords.filter(word => words.includes(word))
    };
  }
}

module.exports = new SentimentService();