function slugifySchemaKey(value, prefix = "field") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || prefix;
}

function ensureUniqueSchemaKey(baseKey, items = []) {
  const existingKeys = new Set((items || []).map((item) => item?.key).filter(Boolean));
  if (!existingKeys.has(baseKey)) {
    return baseKey;
  }

  let suffix = 2;
  while (existingKeys.has(`${baseKey}_${suffix}`)) {
    suffix += 1;
  }

  return `${baseKey}_${suffix}`;
}

function normalizeOptions(rawValue) {
  const source = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || "").split(/\r?\n|,/);

  const seen = new Set();
  const options = [];

  source.forEach((entry) => {
    const value = String(entry || "").trim();
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    options.push(value);
  });

  return options;
}

function createExtractionField(items = []) {
  const baseKey = ensureUniqueSchemaKey("field", items);
  return {
    key: baseKey,
    label: "",
    type: "text",
    options: [],
  };
}

function createQualityCriterion(items = []) {
  const baseKey = ensureUniqueSchemaKey("criterion", items);
  return {
    key: baseKey,
    label: "",
  };
}

export {
  createExtractionField,
  createQualityCriterion,
  ensureUniqueSchemaKey,
  normalizeOptions,
  slugifySchemaKey,
};
