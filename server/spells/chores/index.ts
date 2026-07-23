import type { Express, Request, Response } from "express";
import { google } from "googleapis";
import type { SpellModule } from "../../src/types.js";
import { getAuthorizedClient } from "../google-account/client.js";
import { getSettings } from "../../src/settingsStore.js";

function getTasksClient() {
  const client = getAuthorizedClient();
  if (!client) return null;
  return google.tasks({ version: "v1", auth: client });
}

/** Which of the account's task lists to show as family-member boards, picked in Settings. */
function getSelectedListIds(): string[] {
  const { listIds } = getSettings("chores");
  return Array.isArray(listIds) ? listIds.filter((id): id is string => typeof id === "string") : [];
}

function handleErrors(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error("[chores spell]", err);
      res.status(500).json({ error: "internal_error" });
    });
  };
}

const mod: SpellModule = {
  register(app: Express) {
    app.get(
      "/api/spells/chores/tasklists",
      handleErrors(async (_req, res) => {
        const tasks = getTasksClient();
        if (!tasks) {
          res.status(401).json({ error: "google_not_connected" });
          return;
        }
        const result = await tasks.tasklists.list();
        const tasklists = (result.data.items ?? []).map((list) => ({
          id: list.id,
          title: list.title ?? list.id,
        }));
        res.json({ tasklists });
      })
    );

    app.get(
      "/api/spells/chores/board",
      handleErrors(async (_req, res) => {
        const tasks = getTasksClient();
        if (!tasks) {
          res.status(401).json({ error: "google_not_connected" });
          return;
        }
        const listIds = getSelectedListIds();
        const board = await Promise.all(
          listIds.map(async (listId) => {
            const [list, taskResult] = await Promise.all([
              tasks.tasklists.get({ tasklist: listId }),
              tasks.tasks.list({ tasklist: listId, showCompleted: true, showHidden: true }),
            ]);
            const items = (taskResult.data.items ?? [])
              .map((task) => ({
                id: task.id!,
                title: task.title ?? "(untitled)",
                status: task.status === "completed" ? ("completed" as const) : ("needsAction" as const),
              }))
              .sort((a, b) => (a.status === b.status ? 0 : a.status === "needsAction" ? -1 : 1));
            return { id: listId, title: list.data.title ?? listId, tasks: items };
          })
        );
        res.json({ board });
      })
    );

    app.post(
      "/api/spells/chores/tasks",
      handleErrors(async (req, res) => {
        const tasks = getTasksClient();
        if (!tasks) {
          res.status(401).json({ error: "google_not_connected" });
          return;
        }
        const { listId, title } = req.body as { listId: string; title: string };
        const result = await tasks.tasks.insert({ tasklist: listId, requestBody: { title } });
        res.status(201).json({ id: result.data.id, title: result.data.title, status: "needsAction" });
      })
    );

    app.patch(
      "/api/spells/chores/tasks/:listId/:taskId",
      handleErrors(async (req, res) => {
        const tasks = getTasksClient();
        if (!tasks) {
          res.status(401).json({ error: "google_not_connected" });
          return;
        }
        const { status } = req.body as { status: "needsAction" | "completed" };
        await tasks.tasks.patch({
          tasklist: req.params.listId,
          task: req.params.taskId,
          requestBody:
            status === "completed"
              ? { status: "completed", completed: new Date().toISOString() }
              : { status: "needsAction", completed: null },
        });
        res.status(204).end();
      })
    );
  },
};

export default mod;
