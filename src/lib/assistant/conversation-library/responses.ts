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
  return "I'm not sure I understood. Could you clarify if you're looking for a report, a specific customer, or help with a workflow?";
}
