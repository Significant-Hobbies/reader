# Surfaces

| Surface | Path | Access |
| --- | --- | --- |
| Landing | `/` | Public |
| Link inbox | `/library` | Signed-in account |
| Connections | `/extension` | Account keys; public sign-in prompt |
| Sign-in | `/login` | Public |
| Privacy | `/privacy` | Public |
| MCP | `/api/mcp` | OAuth for private tools |
| OAuth resource metadata | `/.well-known/oauth-protected-resource/api/mcp` | Public when configured |

Public product information is also available as Markdown and through the existing `/api/ai` discovery catalog. These public surfaces never expose account links.

See [project status](../../PROJECT_STATUS.md) for deployment readiness and [architecture](../architecture/overview.md) for MCP setup.
