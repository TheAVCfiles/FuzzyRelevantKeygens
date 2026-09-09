import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader("X-Request-Id", String(req.id));
  next();
});

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "100kb",
  parameterLimit: 100,
}));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof error === "object" && error !== null &&
    "status" in error && typeof error.status === "number"
    ? error.status
    : 500;
  const errorType = typeof error === "object" && error !== null &&
    "type" in error && typeof error.type === "string"
    ? error.type
    : undefined;
  const statusCode = status >= 400 && status < 600 ? status : 500;

  req.log.error({ statusCode, errorType }, "Request failed");
  if (res.headersSent) {
    res.destroy();
    return;
  }

  const message = statusCode === 413
    ? "Request body exceeds the allowed size."
    : statusCode >= 400 && statusCode < 500
    ? "Invalid request."
    : "Internal server error.";
  res.status(statusCode).json({ error: message });
});

export default app;
