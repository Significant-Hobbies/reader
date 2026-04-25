// Stub for @libsql/isomorphic-ws for Cloudflare Workers (native WebSocket)
let _WebSocket;
if (typeof WebSocket !== "undefined") {
  _WebSocket = WebSocket;
} else if (typeof global !== "undefined") {
  _WebSocket = global.WebSocket;
} else if (typeof globalThis !== "undefined") {
  _WebSocket = globalThis.WebSocket;
}
export { _WebSocket as WebSocket };
