import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import apiRoutes from "./routes/index";
import claimRoutes from "./routes/claim.routes";
import { 
  errorHandler, 
  notFoundHandler, 
  requestIdMiddleware 
} from "./middleware";
import { config } from "./config";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(morgan("combined", {
    skip: (req) => req.path === "/api/health/live",
  }));

  app.use(cors({
    origin: config.cors.origins,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
  }));

  app.use(requestIdMiddleware);

  app.get("/api", (_req, res) => {
    res.status(200).json({
      status: "UP",
      service: "Phygital Loyalty Orchestrator",
      version: config.server.apiVersion,
      timestamp: new Date().toISOString(),
      endpoints: {
        pos: "/api/pos/action",
        health: "/api/health",
        loyalty: "/api/loyalty",
        wallet: "/api/wallet",
        mail: "/api/mail",
        claim: "/claim/:id",
      },
    });
  });

  app.use("/api", apiRoutes);

  app.use("/claim", claimRoutes);

  app.use("/api/*", notFoundHandler);

  app.use(errorHandler);

  return httpServer;
}
