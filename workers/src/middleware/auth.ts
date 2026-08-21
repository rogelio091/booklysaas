import { jwtVerify } from 'jose';
import type { MiddlewareHandler } from 'hono';
import type { AppContext, UserJwtPayload } from '../types';

export const authMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token JWT no proporcionado' },
      },
      401,
    );
  }

  const token = authHeader.substring(7);
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const userPayload: UserJwtPayload = {
      sub: Number(payload.sub),
      companyId: Number(payload['companyId']),
      email: String(payload['email']),
      role: payload['role'] as UserJwtPayload['role'],
    };

    c.set('user', userPayload);
    c.set('companyId', userPayload.companyId);

    await next();
  } catch (err) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token JWT inválido o expirado' },
      },
      401,
    );
  }
};
