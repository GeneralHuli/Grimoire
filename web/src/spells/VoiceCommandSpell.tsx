import { useEffect, useRef, useState } from "react";

interface ChoreTaskContext {
  id: string;
  title: string;
  status: "needsAction" | "completed";
}

interface ChoreBoardContext {
  id: string;
  title: string;
  tasks: ChoreTaskContext[];
}

interface GroceryItemContext {
  id: string;
  quantity: string;
  name: string;
  checked: boolean;
}

interface RecipeContext {
  id: string;
  title: string;
}

interface CommandContext {
  choreBoards: ChoreBoardContext[];
  groceryItems: GroceryItemContext[];
  recipes: RecipeContext[];
}

type CommandAction =
  | "grocery.add"
  | "grocery.check"
  | "grocery.remove"
  | "chores.add"
  | "chores.complete"
  | "chores.reopen"
  | "calendar.create"
  | "calendar.query"
  | "mealplan.add"
  | "mealplan.remove"
  | "unknown";

interface CommandIntent {
  action: CommandAction;
  groceryName: string;
  groceryQuantity: string;
  groceryItemId: string;
  choresListId: string;
  choresTaskId: string;
  choresTitle: string;
  calendarTitle: string;
  calendarStart: string;
  calendarEnd: string;
  calendarAllDay: boolean;
  calendarQueryDate: string;
  calendarQueryRange: "day" | "week" | "month" | "";
  mealPlanDate: string;
  mealPlanRecipeId: string;
  confirmationText: string;
  clarificationNeeded: boolean;
  clarificationQuestion: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MUTE_KEY = "voice-commands-muted";

function speak(text: string) {
  if (!text) return;
  if (localStorage.getItem(MUTE_KEY) === "1") return;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function formatDateParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

async function fetchContext(): Promise<CommandContext> {
  const [choreBoards, groceryItems, recipes] = await Promise.all([
    fetch("/api/spells/chores/board")
      .then((res) => (res.ok ? res.json() : { board: [] }))
      .then((data: { board: ChoreBoardContext[] }) => data.board ?? [])
      .catch(() => [] as ChoreBoardContext[]),
    fetch("/api/spells/grocery-list/items")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items: GroceryItemContext[] }) => data.items ?? [])
      .catch(() => [] as GroceryItemContext[]),
    fetch("/api/spells/recipes/recipes")
      .then((res) => (res.ok ? res.json() : { recipes: [] }))
      .then((data: { recipes: RecipeContext[] }) => data.recipes ?? [])
      .catch(() => [] as RecipeContext[]),
  ]);
  return { choreBoards, groceryItems, recipes };
}

export function VoiceCommandSpell() {
  const [supportsSpeech] = useState(() => getSpeechRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === "1");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  }, [muted]);

  function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      if (heard) {
        setText(heard);
        submit(heard);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function executeIntent(intent: CommandIntent) {
    if (intent.clarificationNeeded || intent.action === "unknown") {
      const question = intent.clarificationQuestion || "I didn't understand that — try again?";
      setClarification(question);
      setConfirmation(null);
      speak(question);
      return;
    }

    setClarification(null);

    try {
      switch (intent.action) {
        case "grocery.add": {
          if (!intent.groceryName) throw new Error("Missing item name");
          await fetch("/api/spells/grocery-list/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: intent.groceryName, quantity: intent.groceryQuantity ?? "" }),
          });
          break;
        }
        case "grocery.check": {
          if (!intent.groceryItemId) throw new Error("Couldn't find that item on the list");
          await fetch(`/api/spells/grocery-list/items/${intent.groceryItemId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checked: true }),
          });
          break;
        }
        case "grocery.remove": {
          if (!intent.groceryItemId) throw new Error("Couldn't find that item on the list");
          await fetch(`/api/spells/grocery-list/items/${intent.groceryItemId}`, { method: "DELETE" });
          break;
        }
        case "chores.add": {
          if (!intent.choresListId || !intent.choresTitle) throw new Error("Couldn't find that chore board");
          await fetch("/api/spells/chores/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listId: intent.choresListId, title: intent.choresTitle }),
          });
          break;
        }
        case "chores.complete":
        case "chores.reopen": {
          if (!intent.choresListId || !intent.choresTaskId) throw new Error("Couldn't find that chore");
          await fetch(`/api/spells/chores/tasks/${intent.choresListId}/${intent.choresTaskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: intent.action === "chores.complete" ? "completed" : "needsAction" }),
          });
          break;
        }
        case "calendar.create": {
          if (!intent.calendarTitle || !intent.calendarStart || !intent.calendarEnd) {
            throw new Error("Missing event details");
          }
          await fetch("/api/spells/calendar/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: intent.calendarTitle,
              start: intent.calendarAllDay ? intent.calendarStart : new Date(intent.calendarStart).toISOString(),
              end: intent.calendarAllDay ? intent.calendarEnd : new Date(intent.calendarEnd).toISOString(),
              allDay: intent.calendarAllDay,
            }),
          });
          break;
        }
        case "calendar.query": {
          const range = intent.calendarQueryRange || "day";
          const date = intent.calendarQueryDate || formatDateParam(new Date());
          const res = await fetch(`/api/spells/calendar/events?range=${range}&date=${date}`);
          const data: { events: { title: string; start: string; allDay: boolean }[] } = await res.json();
          const summary =
            data.events.length === 0
              ? "Nothing on the calendar for that time."
              : data.events.map((e) => (e.allDay ? e.title : `${e.title} at ${formatTime(e.start)}`)).join("; ");
          setConfirmation(summary);
          speak(summary);
          return;
        }
        case "mealplan.add": {
          if (!intent.mealPlanDate || !intent.mealPlanRecipeId) throw new Error("Couldn't find that recipe");
          await fetch("/api/spells/meal-plan/entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: intent.mealPlanDate, recipeId: intent.mealPlanRecipeId }),
          });
          break;
        }
        case "mealplan.remove": {
          if (!intent.mealPlanDate || !intent.mealPlanRecipeId) throw new Error("Couldn't find that recipe");
          const res = await fetch(`/api/spells/meal-plan/week?date=${intent.mealPlanDate}`);
          const data: { entries: { id: string; date: string; recipeId: string }[] } = await res.json();
          const match = data.entries.find(
            (e) => e.date === intent.mealPlanDate && e.recipeId === intent.mealPlanRecipeId
          );
          if (!match) throw new Error("Couldn't find that meal on the plan");
          await fetch(`/api/spells/meal-plan/entries/${match.id}`, { method: "DELETE" });
          break;
        }
        default:
          break;
      }
      const confirmationText = intent.confirmationText || "Done.";
      setConfirmation(confirmationText);
      speak(confirmationText);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setClarification(message);
      speak(message);
    }
  }

  async function submit(spoken?: string) {
    const command = (spoken ?? text).trim();
    if (!command) return;
    setBusy(true);
    setConfirmation(null);
    setClarification(null);
    try {
      const context = await fetchContext();
      const res = await fetch("/api/spells/voice-commands/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: command, context }),
      });
      if (!res.ok) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't reach the command parser");
      }
      const intent: CommandIntent = await res.json();
      await executeIntent(intent);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setClarification(message);
      speak(message);
    } finally {
      setBusy(false);
      setText("");
    }
  }

  return (
    <div className="spell-card voice-command-card">
      <h2>Voice Commands</h2>
      <form
        className="voice-command-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {supportsSpeech && (
          <button
            type="button"
            className={`btn voice-command-mic${listening ? " listening" : ""}`}
            onClick={() => (listening ? stopListening() : startListening())}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Start listening"}
          >
            {listening ? "●" : "🎙"}
          </button>
        )}
        <input
          className="field"
          placeholder='Try "add milk to the grocery list"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Type a command"
        />
        <button type="submit" className="btn" disabled={busy || !text.trim()}>
          Send
        </button>
        <button
          type="button"
          className="btn voice-command-mute"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? "Unmute spoken responses" : "Mute spoken responses"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </form>

      <div className="voice-command-result">
        {busy && <p className="voice-command-status">Thinking…</p>}
        {!busy && confirmation && <p className="voice-command-confirmation">{confirmation}</p>}
        {!busy && clarification && <p className="voice-command-clarification">{clarification}</p>}
        {!supportsSpeech && (
          <p className="voice-command-hint">This browser doesn't support speech input — typed commands still work.</p>
        )}
      </div>
    </div>
  );
}
