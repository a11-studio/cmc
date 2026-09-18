import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getAgentDefinition } from "@/lib/agents/registry";
import type { ArenaAgentDefinition } from "@/lib/agents/types";

type CachedSkill = { text: string; mtimeMs: number };

const cache = new Map<string, CachedSkill>();

export function isSkillPath(value: string): boolean {
  return /^skills\/[a-z0-9-]+\.md$/.test(value);
}

export function loadAgentSkill(skillPath: string): string {
  if (!isSkillPath(skillPath)) {
    throw new Error(`Invalid skill path: ${skillPath}`);
  }

  const fileName = skillPath.slice("skills/".length);
  const filePath = join(/* turbopackIgnore: true */ process.cwd(), "skills", fileName);
  const mtimeMs = statSync(filePath).mtimeMs;
  const cached = cache.get(skillPath);

  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.text;
  }

  const text = readFileSync(filePath, "utf8").trim();

  if (!text) {
    throw new Error(`Skill file is empty: ${skillPath}`);
  }

  cache.set(skillPath, { text, mtimeMs });
  return text;
}

export function loadAgentSkillFor(agent: Pick<ArenaAgentDefinition, "id" | "skillPath"> | string): string {
  const definition = typeof agent === "string" ? getAgentDefinition(agent) : agent;
  return loadAgentSkill(definition.skillPath);
}

export function extractSkillSection(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`));
  return match?.[1]?.trim() ?? "";
}

export function getAgentSkillSection(agentId: string, heading: string): string {
  return extractSkillSection(loadAgentSkillFor(agentId), heading);
}
