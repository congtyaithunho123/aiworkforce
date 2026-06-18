import { pgTable, integer, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { departmentsTable } from "./departments";
import { agentsTable } from "./agents";

export const departmentAgentsTable = pgTable(
  "department_agents",
  {
    departmentId: integer("department_id")
      .references(() => departmentsTable.id, { onDelete: "cascade" })
      .notNull(),
    agentId: integer("agent_id")
      .references(() => agentsTable.id, { onDelete: "cascade" })
      .notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.departmentId, t.agentId] })],
);

export type DepartmentAgent = typeof departmentAgentsTable.$inferSelect;
