## ADDED Requirements

### Requirement: RSS and Atom normalization
The system SHALL fetch and normalize common RSS 2.0 and Atom feeds into feed entries containing a stable external ID, title, canonical URL when present, author when present, sanitized content or excerpt, and publication timestamp when present.

#### Scenario: Refresh an RSS 2.0 feed
- **WHEN** a subscribed RSS 2.0 feed returns valid XML items
- **THEN** the system persists normalized entries using GUID or a deterministic fallback as the external ID

#### Scenario: Refresh an Atom feed
- **WHEN** a subscribed Atom feed returns valid XML entries
- **THEN** the system resolves alternate links and persists normalized entries using Atom IDs or a deterministic fallback

#### Scenario: Refresh the same content twice
- **WHEN** a feed is refreshed more than once with unchanged items
- **THEN** each logical entry exists once and the second refresh reports no newly inserted entries

### Requirement: Safe partial refresh
The system SHALL allow an authenticated user to refresh one or all owned feeds with bounded network and parsing work, and SHALL report success or failure for each feed independently.

#### Scenario: One feed fails during refresh-all
- **WHEN** one subscribed feed times out or returns malformed XML while other feeds succeed
- **THEN** successful feed entries are persisted and the response includes an error for the failed feed

#### Scenario: Feed exceeds resource limits
- **WHEN** a feed response exceeds the configured size or item cap
- **THEN** the system stops bounded work, records or returns a useful feed error, and remains available to refresh other feeds

#### Scenario: Unauthenticated refresh
- **WHEN** a request without an authenticated user attempts to refresh feeds
- **THEN** the system returns unauthorized and performs no feed fetches
