# Seller Dashboard Implementation

## Overview

The seller dashboard provides a complete interface for Indonesian sellers to manage their escrow transactions, monitor balances, and request payouts. This implementation includes authentication, responsive navigation, and a clean, modern UI.

## Features Implemented

### ✅ Core Components

1. **DashboardLayout** (`src/layouts/DashboardLayout.astro`)
   - Authentication validation with redirect to /login
   - Seller data fetching from session
   - Responsive layout structure
   - Integration with Header and Navigation components

2. **Header Component** (`src/components/dashboard/Header.astro`)
   - Seller name and business name display
   - Logout functionality
   - Mobile menu toggle
   - Responsive design with collapsible elements

3. **Navigation Component** (`src/components/dashboard/Navigation.astro`)
   - Side navigation menu
   - Active state highlighting
   - Links to all dashboard sections
   - Mobile-responsive collapsible menu
   - API documentation link

4. **Dashboard Home** (`src/pages/dashboard/index.astro`)
   - Quick stats cards (held balance, available balance, pending payouts, total transactions)
   - Recent transactions list
   - Action buttons (create transaction, request payout)
   - Mock data for development

### ✅ Additional Pages

- **Transactions** (`/dashboard/transactions`) - Placeholder for transaction management
- **Payouts** (`/dashboard/payouts`) - Placeholder for payout management
- **Balance** (`/dashboard/balance`) - Placeholder for balance overview
- **Settings** (`/dashboard/settings`) - Placeholder for seller settings
- **Login** (`/login`) - Authentication page

### ✅ Utility Functions

`src/lib/dashboard-utils.ts` provides:
- `formatRupiah()` - Format amounts in Indonesian Rupiah
- `formatDate()` - Format dates in Indonesian locale
- `getStatusColor()` - Get status badge color classes
- `getStatusLabel()` - Get Indonesian status labels
- `maskEmail()` - Mask email addresses for privacy
- Additional helper functions

### ✅ Authentication Integration

- **Middleware** (`src/middleware.ts`)
  - D1 database injection into Astro locals
  - Auth helper injection
  - Runtime context setup

- **Authentication Flow**
  - Better Auth session validation
  - Automatic redirect to /login for unauthenticated users
  - Session-based authentication for dashboard

## Design System

### Colors

- **Primary Blue**: #2563eb (actions, links)
- **Success Green**: #059669 (released status)
- **Warning Yellow**: #d97706 (held status)
- **Error Red**: #dc2626 (disputed status)
- **Neutral Gray**: #6b7280 (text, borders)

### Status Badges

- `held` → "Ditahan" (yellow)
- `released` → "Dirilis" (green)
- `disputed` → "Disengketakan" (red)
- `refunded` → "Dikembalikan" (gray)
- `pending` → "Pending" (blue)

### Responsive Design

- **Desktop**: Fixed sidebar (250px), main content area
- **Mobile**: Hidden sidebar, toggle menu, stacked layout
- **Breakpoint**: 768px

## Mock Data Structure

### Stats
```typescript
{
  heldBalance: number,      // Funds currently in escrow
  availableBalance: number,  // Funds ready for payout
  pendingPayout: number,     // Payouts being processed
  totalTransactions: number  // Total transaction count
}
```

### Transaction
```typescript
{
  id: string;              // Transaction ID
  buyerEmail: string;      // Masked buyer email
  amount: number;          // Amount in IDR
  status: string;          // Transaction status
  createdAt: string;       // ISO 8601 timestamp
}
```

## File Structure

```
src/
├── layouts/
│   ├── Layout.astro              # Base layout
│   └── DashboardLayout.astro     # Dashboard wrapper
├── components/
│   └── dashboard/
│       ├── Header.astro          # Top navigation
│       └── Navigation.astro      # Side navigation
├── pages/
│   ├── dashboard/
│   │   ├── index.astro           # Dashboard home
│   │   ├── transactions.astro    # Transactions page
│   │   ├── payouts.astro         # Payouts page
│   │   ├── balance.astro         # Balance page
│   │   └── settings.astro        # Settings page
│   └── login.astro               # Login page
├── lib/
│   ├── auth.ts                   # Better Auth configuration
│   ├── auth-constants.ts         # Auth constants
│   └── dashboard-utils.ts        # Dashboard utilities
└── middleware.ts                 # Astro middleware
```

## Testing

All dashboard components are tested in `tests/dashboard.test.ts`:

```bash
npm test -- tests/dashboard.test.ts
```

### Test Coverage

- Component file existence
- Authentication integration
- Navigation menu items
- Responsive design styles
- Utility functions (Rupiah formatting, date formatting, etc.)
- Placeholder pages
- Middleware setup

## Usage

### Accessing the Dashboard

1. Navigate to `/dashboard`
2. If not authenticated, redirect to `/login`
3. After login, access all dashboard features

### Creating New Dashboard Pages

1. Create page in `src/pages/dashboard/`
2. Use `DashboardLayout` wrapper:

```astro
---
import DashboardLayout from '@/layouts/DashboardLayout.astro';
---

<DashboardLayout title="Page Title">
  <!-- Your content here -->
</DashboardLayout>
```

### Using Utility Functions

```astro
---
import { formatRupiah, formatDate, getStatusLabel } from '@/lib/dashboard-utils';

const amount = 1000000;
const formatted = formatRupiah(amount); // "Rp 1.000.000"
---
```

## Next Steps

### Phase 2: Real Data Integration

- Replace mock data with database queries
- Implement actual transaction fetching
- Add real-time balance updates
- Connect to payout processing

### Phase 3: Enhanced Features

- Transaction filtering and search
- Pagination for transaction lists
- Export functionality (CSV, PDF)
- Charts and analytics
- Notification system

### Phase 4: Mobile App

- Progressive Web App (PWA) support
- Mobile-specific optimizations
- Offline mode support

## Technical Notes

### Authentication

- Uses Better Auth library
- Session-based authentication
- D1 database for session storage
- Automatic session refresh

### Database

- Cloudflare D1 (SQLite)
- Schema defined in PRD
- Kysely ORM for type-safe queries
- Prepared statements for security

### Performance

- Server-side rendering (Astro)
- Static asset optimization
- Lazy loading for large lists
- Efficient CSS-in-JS

### Security

- CSRF protection
- Input sanitization
- SQL injection prevention
- XSS protection via Astro
- Secure cookie handling

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Internationalization

Current implementation uses Indonesian language:
- Currency: Indonesian Rupiah (IDR)
- Date format: Indonesian locale
- Status labels: Indonesian
- UI text: Indonesian

Future support for English and other languages planned.

## Accessibility

- Semantic HTML elements
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast mode compatible

## Performance Metrics

Target metrics (from PRD):
- API p95 latency: <300ms
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Lighthouse score: >90

## License

Part of Escrow Lite project. See main LICENSE file.

## Support

For issues or questions:
- GitHub Issues: [project repo]
- Documentation: [docs link]
- Email: support@escrowlite.id
