# rss-inbox Specification

## Purpose
TBD - created by archiving change add-rss-reader. Update Purpose after archive.
## Requirements
### Requirement: Feed inbox
The system SHALL provide an authenticated RSS page that lists normalized entries newest first and allows filtering by subscription and by unread or all state.

#### Scenario: View unread entries
- **WHEN** a user opens the RSS page with unread selected
- **THEN** the page shows only the user's unread entries in reverse chronological order with source, title, date, and excerpt

#### Scenario: Filter by feed
- **WHEN** a user selects a subscription
- **THEN** the entry list and unread count reflect only that feed

#### Scenario: Empty inbox
- **WHEN** the user has no subscriptions or no matching entries
- **THEN** the page shows a clear empty state with an OPML import or refresh action as appropriate

### Requirement: Entry state
The system SHALL let a user mark owned entries read or unread, and opening an entry SHALL mark it read before navigating to its canonical URL.

#### Scenario: Open an unread entry
- **WHEN** a user opens an unread entry with a canonical URL
- **THEN** the entry is marked read and the original page opens in a new browser tab

#### Scenario: Toggle read state
- **WHEN** a user explicitly marks an owned entry read or unread
- **THEN** its state and visible unread counts update without a full page reload

### Requirement: Save entry to library
The system SHALL allow a user to save an owned feed entry to the existing article library exactly once.

#### Scenario: Save an entry with content
- **WHEN** a user saves a feed entry that contains usable HTML content
- **THEN** the system creates or reuses an article record with the entry URL, title, author, and sanitized content and links it to the entry

#### Scenario: Save an entry without content
- **WHEN** a user saves a feed entry that has only a title and URL
- **THEN** the system creates or reuses a link-type article and links it to the entry

#### Scenario: Save an already saved entry
- **WHEN** a user saves an entry already linked to an article
- **THEN** the system returns the existing article ID without creating another article

