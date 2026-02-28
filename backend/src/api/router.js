export function parseUrl(req) {
  return new URL(req.url ?? '/', 'http://localhost');
}

export function pathMatch(pathname, pattern) {
  const p1 = pathname.split('/').filter(Boolean);
  const p2 = pattern.split('/').filter(Boolean);

  if (p1.length !== p2.length) {
    return null;
  }

  const params = {};
  for (let i = 0; i < p1.length; i += 1) {
    if (p2[i].startsWith(':')) {
      params[p2[i].slice(1)] = p1[i];
      continue;
    }

    if (p1[i] !== p2[i]) {
      return null;
    }
  }

  return params;
}
