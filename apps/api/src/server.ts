import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app";
import { packLoader } from "./packs";
import { PrismaStore } from "./prisma-store";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const tokenSecret = process.env.JWT_SECRET;
if (!tokenSecret || tokenSecret.length < 16) {
  console.error("JWT_SECRET must be set to at least 16 characters");
  process.exit(1);
}

const prisma = new PrismaClient();
// src/ and dist/ both sit next to packs/, which `pnpm content:pack` fills.
const packsDir = new URL("../packs/", import.meta.url);
const app = buildApp(
  { logger: true },
  { store: new PrismaStore(prisma), tokenSecret, loadPack: packLoader(packsDir) },
);
app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
