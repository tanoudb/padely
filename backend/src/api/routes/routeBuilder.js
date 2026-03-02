import { pathMatch } from '../router.js';

export function exact(method, pathname, handler) {
  return {
    match(req, url) {
      if (req.method !== method || url.pathname !== pathname) {
        return null;
      }
      return {};
    },
    handler,
  };
}

export function pattern(method, patternPath, handler) {
  return {
    match(req, url) {
      if (req.method !== method) {
        return null;
      }
      return pathMatch(url.pathname, patternPath);
    },
    handler,
  };
}

export async function dispatchRoutes(routes, context) {
  for (const route of routes) {
    const params = route.match(context.req, context.url);
    if (!params) {
      continue;
    }
    await route.handler({ ...context, params });
    return true;
  }
  return false;
}
