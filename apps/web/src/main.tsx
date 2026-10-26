import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HttpError } from "./api/client";
import { currentUserKey } from "./hooks/useAuth";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof HttpError && error.status === 401) {
        queryClient.setQueryData(currentUserKey, null);
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: (failureCount, error) => {
        if (error instanceof HttpError && error.status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ReactQueryDevtools />
    </QueryClientProvider>
  </StrictMode>
);