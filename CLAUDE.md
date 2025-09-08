- its npm start

# Data Architecture & Caching Strategy

## Core Principle: Database as Single Source of Truth

The application follows a **cache-first, database-authoritative** architecture:

### Caching Strategy Rules:
1. **Database is the single source of truth** - all data originates from DB
2. **Cache-first reads** - always check cache before hitting database
3. **Database-first writes** - always save to DB first, then update cache
4. **Cache serves performance** - cache is purely for speed, not data storage

### Implementation Pattern:
```
Read Flow:
1. Check cache first (cache hit = return immediately)
2. If cache miss → fetch from database  
3. Update cache with fresh data
4. Return data to user

Write Flow:  
1. Save to database first
2. If DB save succeeds → update cache
3. If DB save fails → don't update cache
```

### DataLoaderService Pattern:
- **ALL data operations** must go through DataLoaderService
- **NEVER bypass** DataLoaderService to access Supabase directly
- DataLoaderService handles cache-first logic automatically
- API handlers should call DataLoaderService, not Supabase directly

### Pagination Caching:
- Cache accumulates pages as user navigates
- Cache hit: serve from memory (no DB call)
- Cache miss: fetch from DB + expand cache
- Example: Page1→DB call, Page2→DB call, Back to Page1→cache hit ✅

### Critical: Always Follow This Pattern
When implementing any data fetching:
1. Check if DataLoaderService has the method you need
2. If not, add method to DataLoaderService (don't bypass it)
3. DataLoaderService method should implement cache-first logic
4. API handlers call DataLoaderService, never Supabase directly

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.