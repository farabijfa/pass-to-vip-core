import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import apiRoutes from "./routes/index";
import claimRoutes from "./routes/claim.routes";
import { 
  errorHandler, 
  notFoundHandler, 
  requestIdMiddleware,
  basicAuth 
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

  app.get("/admin/campaign", basicAuth, (_req, res) => {
    const adminPath = path.join(process.cwd(), "public", "admin.html");
    if (fs.existsSync(adminPath)) {
      res.sendFile(adminPath);
    } else {
      res.status(404).send("Admin page not found");
    }
  });

  app.get("/admin.html", basicAuth, (_req, res) => {
    const adminPath = path.join(process.cwd(), "public", "admin.html");
    if (fs.existsSync(adminPath)) {
      res.sendFile(adminPath);
    } else {
      res.status(404).send("Admin page not found");
    }
  });

  app.get("/admin", basicAuth, (_req, res) => {
    const indexPath = path.join(process.cwd(), "public", "admin-index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Admin dashboard not found");
    }
  });

  app.get("/admin/tenants", basicAuth, (_req, res) => {
    const tenantsPath = path.join(process.cwd(), "public", "admin-tenants.html");
    if (fs.existsSync(tenantsPath)) {
      res.sendFile(tenantsPath);
    } else {
      res.status(404).send("Tenants page not found");
    }
  });

  app.get("/admin/provision", basicAuth, (_req, res) => {
    const provisionPath = path.join(process.cwd(), "public", "admin-provision.html");
    if (fs.existsSync(provisionPath)) {
      res.sendFile(provisionPath);
    } else {
      res.status(404).send("Provision page not found");
    }
  });

  app.get("/admin/qr", basicAuth, (_req, res) => {
    const qrPath = path.join(process.cwd(), "public", "admin-qr.html");
    if (fs.existsSync(qrPath)) {
      res.sendFile(qrPath);
    } else {
      res.status(404).send("QR viewer page not found");
    }
  });

  app.use("/api/*", notFoundHandler);

  app.use(errorHandler);

  return httpServer;
}
