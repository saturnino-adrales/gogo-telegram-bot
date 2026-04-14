export const PERMISSION_LEVELS = ["readonly", "standard", "full"];

const TOOL_SETS = {
  readonly: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],

  standard: [
    "Read",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "Edit",
    "Write",
    "Bash",
  ],

  full: [
    "Read",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "Edit",
    "Write",
    "Bash",
    "Agent",
    "Monitor",
    "NotebookEdit",
  ],
};

/**
 * Get the list of allowed tools for a permission level.
 * @param {string} level - "readonly" | "standard" | "full"
 * @returns {string[]} list of allowed tool names
 */
export function getToolsForLevel(level) {
  if (!TOOL_SETS[level]) {
    throw new Error(
      `Unknown permission level: "${level}". Must be one of: ${PERMISSION_LEVELS.join(", ")}`
    );
  }
  return [...TOOL_SETS[level]];
}
