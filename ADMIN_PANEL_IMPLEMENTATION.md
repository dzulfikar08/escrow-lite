# Admin Panel Implementation

## Overview

The admin panel provides a secure, role-based interface for platform administrators to manage transactions, disputes, sellers, and payouts. It includes comprehensive audit logging and session validation.

## Architecture

### Authentication Flow

1. **Session Validation**: Every admin page request validates the user's session via Better Auth
2. **Role Verification**: The `verifyAdminPage()` function checks if the user exists in the `admin_users` table
3. **Access Control**: Non-admins are redirected to the seller dashboard with an error message
4. **Audit Logging**: All admin access and actions are logged for compliance

### Security Measures

- **Database-Backed Roles**: Admin status is stored in the `admin_users` table, not just environment variables
- **Session Validation**: Every request validates session freshness and admin role
- **Audit Trail**: All admin actions are logged with timestamp, admin ID, and details
- **Active Status Check**: Inactive admin accounts cannot access the panel
- **Redirect Protection**: Unauthorized accesses are redirected, not shown with errors

## Components

### 1. Admin Authentication (`/src/lib/admin-auth.ts`)

**Key Functions:**

- `verifyAdmin(context)` - Verifies admin authentication for API routes
- `verifyAdminPage(context)` - Verifies admin for pages (returns null instead of throwing)
- `isSuperAdmin(admin)` - Checks if user has super_admin role
- `isAdmin(user)` - Type guard for admin users

**Interface:**
```typescript
interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
}
```

### 2. Admin Layout (`/src/layouts/AdminLayout.astro`)

**Features:**
- Fixed sidebar navigation with all admin sections
- Mobile-responsive with collapsible sidebar
- Active path highlighting
- Authentication check on every page load
- Audit logging for panel access

**Navigation Sections:**
- Dashboard (`/admin`)
- Transactions (`/admin/transactions`)
- Disputes (`/admin/disputes`)
- Sellers (`/admin/sellers`)
- Payouts (`/admin/payouts`)
- Audit Log (`/admin/audit`)
- Settings (`/admin/settings`)

### 3. Admin Header (`/components/admin/AdminHeader.astro`)

**Features:**
- Displays admin name and email
- Role badge (Admin/Super Admin)
- Mobile menu toggle
- Logout button
- Sticky positioning

### 4. StatCard Component (`/components/admin/StatCard.astro`)

**Props:**
- `title` - Card title
- `value` - Display value (number or string)
- `description` - Subtitle/description
- `icon` - Predefined icon type
- `color` - Color variant
- `trend` - Optional trend indicator
- `href` - Optional link to make card clickable

**Icon Types:**
- `transactions` - Document icon
- `volume` - Wallet icon
- `disputes` - Warning triangle
- `sellers` - Users group
- `payouts` - Credit card
- `custom` - Default info icon

**Color Variants:**
- `blue` - Primary information
- `green` - Positive/success metrics
- `yellow` - Warnings/cautions
- `red` - Errors/alerts
- `purple` - Secondary metrics
- `gray` - Neutral information

### 5. Admin Dashboard (`/src/pages/admin/index.astro`)

**Overview Statistics:**
1. Total Transactions (with trend)
2. Total Held Volume (in escrow)
3. Pending Disputes (requires attention)
4. Active Sellers (with new signups)
5. Pending Payouts (awaiting processing)
6. Total Released Volume (successful releases)

**Quick Actions:**
- Create Transaction
- Review Disputes
- Approve Payouts
- Verify Sellers

**Recent Activity Feed:**
- Shows last 5 platform activities
- Color-coded by severity (info/warning/success)
- Timestamps for each activity
- Links to full audit log

## Database Schema

### admin_users Table

```sql
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')),
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### audit_log Table (Recommended)

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  session_id TEXT,
  action TEXT NOT NULL,
  details TEXT, -- JSON string
  user_agent TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id)
);
```

## Environment Variables

Add to `.env`:

```bash
# Admin emails (comma-separated allowlist for admin panel access)
# This provides an additional layer of security on top of database roles
ADMIN_EMAILS=admin@yourdomain.com,support@yourdomain.com
```

**Note**: While `ADMIN_EMAILS` provides an additional layer, the primary authorization comes from the `admin_users` table. This allows for dynamic admin management without code changes.

## Usage

### Creating an Admin User

Run this SQL to create an admin user:

```sql
INSERT INTO admin_users (id, email, name, role, is_active, created_at, updated_at)
VALUES (
  'admin-uuid-here',
  'admin@escrowlite.id',
  'Admin User',
  'super_admin',
  1,
  datetime('now'),
  datetime('now')
);
```

The `id` should match the user's ID from the Better Auth `user` table.

### Protecting Admin Pages

Use the `AdminLayout` wrapper:

```astro
---
import AdminLayout from '@/layouts/AdminLayout.astro';
---

<AdminLayout title="My Admin Page">
  <!-- Page content here -->
</AdminLayout>
```

The layout automatically:
1. Validates the session
2. Checks admin role
3. Redirects if unauthorized
4. Logs access for audit

### Protecting Admin API Routes

```typescript
import { verifyAdmin } from '@/lib/admin-auth';

export async function POST(context: APIContext) {
  const admin = await verifyAdmin(context);

  // Now you can use admin.id for audit logging
  // ... your logic here
}
```

### Audit Logging

Currently logs to console in development. For production:

1. Create `audit_log` table (see schema above)
2. Update `logAdminAction()` in `admin-auth.ts`:
```typescript
export async function logAdminAction(
  adminId: string,
  action: string,
  details: Record<string, any>,
  sessionId?: string
): Promise<void> {
  const logEntry = {
    id: crypto.randomUUID(),
    adminId,
    sessionId,
    action,
    details: JSON.stringify(details),
    userAgent: context.request.headers.get('user-agent'),
    ipAddress: context.request.headers.get('cf-connecting-ip'),
    createdAt: new Date().toISOString(),
  };

  await context.locals.runtime.env.DB
    .prepare('INSERT INTO audit_log (...) VALUES (...)')
    .bind(...)
    .run();
}
```

## Security Checklist

- [x] Session validation on every request
- [x] Database-backed role verification
- [x] Audit logging for all access
- [x] Active status check for admin accounts
- [x] Mobile-responsive sidebar with authentication
- [x] Role-based UI (Admin vs Super Admin badges)
- [x] Redirect instead of error messages
- [ ] Rate limiting on admin routes (recommended)
- [ ] IP whitelist option (recommended)
- [ ] 2FA enforcement (recommended for production)
- [ ] Database audit log implementation (TODO)

## Future Enhancements

1. **Audit Log Page**: `/admin/audit` with searchable/filterable logs
2. **Admin Management**: Super admins can create/edit admin accounts
3. **Role-Based Permissions**: Granular permissions per section
4. **2FA Enforcement**: Require 2FA for admin access
5. **IP Whitelist**: Optional IP restriction for admin access
6. **Session Timeout Warning**: Notify before session expires
7. **Concurrent Session Limit**: Limit simultaneous admin sessions
8. **Detailed Audit Export**: Download audit logs as CSV

## Files Created

1. `/src/lib/admin-auth.ts` - Admin authentication utilities
2. `/src/layouts/AdminLayout.astro` - Admin layout wrapper
3. `/src/components/admin/AdminHeader.astro` - Admin header component
4. `/src/components/admin/StatCard.astro` - Statistics card component
5. `/src/pages/admin/index.astro` - Admin dashboard home

## Testing

To test the admin panel:

1. Create an admin user in the database
2. Ensure the user's email matches an existing Better Auth user
3. Set `ADMIN_EMAILS` environment variable (optional additional layer)
4. Login as that user
5. Navigate to `/admin`
6. Verify dashboard loads correctly
7. Check console for audit logs
8. Try accessing `/admin` from a non-admin account (should redirect)

## Troubleshooting

**"Admin account not found or inactive" error:**
- Verify the user exists in `admin_users` table
- Check `is_active = 1`
- Ensure the `id` matches the Better Auth user ID

**Redirect loop:**
- Clear browser cookies
- Check session hasn't expired
- Verify `admin_users.id` matches `user.id` from Better Auth

**Missing statistics:**
- Currently using mock data
- Real statistics will come from database queries in future tasks
