import { getActiveDraft } from "./conversational-action-engine";

export interface ContextPackage {
  runtime: {
    date: string;
    time: string;
    dayOfWeek: string;
    timezone: string;
  };
  user: {
    displayName: string;
    preferredName: string;
    role: string;
  };
  tenant: {
    brandName: string;
    businessMode: string;
  };
  route: {
    currentPath: string;
    activeEntity?: string;
  };
  memory: {
    lastMentionedParty?: string;
    lastMentionedJob?: string;
    lastMentionedOrder?: string;
    lastMentionedDocument?: string;
  };
  support: {
    isEnabled: boolean;
    ticketRoute: string;
    supportHours: string;
    channels: string[];
  };
}

const sessionMemory: ContextPackage["memory"] = {};
let sessionPreferredName: string | null = null;
let currentRoute: string = "/";

export function setRouteContext(path: string) {
  currentRoute = path;
}

export function updatePreferredName(name: string) {
  sessionPreferredName = name;
}

export function updateEntityMemory(type: keyof ContextPackage["memory"], value: string) {
  sessionMemory[type] = value;
}

export function getContextBudget(userProfile?: {
  name?: string;
  role?: string;
  firmName?: string;
}): ContextPackage {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-IN", {
    timeStyle: "short",
  });
  const dayFormatter = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
  });

  return {
    runtime: {
      date: dateFormatter.format(now),
      time: timeFormatter.format(now),
      dayOfWeek: dayFormatter.format(now),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    user: {
      displayName: userProfile?.name || "User",
      preferredName: sessionPreferredName || userProfile?.name?.split(" ")[0] || "User",
      role: userProfile?.role || "Owner",
    },
    tenant: {
      brandName: userProfile?.firmName || "Ornexa",
      businessMode: "Retail",
    },
    route: {
      currentPath: currentRoute,
    },
    memory: sessionMemory,
    support: {
      isEnabled: true,
      ticketRoute: "/settings/support",
      supportHours: "Mon-Sat 10:00 AM to 7:00 PM IST",
      channels: ["support@ornexa.com", "WhatsApp: +91 98200 12345"],
    },
  };
}

export function resolvePronouns(text: string): string {
  const resolved = text;
  if (
    text.match(/\b(him|he|his|her|she|them|they|customer|party)\b/i) &&
    sessionMemory.lastMentionedParty
  ) {
    // Basic substitution for demonstration
    // A robust system would pass the context explicitly to the downstream service
  }
  return resolved;
}

// Pre-defined local intelligence responses
export function answerGeneralQuestion(query: string, context: ContextPackage): string | null {
  const q = query.toLowerCase();

  if (
    q.includes("what is the date") ||
    q.includes("today's date") ||
    q.includes("what date is it")
  ) {
    return `Today is ${context.runtime.date}, ${context.runtime.dayOfWeek}.`;
  }
  if (q.includes("what day is today") || q.includes("what day is it")) {
    return `Today is ${context.runtime.dayOfWeek}.`;
  }
  if (q.includes("what time is it") || q.includes("current time")) {
    return `It is currently ${context.runtime.time} (${context.runtime.timezone}).`;
  }

  if (q.includes("what is my name") || q.includes("who am i")) {
    return `Your name is ${context.user.displayName}, but I can call you ${context.user.preferredName}.`;
  }

  // Handle setting name
  if (q.startsWith("my name is ") || q.startsWith("call me ")) {
    const newName = q.replace("my name is ", "").replace("call me ", "").trim();
    // Capitalize first letter
    const formattedName = newName.charAt(0).toUpperCase() + newName.slice(1);
    updatePreferredName(formattedName);
    return `Got it! I will call you ${formattedName} for this session.`;
  }

  if (q.includes("where am i") || q.includes("current screen")) {
    return `You are currently on the ${context.route.currentPath} screen.`;
  }

  // Handle help/support questions
  if (
    q === "help" ||
    q === "i need help" ||
    q.includes("contact support") ||
    q.includes("call support")
  ) {
    const { support } = context;
    if (!support.isEnabled) {
      return "Direct support is currently disabled for this tenant. Please contact your system administrator.";
    }
    return `I can help with that. Our support team is available ${support.supportHours}.\n\nYou can reach us via:\n- ${support.channels.join("\n- ")}\n\nYou can also say "create a support ticket" and I'll draft one for you right now, or you can ask me a question and I'll check our Knowledge Base.`;
  }

  return null;
}
