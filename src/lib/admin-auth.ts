import type { APIContext } from 'astro';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError } from '@/lib/errors';

/**
 * Admin user interface
 */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
}

/**
 * Verify admin authentication and role
 * Throws AuthenticationError if not authenticated or not an admin
 *
 * @param context - Astro API context
 * @returns Admin user object
 * @throws AuthenticationError if not authenticated or not an admin
 */
export async function verifyAdmin(context: APIContext): Promise<AdminUser> {
  // Get session from context.locals (set by middleware)
  const session = context.locals.session;

  if (!session?.user?.id) {
    throw new AuthenticationError('Authentication required');
  }

  // Get DB from runtime
  const db = context.locals.runtime?.runtime.env.DB;
  if (!db) {
    throw new AuthenticationError('Database not available');
  }

  // Query admin_users table to verify role
  const adminResult = await db
    .prepare(
      `
      SELECT id, email, name, role, is_active
      FROM admin_users
      WHERE id = ?
      AND is_active = 1
      LIMIT 1
      `
    )
    .bind(session.user.id)
    .first();

  if (!adminResult) {
    throw new AuthenticationError('Admin account not found or inactive');
  }

  const admin = adminResult as {
    id: string;
    email: string;
    name: string;
    role: string;
    is_active: number;
  };

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role as 'admin' | 'super_admin',
  };
}

/**
 * Verify admin authentication for page access
 * Returns null if not authenticated (for redirect in pages)
 *
 * @param context - Astro API context
 * @returns Admin user object or null
 */
export async function verifyAdminPage(context: APIContext): Promise<AdminUser | null> {
  try {
    return await verifyAdmin(context);
  } catch (error) {
    // Return null instead of throwing for page redirects
    return null;
  }
}

/**
 * Check if user has super_admin role
 *
 * @param admin - Admin user object
 * @returns true if super_admin
 */
export function isSuperAdmin(admin: AdminUser): boolean {
  return admin.role === 'super_admin';
}

/**
 * Type guard to check if user is admin
 */
export function isAdmin(user: AdminUser): boolean {
  return user.role === 'admin' || user.role === 'super_admin';
}
