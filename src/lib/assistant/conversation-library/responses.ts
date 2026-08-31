/**
 * Assistant Conversation Repository
 * Provides structured, natural, context-aware responses for standard mode.
 */

const GREETINGS = [
  "Hi! What would you like to work on?",
  "Hello! What can I help you with today?",
  "Hi there. Need help with stock, manufacturing, accounts, or something else?",
  "Good morning. What are we working on today?",
  "Hello. Ready when you are.",
];

const ACKNOWLEDGEMENTS = ["Got it.", "Understood.", "Okay.", "Done.", "You're welcome."];

const CASUAL_HOW_ARE_YOU = [
  "Doing well. Ready when you are. What do you want to check?",
  "All good here. What can I help you with?",
  "I'm operating perfectly. How can I assist you with Ornexa today?",
];

const CAPABILITY_EXPLANATION = [
  "I'm the Ornexa Assistant. I can help you find information, understand your business data, navigate the ERP and carry out permitted tasks.",
  "I'm here to help you operate Ornexa faster. I can answer questions about the system, pull up gold balances, check stock, or draft transactions for you.",
];

export function getGreeting(userName?: string): string {
  const base = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  return userName ? `Hi ${userName}! ${base.split("! ")[1] || base}` : base;
}

export function getAcknowledgement(): string {
  return ACKNOWLEDGEMENTS[Math.floor(Math.random() * ACKNOWLEDGEMENTS.length)];
}

export function getHowAreYouResponse(): string {
  return CASUAL_HOW_ARE_YOU[Math.floor(Math.random() * CASUAL_HOW_ARE_YOU.length)];
}

export function getCapabilityExplanation(): string {
  return CAPABILITY_EXPLANATION[Math.floor(Math.random() * CAPABILITY_EXPLANATION.length)];
}

export function getFallbackClarification(): string {
  return "I don't have enough information to answer that confidently. You can try rephrasing, ask me about a specific workflow (e.g. 'what is fine gold?'), search for a party by name, or say 'create a support ticket' for help.";
}

export function getExplainSimplyPrompt(): string {
  return "Of course — tell me which topic you'd like explained simply. For example: fine gold, touch, wastage, hallmarking, gold issue/receive, or how to create an invoice in Ornexa.";
}

export function getInsufficientKnowledgeResponse(): string {
  return "I don't have enough information to answer that confidently. I can search Ornexa Help, look up a specific party or record, or help you create a support ticket. What would you like to do?";
}
