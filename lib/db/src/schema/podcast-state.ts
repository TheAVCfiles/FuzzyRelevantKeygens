import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const podcastStateTable = pgTable("podcast_state", {
  id: text("id").primaryKey(),
  state: jsonb("state").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PodcastStateRow = typeof podcastStateTable.$inferSelect;