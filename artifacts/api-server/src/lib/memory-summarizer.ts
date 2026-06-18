import { eq, isNull, and, asc } from "drizzle-orm";
import { db, memoriesTable } from "@workspace/db";
import { runCompletion } from "./ai-service";
import { logger } from "./logger";

const MEMORY_THRESHOLD = 50;
const MEMORIES_TO_ARCHIVE = 40;

export async function maybeSummarizeMemories(
  agentId: number,
  organizationId: number,
): Promise<void> {
  const activeMemories = await db
    .select()
    .from(memoriesTable)
    .where(
      and(
        eq(memoriesTable.agentId, agentId),
        isNull(memoriesTable.archivedAt),
      ),
    )
    .orderBy(asc(memoriesTable.createdAt));

  if (activeMemories.length <= MEMORY_THRESHOLD) {
    return;
  }

  logger.info(
    { agentId, count: activeMemories.length },
    "Memory threshold exceeded, summarizing",
  );

  const toArchive = activeMemories
    .filter((m) => !m.isSummary)
    .slice(0, MEMORIES_TO_ARCHIVE);

  if (toArchive.length < 5) {
    return;
  }

  const transcript = toArchive
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const summaryResult = await runCompletion(
    [
      {
        role: "system",
        content:
          "You are a memory compression assistant. Summarize the following conversation history into a concise paragraph that preserves all key facts, decisions, names, and outcomes. Write in third-person perspective.",
      },
      {
        role: "user",
        content: `Summarize this conversation history:\n\n${transcript}`,
      },
    ],
    { model: "gpt-4o-mini" },
  );

  await db.insert(memoriesTable).values({
    agentId,
    organizationId,
    role: "system",
    content: `[MEMORY SUMMARY] ${summaryResult.content}`,
    isSummary: true,
  });

  const archiveTime = new Date();
  for (const memory of toArchive) {
    await db
      .update(memoriesTable)
      .set({ archivedAt: archiveTime })
      .where(eq(memoriesTable.id, memory.id));
  }

  logger.info(
    { agentId, archived: toArchive.length },
    "Memories summarized and archived",
  );
}
