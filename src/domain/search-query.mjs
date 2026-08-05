import { listPlatformIds } from "./platform-catalog.mjs";
import { ValidationError } from "./errors.mjs";

export function parseSearchQuery({ text, platforms }) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    throw new ValidationError("Search keyword is required.");
  }

  const platformIds = parsePlatformIds(platforms);
  if (!platformIds.length) {
    throw new ValidationError("At least one supported platform is required.");
  }

  return {
    text: normalizedText,
    platformIds
  };
}

function normalizeText(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized || /(?:^|\s)(?:lego|\u6a02\u9ad8)(?:\s|$)/i.test(normalized)) {
    return normalized;
  }

  return `LEGO ${normalized}`;
}

function parsePlatformIds(value) {
  const supportedPlatformIds = listPlatformIds();

  if (!value) {
    return supportedPlatformIds;
  }

  const requested = Array.isArray(value)
    ? value
    : String(value).split(",");

  return requested
    .map((item) => String(item).trim())
    .filter((item, index, all) => supportedPlatformIds.includes(item) && all.indexOf(item) === index);
}
