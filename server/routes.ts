import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
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
