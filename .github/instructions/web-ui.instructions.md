# SaveAction Web UI Development Guidelines

> **Package:** @saveaction/web  
> **Framework:** Next.js 15 (App Router)  
> **Styling:** Tailwind CSS + shadcn/ui  
> **Brand Color:** #5D5FEF

---

## Design System

### Brand Colors

```css
/* Primary Brand Color */
--primary: #5D5FEF;
--primary-hover: #4B4DD9;
--primary-active: #3E40C3;
--primary-light: #E8E8FD;
--primary-foreground: #FFFFFF;

/* Extended Palette (derived from primary) */
--primary-50: #F0F0FE;
--primary-100: #E0E1FD;
--primary-200: #C2C3FB;
--primary-300: #A3A5F9;
--primary-400: #8587F7;
--primary-500: #5D5FEF;  /* Main brand color */
--primary-600: #4B4DD9;
--primary-700: #3E40C3;
--primary-800: #3132AD;
--primary-900: #252697;
```

### Theme Configuration

#### Light Mode
- Background: `#FFFFFF` (main), `#F9FAFB` (secondary)
- Text: `#111827` (primary), `#6B7280` (secondary)
- Border: `#E5E7EB`
- Card: `#FFFFFF` with subtle shadow

#### Dark Mode (GitHub-inspired)
- Background: `#0D1117` (main), `#161B22` (secondary)
- Text: `#E6EDF3` (primary), `#8B949E` (secondary)
- Border: `#30363D`
- Card: `#161B22` with subtle border

### Typography

```css
/* Font Stack */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

### Spacing System

Use Tailwind's default spacing scale consistently:
- `space-1`: 4px (tight spacing)
- `space-2`: 8px (compact elements)
- `space-3`: 12px (related items)
- `space-4`: 16px (standard spacing)
- `space-6`: 24px (section padding)
- `space-8`: 32px (large gaps)
- `space-12`: 48px (page sections)

### Border Radius

```css
--radius-sm: 0.375rem;  /* 6px - buttons, inputs */
--radius-md: 0.5rem;    /* 8px - cards, dropdowns */
--radius-lg: 0.75rem;   /* 12px - modals, large cards */
--radius-xl: 1rem;      /* 16px - hero sections */
```

---

## Component Guidelines

### Buttons

```tsx
// Primary Button - Use for main actions
<Button variant="default">Create Recording</Button>

// Secondary Button - Use for secondary actions
<Button variant="outline">Cancel</Button>

// Destructive Button - Use for delete/danger actions
<Button variant="destructive">Delete</Button>

// Ghost Button - Use for subtle actions
<Button variant="ghost">View Details</Button>

// Icon Button - Use for toolbar actions
<Button variant="ghost" size="icon">
  <PlusIcon className="h-4 w-4" />
</Button>
```

### Cards

```tsx
// Standard Card
<Card className="p-6">
  <CardHeader>
    <CardTitle>Recording Name</CardTitle>
    <CardDescription>Created 2 hours ago</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

### Tables

- Use `@tanstack/react-table` for complex tables
- Always include pagination for lists > 10 items
- Include search/filter when list > 20 items
- Show loading skeleton during data fetch
- Empty state with illustration and action

### Forms

- Use `react-hook-form` + `zod` for validation
- Show inline validation errors
- Disable submit button while submitting
- Show loading spinner in button during submit
- Toast notification on success/error

### Modals/Dialogs

- Use for confirmations and quick forms
- Always include close button (X)
- Trap focus inside modal
- Close on Escape key
- Close on backdrop click (unless critical action)

---

## Layout Structure

### App Shell

```
┌─────────────────────────────────────────────────────────────┐
│ Header (fixed)                                     [User] [🌙]│
├──────────────┬──────────────────────────────────────────────┤
│              │                                               │
│   Sidebar    │              Main Content                    │
│   (fixed)    │              (scrollable)                    │
│              │                                               │
│   • Dashboard│                                               │
│   • Suites   │                                               │
│   • Runs     │                                               │
│   • Schedules│                                               │
│   • Library  │                                               │
│   • Settings │                                               │
│              │                                               │
├──────────────┴──────────────────────────────────────────────┤
│ (Mobile: Bottom navigation or hamburger menu)               │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

```css
/* Mobile First Approach */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large screens */
```

### Mobile Considerations

- Sidebar collapses to hamburger menu on `< md`
- Tables become cards on mobile
- Sticky header with back button on detail pages
- Bottom sheet for filters on mobile
- Touch-friendly tap targets (min 44px)

---

## File Structure

```
packages/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth pages (login, register)
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (global)/           # Global routes (project list, settings)
│   │   │   ├── layout.tsx
│   │   │   ├── projects/
│   │   │   └── settings/
│   │   ├── (project)/          # Project-scoped routes
│   │   │   └── projects/[projectId]/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx        # Project dashboard
│   │   │       ├── library/        # Recording library
│   │   │       ├── suites/         # Suite management
│   │   │       ├── runs/           # Run history + detail
│   │   │       ├── schedules/      # Schedule management
│   │   │       └── settings/       # Project settings
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing/redirect
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/             # Layout components
│   │   │   ├── header.tsx
│   │   │   ├── project-sidebar.tsx
│   │   │   ├── global-sidebar.tsx
│   │   │   ├── project-mobile-nav.tsx
│   │   │   └── suite-tree-nav.tsx
│   │   ├── projects/           # Project switcher
│   │   ├── suites/             # Suite cards, dialogs
│   │   ├── tests/              # Test config forms
│   │   ├── runs/               # Run detail, actions table, SSE
│   │   ├── schedules/          # Schedule management
│   │   ├── settings/           # Profile, security, tokens
│   │   └── shared/             # Shared components
│   │       ├── data-table.tsx
│   │       ├── empty-state.tsx
│   │       ├── error-boundary.tsx
│   │       └── pagination.tsx
│   ├── lib/                    # Utilities
│   │   ├── api.ts              # API client (fetch wrapper)
│   │   └── utils.ts            # General utilities
│   ├── providers/              # React context providers
│   │   ├── auth-provider.tsx
│   │   ├── project-provider.tsx
│   │   ├── theme-provider.tsx
│   │   └── toast-provider.tsx
├── public/
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## State Management

### Server State (API Data)

Use `@tanstack/react-query` for:
- API data fetching
- Caching and background refetching
- Optimistic updates
- Infinite scrolling/pagination

```tsx
// Example: Fetch recordings
const { data, isLoading, error } = useQuery({
  queryKey: ['recordings', filters],
  queryFn: () => api.recordings.list(filters),
});

// Example: Create recording with optimistic update
const mutation = useMutation({
  mutationFn: api.recordings.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['recordings'] });
    toast.success('Recording created');
  },
});
```

### Client State

Use React's built-in state for:
- UI state (modals, dropdowns)
- Form state (react-hook-form)
- Theme preference

### Auth State

Use React Context for auth:
- Current user
- Access token (memory)
- Refresh token handling
- Login/logout methods

---

## API Integration

### API Client

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options?.headers,
      },
      credentials: 'include', // For refresh token cookies
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error.error.code, error.error.message);
    }

    return response.json();
  }

  // Resource-specific methods
  recordings = {
    list: (params?: RecordingListParams) => 
      this.fetch<PaginatedResponse<Recording>>('/api/v1/recordings?' + qs(params)),
    get: (id: string) => 
      this.fetch<Recording>(`/api/v1/recordings/${id}`),
    create: (data: CreateRecordingData) => 
      this.fetch<Recording>('/api/v1/recordings', { method: 'POST', body: JSON.stringify(data) }),
    // ...
  };
}

export const api = new ApiClient();
```

---

## Accessibility (a11y)

### Requirements

- All interactive elements keyboard accessible
- Proper ARIA labels on icons and non-text elements
- Focus visible indicators (outline)
- Color contrast ratio ≥ 4.5:1
- Skip navigation link
- Proper heading hierarchy (h1 → h2 → h3)
- Form labels associated with inputs
- Error messages announced to screen readers

### Testing

- Use axe-core browser extension during development
- Include a11y tests with @axe-core/react

---

## Performance

### Best Practices

- Use Next.js Image component for images
- Lazy load below-fold content
- Skeleton loading states (not spinners)
- Debounce search inputs (300ms)
- Virtual scrolling for long lists (> 100 items)
- Prefetch links on hover

### Metrics Targets

- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1

---

## Testing

### Unit Tests

- Test custom hooks with `@testing-library/react-hooks`
- Test utility functions
- Test form validation schemas

### Component Tests

- Use `@testing-library/react`
- Test user interactions
- Test loading/error states
- Test accessibility

### E2E Tests

- Use Playwright (same as core package)
- Test critical user flows
- Run against real API (docker-compose)

---

## Code Style

### Component Structure

```tsx
// 1. Imports (external → internal → types → styles)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

import type { Recording } from '@/types/recording';

// 2. Types/Interfaces
interface RecordingCardProps {
  recording: Recording;
  onDelete?: (id: string) => void;
}

// 3. Component
export function RecordingCard({ recording, onDelete }: RecordingCardProps) {
  // 3a. Hooks
  const [isDeleting, setIsDeleting] = useState(false);

  // 3b. Event handlers
  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete?.(recording.id);
    setIsDeleting(false);
  };

  // 3c. Render
  return (
    <div className="...">
      {/* Component JSX */}
    </div>
  );
}
```

### Naming Conventions

- **Components:** PascalCase (`RecordingCard.tsx`)
- **Hooks:** camelCase with `use` prefix (`useRecordings.ts`)
- **Utilities:** camelCase (`formatDate.ts`)
- **Types:** PascalCase (`Recording`, `RunStatus`)
- **Constants:** SCREAMING_SNAKE_CASE (`API_BASE_URL`)
- **CSS Classes:** kebab-case via Tailwind

### File Naming

- **Components:** `ComponentName.tsx`
- **Pages:** `page.tsx` (Next.js convention)
- **Layouts:** `layout.tsx` (Next.js convention)
- **Hooks:** `useHookName.ts`
- **Types:** `typeName.ts` or grouped in `types/`
- **Tests:** `ComponentName.test.tsx`

---

## Environment Variables

```bash
# .env.local (development)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=SaveAction

# .env.production
NEXT_PUBLIC_API_URL=https://api.saveaction.example.com
NEXT_PUBLIC_APP_NAME=SaveAction
```

---

## Checklist for New Pages

- [ ] Page component created in correct route
- [ ] Loading skeleton implemented
- [ ] Error state handled
- [ ] Empty state designed
- [ ] Mobile responsive
- [ ] Dark mode tested
- [ ] Keyboard navigation works
- [ ] Page title set (metadata)
- [ ] Breadcrumb updated (if applicable)
- [ ] Toast notifications for actions
- [ ] Optimistic updates (where appropriate)

---

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [React Query Docs](https://tanstack.com/query/latest)
- [React Hook Form](https://react-hook-form.com/)
- [Lucide Icons](https://lucide.dev/icons/)
