import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDefinition } from "@/lib/agents/registry";
import type { ArenaAgentDefinition } from "@/lib/agents/types";

const cache = new Map<string, string>();

export function isSkillPath(value: string): boolean {
  return /^skills\/[a-z0-9-]+\.md$/.test(value);
}

export function loadAgentSkill(skillPath: string): string {
  const cached = cache.get(skillPath);

  if (cached) {
    return cached;
  }

  if (!isSkillPath(skillPath)) {
    throw new Error(`Invalid skill path: ${skillPath}`);
  }

  const fileName = skillPath.slice("skills/".length);
  const text = readFileSync(join(/* turbopackIgnore: true */ process.cwd(), "skills", fileName), "utf8").trim();

  if (!text) {
    throw new Error(`Skill file is empty: ${skillPath}`);
  }

  cache.set(skillPath, text);
  return text;
}

export function loadAgentSkillFor(agent: Pick<ArenaAgentDefinition, "id" | "skillPath"> | string): string {
  const definition = typeof agent === "string" ? getAgentDefinition(agent) : agent;
  return loadAgentSkill(definition.skillPath);
}
