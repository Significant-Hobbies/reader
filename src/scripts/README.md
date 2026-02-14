# Migration Scripts

This directory contains database migration scripts for the Web Annotator application.

## migrate-projects-to-lists.ts

Migrates the legacy project-based system to the new list-based system.

### What it does

1. **Fetches all users** with projects from the database
2. **For each user:**
   - Creates default lists (Favourites and Read Later) using `ensureDefaultLists`
   - Converts existing custom projects to custom lists
   - Skips "Default" projects (format: `{userId}_default`)
   - Creates a mapping of `projectId` -> `listId`
3. **Updates all articles:**
   - Populates the new `listIds` field based on their `projectId`
   - Keeps the `projectId` field for rollback safety
   - Articles in default projects get empty `listIds` arrays
   - Articles in custom projects get mapped to corresponding custom lists
4. **Uses Firestore batching** for efficiency (max 500 operations per batch)

### Prerequisites

- Node.js 18+ installed
- Firebase Admin credentials configured (via `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable)
- `tsx` installed (already in package.json dev dependencies)

### Usage

#### Dry-run mode (recommended first)

Test the migration without making any changes:

```bash
npx tsx src/scripts/migrate-projects-to-lists.ts --dry-run
```

This will show you what changes would be made without actually modifying the database.

#### Production run

Apply the migration:

```bash
npx tsx src/scripts/migrate-projects-to-lists.ts
```

### Environment Setup

The script requires Firebase Admin credentials. Set up your environment:

```bash
# Development (.env.local)
FIREBASE_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-json>
```

Or export the variable before running:

```bash
export FIREBASE_SERVICE_ACCOUNT_KEY="<base64-encoded-service-account-json>"
npx tsx src/scripts/migrate-projects-to-lists.ts --dry-run
```

### Safety Features

- **Dry-run mode**: Test without making changes
- **Preserves projectId**: Original `projectId` field is kept for rollback
- **Batching**: Uses Firestore batches to avoid timeout issues
- **Error handling**: Continues processing other users if one fails
- **Detailed logging**: Shows progress and statistics
- **Skip duplicates**: Won't re-migrate articles that already have `listIds`

### Migration Logic

#### Projects → Lists Conversion

| Original Project Type                | Action  | Result                  |
| ------------------------------------ | ------- | ----------------------- |
| Default project (`{userId}_default`) | Skip    | Not converted to list   |
| Custom project (user-created)        | Convert | New custom list created |

#### Articles → Lists Assignment

| Article's projectId | listIds Result            |
| ------------------- | ------------------------- |
| Default project     | `[]` (empty array)        |
| Custom project      | `[corresponding-list-id]` |
| Unknown project     | `[]` (logged as warning)  |
| Already has listIds | Skipped (no change)       |

### Output

The script provides detailed statistics:

```
📊 Migration Statistics
==========================================
Users processed:           5/5
Projects converted:        12
Default projects skipped:  5
Articles updated:          147
Batches committed:         1
Errors:                    0
```

### Verification Steps

After running the migration:

1. **Check user accounts**: Verify that users have their lists created
2. **Check articles**: Verify that articles have correct `listIds`
3. **Test the application**: Ensure the list-based UI works correctly
4. **Monitor for issues**: Watch for any unexpected behavior

### Rollback

If you need to rollback:

1. The `projectId` field is preserved on all articles
2. You can clear the `listIds` field and restore project-based functionality
3. Delete the created lists from the `lists` collection

### Troubleshooting

**Error: Missing FIREBASE_SERVICE_ACCOUNT_KEY**

- Set the environment variable before running the script
- Ensure the base64-encoded JSON is valid

**Error: Permission denied**

- Verify your Firebase service account has read/write permissions
- Check Firestore security rules allow admin access

**Script hangs or times out**

- Check Firestore connection
- Reduce batch size if needed (edit line 187: `if (operationCount >= 250)`)
- Run on smaller user sets by modifying the script

**Articles not appearing in lists**

- Verify the `listIds` field was populated correctly
- Check that default lists were created for each user
- Ensure the list IDs match between articles and lists collection

### Technical Details

- **Batch size**: 500 operations (Firestore limit)
- **Collections affected**: `projects`, `lists`, `annotations`
- **Fields modified**: `annotations.listIds`, `annotations.updatedAt`
- **Fields preserved**: `annotations.projectId`
- **New lists created**: 2 per user (Favourites, Read Later) + N custom lists

### Post-Migration Cleanup (Optional)

Once you've verified the migration and the app is working correctly with lists:

1. **Remove projectId field** from articles (optional, for cleanup)
2. **Delete projects collection** (optional, for cleanup)
3. **Remove project-related code** from the application
4. **Update API endpoints** to remove project support

**Note**: Keep the `projectId` field for at least a few weeks to allow for easy rollback if needed.
