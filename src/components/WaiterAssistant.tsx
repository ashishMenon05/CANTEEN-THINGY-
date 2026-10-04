"use client";

import React, { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, ChefHat, Mic, MicOff, ShoppingBag, Sparkles, Volume2, X } from "lucide-react";
import type { FoodItem } from "./StudentView";
import styles from "./WaiterAssistant.module.css";

const FOOD_IMAGE_BLUR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 5'%3E%3Crect width='8' height='5' fill='%231a1814'/%3E%3C/svg%3E";

interface WaiterAssistantProps {
  items: FoodItem[];
  isLoading: boolean;
  onAddToCart: (item: FoodItem) => boolean;
  onRefresh: () => void;
  onDismiss: () => void;
  onManualBrowse: () => void;
}

type MenuChoiceId = "meals" | "snacks" | "drinks" | "breakfast" | "all";

const menuChoices: Array<{ id: MenuChoiceId; label: string; prompt: string }> = [
  { id: "meals", label: "Something filling", prompt: "A proper meal, please." },
  { id: "snacks", label: "A quick bite", prompt: "Something small to snack on." },
  { id: "drinks", label: "Something to sip", prompt: "I’m looking for a drink." },
  { id: "breakfast", label: "Breakfast", prompt: "Show me breakfast." },
  { id: "all", label: "Show me everything", prompt: "Tell me the whole menu." },
];

interface RecognitionResult {
  readonly 0: { transcript: string };
}

interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  error: string;
}

interface RecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface RecognitionConstructor {
  new (): RecognitionInstance;
}

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

const greeting = "Hi, welcome to Q-Pass. Are you after something filling, a quick bite, breakfast, or a drink?";

function categoryIntroduction(choice: MenuChoiceId) {
  switch (choice) {
    case "meals": return "Sure, let’s find you something filling.";
    case "snacks": return "Of course. Here are a few quick bites.";
    case "drinks": return "Absolutely. Here’s what we have to drink.";
    case "breakfast": return "Breakfast, coming right up.";
    default: return "Sure, let me walk you through the menu.";
  }
}

const normalise = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

function identifyMenuChoice(query: string): MenuChoiceId | null {
  if (/\b(everything|all dishes|whole menu|entire menu)\b/.test(query)) return "all";
  if (/\b(breakfast|morning)\b/.test(query)) return "breakfast";
  if (/\b(drink|drinks|beverage|beverages|sip|thirsty|coffee|chai|tea)\b/.test(query)) return "drinks";
  if (/\b(snack|snacks|quick bite|bite|light)\b/.test(query)) return "snacks";
  if (/\b(meal|meals|lunch|dinner|hearty|hard food|solid food|filling|hungry|main course|proper food)\b/.test(query)) return "meals";
  return null;
}

function itemsForChoice(choice: MenuChoiceId, items: FoodItem[]) {
  if (choice === "all") return items;
  const category = choice === "meals" ? "lunch" : choice === "drinks" ? "beverage" : choice;
  return items.filter((item) => item.category.toLocaleLowerCase().includes(category));
}

function findDish(query: string, items: FoodItem[]) {
  const cleanedQuery = normalise(query);
  const ignoredWords = new Set(["i", "would", "like", "want", "to", "order", "get", "have", "please", "can", "you", "me", "a", "an", "the", "some", "add", "give", "show", "tell", "about"]);
  const queryWords = cleanedQuery.split(" ").filter((word) => word.length > 2 && !ignoredWords.has(word));

  return items
    .map((item) => {
      const name = normalise(item.name);
      const nameWords = name.split(" ");
      const exactMatch = cleanedQuery.includes(name);
      const score = exactMatch
        ? nameWords.length + 2
        : queryWords.filter((word) => nameWords.some((nameWord) => nameWord.includes(word) || word.includes(nameWord))).length;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item;
}

export function WaiterAssistant({ items, isLoading, onAddToCart, onRefresh, onDismiss, onManualBrowse }: WaiterAssistantProps) {
  const [featuredItem, setFeaturedItem] = useState<FoodItem | null>(null);
  const [message, setMessage] = useState(greeting);
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTouring, setIsTouring] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<MenuChoiceId | null>(null);
  const [tourIndex, setTourIndex] = useState(-1);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const speechTokenRef = useRef(0);
  const cancelledRef = useRef(false);
  const tourIdRef = useRef(0);
  const respondToRequestRef = useRef<(request: string) => Promise<void>>(async () => {});
  const tourItems = selectedChoice ? itemsForChoice(selectedChoice, items) : [];

  const dismiss = useCallback(() => {
    cancelledRef.current = true;
    tourIdRef.current += 1;
    speechTokenRef.current += 1;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.classList.add("waiter-open");
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("waiter-open");
      recognitionRef.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [dismiss]);

  const speak = useCallback((text: string) => new Promise<void>((resolve) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      resolve();
      return;
    }

    const token = ++speechTokenRef.current;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.94;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLocaleLowerCase() === "en-in")
      || voices.find((voice) => voice.lang.toLocaleLowerCase().startsWith("en-"))
      || null;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      if (token === speechTokenRef.current) setIsSpeaking(false);
      resolve();
    };
    utterance.onerror = () => {
      if (token === speechTokenRef.current) setIsSpeaking(false);
      resolve();
    };
    window.speechSynthesis.speak(utterance);
  }), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void speak(greeting);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [speak]);

  const startListening = useCallback(() => {
    const recognitionConstructor = (window as SpeechWindow).SpeechRecognition
      || (window as SpeechWindow).webkitSpeechRecognition;
    if (!recognitionConstructor) {
      setVoiceError("Voice input is not available in this browser. You can type a question below or browse the menu.");
      return;
    }

    setVoiceError("");
    cancelledRef.current = false;
    speechTokenRef.current += 1;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setIsListening(true);
    setMessage("I’m listening. Tell me what you’re in the mood for.");

    const recognition = new recognitionConstructor();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
      if (transcript) void respondToRequestRef.current(transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setVoiceError(event.error === "not-allowed"
        ? "Microphone permission is off. Allow microphone access or type your request instead."
        : "I couldn’t catch that. Please try again, or type your request.");
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError("The microphone could not start. Please try again or type your request.");
    }
  }, []);

  const showMenu = useCallback(async (choice: MenuChoiceId) => {
    const tourId = ++tourIdRef.current;
    cancelledRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setIsTouring(false);
    window.speechSynthesis?.cancel();

    const selection = itemsForChoice(choice, items);
    if (selection.length === 0) {
      const label = menuChoices.find((option) => option.id === choice)?.label.toLocaleLowerCase() || "that selection";
      const reply = items.length
        ? `We don’t have anything in ${label} right now. Try another section of the menu.`
        : "I’m just getting today’s menu ready. Please try again in a moment.";
      setMessage(reply);
      setVoiceError(items.length ? "" : "The menu is still loading.");
      await speak(reply);
      return;
    }

    cancelledRef.current = false;
    setSelectedChoice(choice);
    setVoiceError("");
    setIsTouring(true);
    setTourIndex(0);
    const chosenLabel = menuChoices.find((option) => option.id === choice)?.label.toLocaleLowerCase() || "today’s menu";
    const introduction = categoryIntroduction(choice);
    setMessage(introduction);
    await speak(introduction);

    for (let index = 0; index < selection.length; index += 1) {
      if (cancelledRef.current || tourId !== tourIdRef.current) break;
      const item = selection[index];
      setTourIndex(index);
      setFeaturedItem(item);
      const price = `₹${item.price.toFixed(0)}`;
      setMessage(`${item.name} · ${price}`);
      await Promise.all([
        speak(`${index === 0 ? "First up" : "And next"}, ${item.name}, for ${item.price} rupees.`),
        new Promise((resolve) => window.setTimeout(resolve, 2200)),
      ]);
      if (cancelledRef.current || tourId !== tourIdRef.current) break;
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }

    if (!cancelledRef.current && tourId === tourIdRef.current) {
      setIsTouring(false);
      setMessage("That’s everything. Anything catch your eye?");
      await speak("That’s everything. Anything catch your eye?");
    }
  }, [items, speak]);

  const respondToRequest = useCallback(async (request: string) => {
    const query = normalise(request);
    setDraft("");
    setVoiceError("");
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setFeaturedItem(null);
    cancelledRef.current = true;
    tourIdRef.current += 1;
    setIsTouring(false);
    setTourIndex(-1);

    const requestedChoice = identifyMenuChoice(query);
    if (requestedChoice) {
      await showMenu(requestedChoice);
      return;
    }

    if (/\b(menu|available|choices|options|recommend|what do you have|what have you got)\b/.test(query)) {
      setSelectedChoice(null);
      const reply = "Of course. Are you after something filling, a quick bite, breakfast, or something to sip?";
      setMessage(reply);
      await speak(reply);
      return;
    }

    const matchedDish = findDish(query, items);
    if (!matchedDish) {
      const reply = items.length
        ? "Sorry, I didn’t catch the name. Try saying a dish, or browse the menu."
        : "The kitchen is getting today’s menu ready. You can browse manually while it loads.";
      setMessage(reply);
      await speak(reply);
      return;
    }

    setSelectedChoice(null);
    setFeaturedItem(matchedDish);
    const isOrderRequest = /\b(order|add|get|want|like|take|buy)\b|\b(?:can i|i would like to|i will|i.ll)\s+have\b/.test(query);
    if (isOrderRequest) {
      if (matchedDish.inventory.availableOnline <= 0 || matchedDish.inventory.isOnlineClosed) {
        const reply = `${matchedDish.name} isn’t available for online ordering right now. Would you like to hear the menu?`;
        setMessage(reply);
        await speak(reply);
        return;
      }
      const added = onAddToCart(matchedDish);
      if (!added) {
        const reply = `I couldn’t add ${matchedDish.name} just now. Please check the stock message and choose another dish if you like.`;
        setMessage(reply);
        await speak(reply);
        return;
      }
      const reply = `Lovely choice. I’ve added one ${matchedDish.name} to your tray.`;
      setMessage(reply);
      await speak(reply);
      return;
    }

    const reply = `The ${matchedDish.name} is ${matchedDish.price} rupees. Would you like me to add one?`;
    setMessage(reply);
    await speak(reply);
  }, [items, onAddToCart, showMenu, speak]);
  respondToRequestRef.current = respondToRequest;

  const handleTextSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.trim()) void respondToRequest(draft);
  };

  const stopTour = () => {
    cancelledRef.current = true;
    tourIdRef.current += 1;
    setIsTouring(false);
    setIsSpeaking(false);
    speechTokenRef.current += 1;
    window.speechSynthesis?.cancel();
    setMessage("No rush. Ask me about a dish or tell me what you’d like to order.");
  };

  const chooseCategory = (choice: MenuChoiceId) => {
    void showMenu(choice);
  };

  return (
    <div
      className={styles["waiter-backdrop"]}
      style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <section className={styles["waiter-dialog"]} role="dialog" aria-modal="true" aria-labelledby="waiter-title">
        <button className={styles["waiter-close"]} onClick={dismiss} aria-label="Close waiter assistant"><X size={18} /></button>
        <div className={styles["waiter-visual"]}>
          {featuredItem?.imageUrl ? (
            <Image
              key={featuredItem.id}
              fill
              sizes="(max-width: 640px) 100vw, 500px"
              unoptimized
              placeholder="blur"
              blurDataURL={FOOD_IMAGE_BLUR}
              onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
              className={styles["waiter-photo"]}
              src={featuredItem.imageUrl}
              alt={featuredItem.name}
            />
          ) : (
            <Image
              key="welcome-photo"
              fill
              sizes="(max-width: 640px) 100vw, 500px"
              unoptimized
              placeholder="blur"
              blurDataURL={FOOD_IMAGE_BLUR}
              onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
              className={styles["waiter-photo"]}
              src={items[0]?.imageUrl || "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=85"}
              alt="A freshly prepared dish from our kitchen"
            />
          )}
          {isLoading && <div className={`${styles["waiter-visual-loading"]} skeleton`} aria-hidden="true" />}
          <div className={styles["waiter-photo-shade"]} />
          <span className={styles["waiter-photo-label"]}><ChefHat size={14} /> A seat at our table</span>
          {featuredItem && (
            <div className={styles["waiter-dish-caption"]} key={featuredItem.id}>
              <span className="eyebrow">{featuredItem.category} · {featuredItem.isVeg ? "VEGETARIAN" : "KITCHEN FAVOURITE"}</span>
              <h2>{featuredItem.name}</h2>
              <p>₹{featuredItem.price.toFixed(0)}</p>
            </div>
          )}
          {isTouring && tourItems.length > 0 && (
            <div className={styles["waiter-tour-progress"]} aria-label={`Dish ${tourIndex + 1} of ${tourItems.length}`}>
              <span>{String(tourIndex + 1).padStart(2, "0")}</span>
              <div><i style={{ width: `${((tourIndex + 1) / tourItems.length) * 100}%` }} /></div>
              <span>{String(tourItems.length).padStart(2, "0")}</span>
            </div>
          )}
        </div>

        <div className={styles["waiter-conversation"]}>
          <div className={styles["waiter-kicker"]}><Sparkles size={14} /> YOUR TABLE, YOUR WAY</div>
          <h1 id="waiter-title">A little help<br /><em>choosing?</em></h1>
          <p className={styles["waiter-greeting"]}>“{message}”</p>
          <div className={styles["waiter-status"]} aria-live="polite">
            {isListening ? <>
              <span className={styles["waiter-waveform"]} aria-hidden="true">
                {[0, 1, 2, 3, 4].map((bar) => (
                  <i key={bar} style={{ animationDelay: `${bar * 90}ms` }} />
                ))}
              </span>
              I&apos;m listening
            </>
              : isSpeaking ? <><Volume2 size={14} /> Speaking</>
                : <><span className={styles["waiter-status-dot"]} /> Your waiter is here</>}
          </div>

          {voiceError && <p className={styles["waiter-error"]} role="status">{voiceError}</p>}

          {isLoading ? (
            <div className={styles["waiter-inventory-loading"]} role="status" aria-label="Loading today's menu">
              <span /><span /><p>Bringing today&apos;s menu to the table…</p>
            </div>
          ) : items.length === 0 ? (
            <div className={styles["waiter-inventory-empty"]} role="status">
              <p>Today&apos;s menu isn&apos;t available just now.</p>
              <button type="button" onClick={onRefresh}>Try again</button>
            </div>
          ) : (
            <div className={styles["waiter-choice-group"]} aria-label="Choose what you are in the mood for">
              <span className={styles["waiter-choice-prompt"]}>What are you in the mood for?</span>
              <div className={styles["waiter-choices"]}>
                {menuChoices.map((choice) => (
                  <button
                    key={choice.id}
                    className={`${styles["waiter-choice"]} ${selectedChoice === choice.id ? styles["is-selected"] : ""}`}
                    onClick={() => chooseCategory(choice.id)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {featuredItem && !isTouring && featuredItem.inventory.availableOnline > 0 && !featuredItem.inventory.isOnlineClosed && (
            <button className={styles["waiter-add"]} onClick={() => onAddToCart(featuredItem)}>
              <ShoppingBag size={16} /> Add {featuredItem.name} · ₹{featuredItem.price.toFixed(0)}
            </button>
          )}

          <div className={styles["waiter-actions"]}>
            {isTouring ? (
              <button className={`${styles["waiter-mic"]} ${styles["waiter-stop"]}`} onClick={stopTour}>
                <MicOff size={17} /> Stop the menu tour
              </button>
            ) : (
              <button className={styles["waiter-mic"]} onClick={startListening} disabled={isListening}>
                <Mic size={17} /> Talk to the waiter <span>↗</span>
              </button>
            )}
            <button className={styles["waiter-menu-tour"]} onClick={() => chooseCategory(selectedChoice || "all")} disabled={items.length === 0 || isTouring || isLoading}>
              <Volume2 size={16} /> {isTouring ? "Playing the menu…" : "Hear this selection"}
            </button>
          </div>

          <form className={styles["waiter-text-form"]} onSubmit={handleTextSubmit}>
            <label htmlFor="waiter-request">Or type a question</label>
            <div>
              <input
                id="waiter-request"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Try “what’s on the menu?”"
              />
              <button type="submit" disabled={!draft.trim()} aria-label="Send question"><ArrowRight size={17} /></button>
            </div>
          </form>

          <button className={styles["waiter-manual"]} onClick={() => {
            dismiss();
            onManualBrowse();
          }}>
            <Check size={15} /> I&apos;ll browse and order myself
          </button>
                  <p className={styles["waiter-privacy"]}>Microphone access starts only when you tap to talk. Voice processing follows your browser&apos;s speech service.</p>
        </div>
      </section>
    </div>
  );
}
