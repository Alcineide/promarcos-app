import { Router } from "express";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";
import { db, usuariosTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", ".cache", ".replit-artifact",
  ".local", ".config", "attached_assets", ".canvas", ".upm",
]);

const SKIP_FILES = new Set([
  ".replit", "replit.nix", "generated-icon.png", ".gitignore",
  "pnpm-lock.yaml", ".env",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".md",
  ".mjs", ".cjs", ".yaml", ".yml", ".toml", ".svg",
  ".sh", ".txt", ".prettierrc", ".eslintrc",
]);

function collectFiles(dir: string, rootDir: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;

    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      results.push(...collectFiles(fullPath, rootDir));
    } else if (stat.isFile()) {
      const ext = entry.includes(".") ? "." + entry.split(".").pop()! : "";
      if (TEXT_EXTENSIONS.has(ext) || entry === "Dockerfile" || entry === "Makefile") {
        try {
          const content = readFileSync(fullPath, "utf-8");
          if (content.length < 500000) {
            results.push({
              path: relative(rootDir, fullPath),
              content,
            });
          }
        } catch { /* skip unreadable */ }
      }
    }
  }

  return results;
}

router.get("/download-projeto", async (req, res) => {
  try {
    const requesterEmail = req.headers["x-user-email"] as string;
    if (!requesterEmail) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }
    const [requester] = await db
      .select()
      .from(usuariosTable)
      .where(eq(usuariosTable.email, requesterEmail.toLowerCase()));
    if (!requester || requester.role !== "admin" || !requester.ativo) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
  } catch {
    res.status(500).json({ error: "Erro interno" });
    return;
  }
  const projectRoot = join(process.cwd(), "../..");
  const files = collectFiles(projectRoot, projectRoot);

  const projeto = {
    nome: "Mendes Advocacia - Sistema Completo",
    geradoEm: new Date().toISOString(),
    totalArquivos: files.length,
    arquivos: files,
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="mendes-advocacia-projeto-completo.json"');
  res.json(projeto);
});

export default router;
