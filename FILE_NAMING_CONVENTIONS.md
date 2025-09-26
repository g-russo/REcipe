# File Naming Conventions

This document outlines the consistent **kebab-case** naming convention used throughout the REcipe project for production deployment.

## Universal Naming Convention: kebab-case

**All files and directories use kebab-case** for consistent, URL-friendly, and readable naming.

### App Routes (`/app/`)
- **Convention**: kebab-case
- **Examples**: 
  - `recipe-detail.jsx`
  - `recipe-search.jsx`
  - `force-password-change.jsx`
  - `otp-verification.jsx`
- **Reason**: URL-friendly routing paths

### Components (`/components/`)
- **Convention**: kebab-case
- **Examples**:
  - `auth-event-monitor.jsx`
  - `production-cache-monitor.jsx`
- **Reason**: Consistent naming across project

### Contexts (`/contexts/`)
- **Convention**: kebab-case
- **Examples**:
  - `supabase-context.jsx`
- **Reason**: Consistent naming across project

### Services (`/services/`)
- **Convention**: kebab-case
- **Examples**:
  - `edamam-service.js`
  - `recipe-cache-service.js`
- **Reason**: Clear service identification

### Hooks (`/hooks/`)
- **Convention**: kebab-case
- **Examples**:
  - `use-custom-auth.js`
  - `use-recipes.js`
  - `use-supabase.js`
- **Reason**: Standard hook naming with kebab-case

### Utilities (`/utils/`)
- **Convention**: kebab-case
- **Examples**:
  - `app-initializer.js`
  - `performance-monitor.js`
- **Reason**: Clear utility identification

### Library Files (`/lib/`)
- **Convention**: kebab-case
- **Examples**:
  - `supabase.js` (already kebab-case)
  - `database-setup.js`
  - `database-diagnostic.js`
- **Reason**: Consistent library naming

### Configuration (`/config/`)
- **Convention**: kebab-case
- **Examples**:
  - `app-config.js`
  - `production-config.js`
- **Reason**: Clear configuration identification

### Assets (`/assets/`)
- **Convention**: kebab-case
- **Examples**:
  - `adaptive-icon.png`
  - `splash-icon.png`
- **Reason**: Web-friendly asset naming

## Import Path Examples

### Component Imports
```javascript
// Correct - kebab-case for components
import { AuthEventMonitor } from '../components/auth-event-monitor';
import { ProductionCacheMonitor } from '../components/production-cache-monitor';
```

### Context Imports
```javascript
// Correct - kebab-case for contexts
import { SupabaseProvider } from '../contexts/supabase-context';
```

### Service Imports
```javascript
// Correct - kebab-case for services
import EdamamService from '../services/edamam-service';
import RecipeCacheService from '../services/recipe-cache-service';
```

### Hook Imports
```javascript
// Correct - kebab-case for hooks
import { useCustomAuth } from '../hooks/use-custom-auth';
import { useRecipes } from '../hooks/use-recipes';
```

### Route Imports
```javascript
// Correct - kebab-case for app routes
import RecipeDetail from './recipe-detail';
import RecipeSearch from './recipe-search';
```

## Migration Summary

### All Files Renamed to kebab-case:

**Components:**
1. `AuthEventMonitor.jsx` → `auth-event-monitor.jsx`
2. `ProductionCacheMonitor.jsx` → `production-cache-monitor.jsx`

**Contexts:**
3. `SupabaseContext.jsx` → `supabase-context.jsx`

**Services:**
4. `edamamService.js` → `edamam-service.js`
5. `recipeCacheService.js` → `recipe-cache-service.js`

**Hooks:**
6. `useCustomAuth.js` → `use-custom-auth.js`
7. `useRecipes.js` → `use-recipes.js`
8. `useSupabase.js` → `use-supabase.js`

**Utilities:**
9. `appInitializer.js` → `app-initializer.js`
10. `performanceMonitor.js` → `performance-monitor.js`

**Library:**
11. `databaseDiagnostic.js` → `database-diagnostic.js`
12. `databaseSetup.js` → `database-setup.js`

**Configuration:**
13. `appConfig.js` → `app-config.js`
14. `productionConfig.js` → `production-config.js`

### Updated Import Statements:
- All 25+ import statements across the project updated to use kebab-case paths
- Dynamic imports in `edamam-service.js` updated
- Context providers in layouts updated

## Benefits of kebab-case Convention

1. **URL-Friendly**: Perfect for web deployment and routing
2. **Readable**: Clear separation of words with hyphens
3. **Consistent**: No mixing of camelCase and kebab-case
4. **Standard**: Widely used in web development
5. **Import-Friendly**: Works well with modern bundlers

## Production Readiness
- ✅ All files follow consistent **kebab-case** naming conventions
- ✅ All 25+ import paths updated and verified
- ✅ No compilation errors
- ✅ Expo development server starts successfully
- ✅ Production-optimized cache system implemented
- ✅ Testing files removed for clean deployment
- ✅ **Universal kebab-case naming** for maintainable codebase