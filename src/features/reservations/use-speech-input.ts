"use client";

import { useRef, useState } from "react";

type SpeechInputStatus = "idle" | "listening" | "unsupported" | "error";

type SpeechRecognitionResultEventLike = {
  readonly results: {
    readonly length: number;
    readonly [index: number]: {
      readonly 0: { readonly transcript: string };
      readonly isFinal: boolean;
    };
  };
};

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  start(): void;
  stop(): void;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

type UseSpeechInput = {
  readonly start: () => void;
  readonly status: SpeechInputStatus;
  readonly stop: () => void;
};

export function useSpeechInput(onTranscript: (text: string) => void): UseSpeechInput {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [status, setStatus] = useState<SpeechInputStatus>("idle");

  const start = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (Recognition === undefined) {
      setStatus("unsupported");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "ko-KR";
    recognition.onresult = (event) => {
      const transcripts: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal === true) {
          transcripts.push(result[0].transcript);
        }
      }
      const text = transcripts.join(" ").trim();
      if (text.length > 0) {
        onTranscript(text);
      }
    };
    recognition.onerror = () => setStatus("error");
    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus((current) => (current === "error" ? current : "idle"));
    };
    recognitionRef.current = recognition;
    recognition.start();
    setStatus("listening");
  };

  const stop = () => recognitionRef.current?.stop();

  return { start, status, stop };
}
