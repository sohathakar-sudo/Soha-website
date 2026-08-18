import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const CONTENT_DIR = path.join(process.cwd(), "content");

function read(filename) {
  const filePath = path.join(CONTENT_DIR, filename);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `Missing content file: content/${filename}. Create it, or remove the section that reads it.`
      );
    }
    throw err;
  }
}

/** Render a markdown file from content/ to an HTML string. */
export function getMarkdown(filename) {
  return marked.parse(read(filename), { async: false });
}

/**
 * Parse a JSON file from content/. Soha edits these by hand on GitHub, so a
 * syntax error is the expected failure mode — surface it with the filename
 * attached rather than a bare "Unexpected token" from deep in the build log.
 */
export function getJson(filename) {
  const raw = read(filename);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `content/${filename} isn't valid JSON: ${err.message}\n` +
        `This is almost always a missing comma between items, or an extra ` +
        `comma after the last one.`
    );
  }
}

/** Newest first. Entries without a usable date sort to the end. */
export function sortByDateDesc(entries) {
  return [...entries].sort((a, b) => {
    const ta = Date.parse(a.date);
    const tb = Date.parse(b.date);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });
}
