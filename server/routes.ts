import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import apiRoutes from "./routes/index";
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

  app.use("/api", apiRoutes);

  app.use("/api/*", notFoundHandler);

  app.use(errorHandler);

  return httpServer;
}
