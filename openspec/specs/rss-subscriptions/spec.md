# rss-subscriptions Specification

## Purpose
TBD - created by archiving change add-rss-reader. Update Purpose after archive.
## Requirements
### Requirement: Authenticated subscription management
The system SHALL allow an authenticated user to list, add, and remove only their own RSS or Atom subscriptions, and SHALL reject unsupported or unsafe feed URLs.

#### Scenario: Add a subscription
- **WHEN** an authenticated user submits a valid HTTP(S) feed URL with optional title and site URL
- **THEN** the system stores one user-owned subscription and returns it

#### Scenario: Add a duplicate subscription
- **WHEN** the same user submits a feed URL they already follow
- **THEN** the system returns the existing subscription without creating a duplicate

#### Scenario: Remove a subscription
- **WHEN** an authenticated user removes one of their subscriptions
- **THEN** the subscription and its feed entries are removed without affecting another user's data

#### Scenario: Reject an unsafe feed URL
- **WHEN** a user submits a non-HTTP(S), private-network, loopback, or metadata-service destination
- **THEN** the system rejects the subscription without fetching or persisting it

### Requirement: OPML import
The system SHALL import RSS and Atom subscriptions from a valid OPML document, recursively discovering outlines with `xmlUrl` and deduplicating subscriptions for the current user.

#### Scenario: Import the supplied OPML shape
- **WHEN** an authenticated user imports an OPML document containing a named group with feed outlines
- **THEN** the system imports each valid feed with its title, feed URL, and optional site URL and reports imported, existing, and rejected counts

#### Scenario: Re-import the same OPML
- **WHEN** the user imports an OPML document whose feeds are already subscribed
- **THEN** no duplicate subscriptions are created and the response reports them as existing

#### Scenario: Reject invalid OPML
- **WHEN** the uploaded text is oversized, malformed, or contains no valid feed outlines
- **THEN** the system returns a validation error without changing subscriptions

