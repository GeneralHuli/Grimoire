import Anthropic from "@anthropic-ai/sdk";

export interface ChoreTaskContext {
  id: string;
  title: string;
  status: "needsAction" | "completed";
}

export interface ChoreBoardContext {
  id: string;
  title: string;
  tasks: ChoreTaskContext[];
}

export interface GroceryItemContext {
  id: string;
  quantity: string;
  name: string;
  checked: boolean;
}

export interface RecipeContext {
  id: string;
  title: string;
}

export interface CommandContext {
  choreBoards: ChoreBoardContext[];
  groceryItems: GroceryItemContext[];
  recipes: RecipeContext[];
}

export type CommandAction =
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

export interface CommandIntent {
  action: CommandAction;
  /** Anthropic's structured-output schema has no nullable-type idiom — absent values are "" rather than null. */
  groceryName: string;
  groceryQuantity: string;
  groceryItemId: string;
  choresListId: string;
  choresTaskId: string;
  choresTitle: string;
  calendarTitle: string;
  /** Local naive datetime/date strings (no timezone suffix) — same shape CalendarEventModal.tsx sends. */
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

const COMMAND_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: [
        "grocery.add",
        "grocery.check",
        "grocery.remove",
        "chores.add",
        "chores.complete",
        "chores.reopen",
        "calendar.create",
        "calendar.query",
        "mealplan.add",
        "mealplan.remove",
        "unknown",
      ],
    },
    groceryName: { type: "string" },
    groceryQuantity: { type: "string" },
    groceryItemId: { type: "string" },
    choresListId: { type: "string" },
    choresTaskId: { type: "string" },
    choresTitle: { type: "string" },
    calendarTitle: { type: "string" },
    calendarStart: { type: "string" },
    calendarEnd: { type: "string" },
    calendarAllDay: { type: "boolean" },
    calendarQueryDate: { type: "string" },
    calendarQueryRange: { type: "string", enum: ["day", "week", "month", ""] },
    mealPlanDate: { type: "string" },
    mealPlanRecipeId: { type: "string" },
    confirmationText: { type: "string" },
    clarificationNeeded: { type: "boolean" },
    clarificationQuestion: { type: "string" },
  },
  required: [
    "action",
    "groceryName",
    "groceryQuantity",
    "groceryItemId",
    "choresListId",
    "choresTaskId",
    "choresTitle",
    "calendarTitle",
    "calendarStart",
    "calendarEnd",
    "calendarAllDay",
    "calendarQueryDate",
    "calendarQueryRange",
    "mealPlanDate",
    "mealPlanRecipeId",
    "confirmationText",
    "clarificationNeeded",
    "clarificationQuestion",
  ],
  additionalProperties: false,
} as const;

function localDateTimeLabel(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${date} ${time}`;
}

const INSTRUCTIONS = `You are the command parser for Grimoire, a family household app. Turn the household member's spoken/typed command into exactly one structured action.

Every field below is required by the schema, but most only matter for one action — for every field that doesn't apply to the action you choose, set it to "" (empty string) or false, never omit it.

Available actions and the fields that apply to each:
- grocery.add: groceryName (required), groceryQuantity (e.g. "2 cups", or "" if not said)
- grocery.check: groceryItemId — match against the current grocery list items given in context by name
- grocery.remove: groceryItemId — match against the current grocery list items given in context by name
- chores.add: choresListId (match the named person against the chore board titles in context), choresTitle (the chore's title)
- chores.complete / chores.reopen: choresListId + choresTaskId — match against the chore boards/tasks given in context
- calendar.create: calendarTitle, calendarStart, calendarEnd, calendarAllDay. For timed events use local datetime strings with NO timezone suffix, e.g. "2026-08-06T15:00:00". For all-day events use a plain date "2026-08-06" for both start and end and set calendarAllDay true.
- calendar.query: calendarQueryDate ("YYYY-MM-DD") and calendarQueryRange ("day"|"week"|"month")
- mealplan.add / mealplan.remove: mealPlanDate ("YYYY-MM-DD") + mealPlanRecipeId — match the named recipe against the recipes given in context
- unknown: the command doesn't map to any supported action

Always set confirmationText to a short, natural sentence describing what you're about to do (e.g. "Adding milk to the grocery list.", "Marking dishes done for Alex."), even when clarificationNeeded is true (in that case confirmationText can be "").

Set clarificationNeeded to true (and action to "unknown") instead of guessing whenever:
- a name (person, chore, recipe) doesn't clearly match anything given in the context, or matches more than one thing ambiguously
- a required field can't be determined from the command
In that case, set clarificationQuestion to a short question to ask the household member back.`;

export async function parseCommand(text: string, context: CommandContext): Promise<CommandIntent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: COMMAND_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `${INSTRUCTIONS}

Current date/time: ${localDateTimeLabel(new Date())}

Context:
${JSON.stringify(context)}

Command: ${text}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No response returned");
  return JSON.parse(block.text) as CommandIntent;
}
