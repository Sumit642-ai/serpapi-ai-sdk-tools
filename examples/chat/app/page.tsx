"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { useState } from "react";

import {
  ResultCards,
  isFailure,
  readToolOutput,
  type ToolSuccess,
} from "@/components/result-cards";
import { ToolActivity } from "@/components/tool-activity";

/**
 * One prompt per tool, so every engine can be demonstrated in a few clicks.
 * The dated ones are deliberately vague — the model has to work out real
 * YYYY-MM-DD dates before the tools will accept them.
 */
const EXAMPLE_PROMPTS = [
  "Flights from Delhi to Goa next Friday",
  "Cafes near Connaught Place",
  "Best budget earbuds prices in India",
  "Latest ISRO news",
  "Hotels in Jaipur this weekend",
];

export default function ChatPage() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");

  const busy = status !== "ready" && status !== "error";

  function send(text: string) {
    const trimmed = text.trim();
    if (trimmed === "" || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <>
      <div className="page">
        <header className="header">
          <h1>SerpApi tools for the Vercel AI SDK</h1>
          <p>
            Live Google results through <code>serpapi-ai-sdk-tools</code> — web, news, maps,
            shopping, flights and hotels.
          </p>
        </header>

        <div className="examples">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              className="example"
              key={prompt}
              onClick={() => send(prompt)}
              disabled={busy}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="messages">
          {messages.length === 0 ? (
            <p className="empty">Pick an example above, or ask anything that needs live data.</p>
          ) : null}

          {messages.map((message) => (
            <div className={`message ${message.role}`} key={message.id}>
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return message.role === "user" ? (
                    <div className="bubble" key={index}>
                      {part.text}
                    </div>
                  ) : (
                    <div className="assistant-text" key={index}>
                      {part.text}
                    </div>
                  );
                }

                // Any of the six search tools. `isToolUIPart` keeps this generic
                // instead of matching six literal "tool-<name>" strings.
                if (isToolUIPart(part)) {
                  const toolName = getToolName(part);
                  const inputParams = part.input as Record<string, string> | undefined;

                  if (part.state === "input-streaming" || part.state === "input-available") {
                    return (
                      <ToolActivity
                        key={index}
                        toolName={toolName}
                        params={inputParams}
                        status="running"
                      />
                    );
                  }

                  if (part.state === "output-error") {
                    return (
                      <div key={index}>
                        <ToolActivity toolName={toolName} params={inputParams} status="failed" />
                        <p className="error">{part.errorText}</p>
                      </div>
                    );
                  }

                  if (part.state === "output-available") {
                    const output = readToolOutput(part.output);

                    // A tool that reports a problem returns { error }, not a
                    // thrown exception, so it lands here rather than above.
                    if (output === undefined || isFailure(output)) {
                      return (
                        <div key={index}>
                          <ToolActivity toolName={toolName} params={inputParams} status="failed" />
                          <p className="error">{output?.error ?? "Unexpected tool output."}</p>
                        </div>
                      );
                    }

                    const success = output as ToolSuccess;
                    return (
                      <div key={index}>
                        <ToolActivity
                          toolName={toolName}
                          engine={success.engine}
                          params={success.params}
                          status="done"
                        />
                        <ResultCards toolName={toolName} output={success} />
                      </div>
                    );
                  }
                }

                return null;
              })}
            </div>
          ))}

          {status === "error" ? (
            <p className="error">
              Something went wrong. Check that GOOGLE_GENERATIVE_AI_API_KEY and SERPAPI_API_KEY are
              set in the .env at the repository root, then try again.
            </p>
          ) : null}
        </div>
      </div>

      <div className="composer">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about flights, hotels, places, prices or news…"
            disabled={busy}
          />
          <button type="submit" disabled={busy || input.trim() === ""}>
            {busy ? "…" : "Send"}
          </button>
        </form>
      </div>
    </>
  );
}
