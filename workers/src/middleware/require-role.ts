import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../types';

export type Role = 'superadmin' | 'admin' | 'staff';

/**
 * Middleware que restringe el acceso según el rol del JWT.
 *
 * Debe usarse DESPUÉS de `authMiddleware` (que setea `c.get('user')`).
 * Devuelve 403 si el rol no está en la lista permitida, y 401 si no hay
 * usuario autenticado.
 */
export function requireRole(allowedRoles: Role[]): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const user = c.get('user');

    if (!user) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Token JWT no proporcionado' },
        },
        401,
      );
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'No tienes permisos para esta acción' },
        },
        403,
      );
    }

    await next();
  };
}
