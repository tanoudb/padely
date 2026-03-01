function normalizeField(field) {
  if (!field) return null;
  return String(field).replace(/^\./, '');
}

export function fieldErrorsFromApiError(error) {
  const out = {};

  const fallbackMessage = String(error?.message ?? '').trim();
  const directField = normalizeField(error?.field);
  if (directField) {
    out[directField] = fallbackMessage || 'Champ invalide';
  }

  const issues = Array.isArray(error?.issues) ? error.issues : [];
  for (const issue of issues) {
    const key = normalizeField(issue?.field);
    if (!key) continue;
    if (!out[key]) {
      out[key] = String(issue?.message ?? 'Champ invalide');
    }
  }

  return out;
}

export function firstFieldError(errors, keys) {
  for (const key of keys) {
    if (errors[key]) {
      return errors[key];
    }
  }
  return '';
}
