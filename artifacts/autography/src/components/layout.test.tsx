import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { Layout } from "./layout";

describe("storage health warning", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const healthResponses = [
      { status: "ok", storage: "degraded" },
      { status: "ok", storage: "healthy" },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/healthz")) {
          return new Response(JSON.stringify(healthResponses.shift() ?? healthResponses.at(-1)), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response("Not needed for this test", { status: 503 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("removes the warning after a healthy poll without leaving the producer page", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Router>
          <Layout>
            <div data-testid="producer-page">Producer workspace</div>
          </Layout>
        </Router>
      </QueryClientProvider>,
    );

    const warning = await screen.findByTestId("storage-degraded-warning");
    expect(warning).toHaveTextContent("Workspace storage needs attention");
    expect(warning).toHaveTextContent(
      "Persistence is temporarily unavailable. New workspace changes may not survive a restart.",
    );
    expect(screen.getByTestId("producer-page")).toBeInTheDocument();

    await queryClient.refetchQueries({ queryKey: ["/api/healthz"] });

    await waitFor(() => {
      expect(screen.queryByTestId("storage-degraded-warning")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("producer-page")).toHaveTextContent("Producer workspace");
  });
});