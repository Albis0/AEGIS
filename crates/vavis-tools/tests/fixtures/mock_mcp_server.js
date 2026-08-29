#!/usr/bin/env node
/**
 * A minimal MCP server, used to test the client end to end.
 *
 * Speaks newline-delimited JSON-RPC on stdio, exactly as a real stdio server
 * does: initialize, tools/list, tools/call. It also prints a banner line that
 * is not JSON, because real servers do that and the client must skip it.
 */

// Not JSON: the client has to tolerate it.
process.stdout.write("mock-mcp-server starting\n");

const TOOLS = [
  {
    name: "echo",
    description: "Echoes the text back",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "boom",
    description: "Always reports an error",
    inputSchema: { type: "object", properties: {} },
  },
];

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function handle(request) {
  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "mock", version: "1.0.0" },
        },
      };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };

    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? {};

      if (name === "echo") {
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: `echo: ${args.text}` }] },
        };
      }
      if (name === "boom") {
        return {
          jsonrpc: "2.0",
          id,
          result: { isError: true, content: [{ type: "text", text: "it broke" }] },
        };
      }
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `unknown tool: ${name}` },
      };
    }

    default:
      // Notifications carry no id and expect no reply.
      if (id === undefined) return null;
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `unknown method: ${method}` },
      };
  }
}

let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk.toString();

  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;

    let request;
    try {
      request = JSON.parse(line);
    } catch {
      continue;
    }

    const response = handle(request);
    if (response) send(response);
  }
});

process.stdin.on("end", () => process.exit(0));
