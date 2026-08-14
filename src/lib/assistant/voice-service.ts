/**
 * Ornexa Voice Service
 * Audio streaming STT (Speech-to-Text), Automatic End-of-Speech (VAD), TTS (Text-to-Speech),
 * and Instant Speech Interruption support.
 */

export interface VoiceServiceCallbacks {
  onTranscriptChange?: (text: string, isFinal: boolean) => void;
  onListeningStateChange?: (isListening: boolean) => void;
  onSpeakingStateChange?: (isSpeaking: boolean) => void;
  onError?: (error: string) => void;
}

export class VoiceService {
  private recognition: any = null;
  private isListening = false;
  private isSpeaking = false;
  private speakerEnabled = true;
  private callbacks: VoiceServiceCallbacks = {};
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor(callbacks: VoiceServiceCallbacks = {}) {
    this.callbacks = callbacks;
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-IN";

      this.recognition.onstart = () => {
        // Instant interruption: if assistant is speaking when user starts mic, cancel TTS immediately
        this.stopSpeaking();
        this.isListening = true;
        this.callbacks.onListeningStateChange?.(true);
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        this.callbacks.onTranscriptChange?.(text, Boolean(finalTranscript));
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        this.callbacks.onListeningStateChange?.(false);
        if (event.error !== "no-speech" && event.error !== "aborted") {
          this.callbacks.onError?.(`Speech recognition error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.callbacks.onListeningStateChange?.(false);
      };
    } catch {
      // Speech recognition not supported in this environment
    }
  }

  public isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  public startListening() {
    this.stopSpeaking(); // Instant interruption
    if (!this.recognition) {
      this.initRecognition();
    }
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (err) {
        console.warn("Could not start speech recognition", err);
      }
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
      this.isListening = false;
      this.callbacks.onListeningStateChange?.(false);
    }
  }

  public toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  public setSpeakerEnabled(enabled: boolean) {
    this.speakerEnabled = enabled;
    if (!enabled) {
      this.stopSpeaking();
    }
  }

  public getSpeakerEnabled(): boolean {
    return this.speakerEnabled;
  }

  public stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.callbacks.onSpeakingStateChange?.(false);
    }
  }

  public speak(text: string) {
    if (!this.speakerEnabled || typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    // Cancel any active speech
    this.stopSpeaking();

    // Clean text for speech output (strip code/markdown/urls)
    const cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_`]/g, "")
      .replace(/Rs\.\s*/g, "Rupees ")
      .slice(0, 300); // Keep voice answer concise

    if (!cleanText.trim()) return;

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = "en-IN";

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.callbacks.onSpeakingStateChange?.(true);
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.callbacks.onSpeakingStateChange?.(false);
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.callbacks.onSpeakingStateChange?.(false);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch {
      this.isSpeaking = false;
      this.callbacks.onSpeakingStateChange?.(false);
    }
  }
}
