import { Prisma } from "@prisma/client";
import { prisma } from "../src/db.js";

// Clears every table between tests by walking Prisma's own runtime data
// model rather than hand-listing table names — new models get picked up
// automatically. Every userId/reporterId relation in the schema is
// onDelete: Cascade or SetNull, so deletion order doesn't matter.
export async function resetDb() {
  for (const model of Prisma.dmmf.datamodel.models) {
    const clientKey = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    const delegate = (prisma as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[clientKey];
    await delegate.deleteMany();
  }
}
