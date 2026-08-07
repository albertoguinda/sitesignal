import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import { apiRouter } from "../routes";
import { authenticate } from "../middleware/auth";
import { HttpError } from "../http/validation";
import type { ApiError } from "../../shared/types";

// Mock the database queries
vi.mock("../db/queries", () => {
  const mockAlerts = [
    { id: 1, assetId: 1, severity: "high", message: "Alert 1", state: "open", assetName: "Asset 1", siteName: "Site 1" },
    { id: 2, assetId: 2, severity: "medium", message: "Alert 2", state: "ack", assetName: "Asset 2", siteName: "Site 1" },
  ];

  return {
    getOverviewKpis: vi.fn().mockResolvedValue({
      assetsTotal: 10,
      assetsOk: 8,
      assetsWarning: 1,
      assetsCritical: 1,
      openAlerts: 2,
      ackAlerts: 1,
      resolvedAlerts: 5,
      healthScore: 75,
      readingsLast24h: 1000,
      averages: [
        { type: "temperature", avg: 22.5 },
        { type: "pressure", avg: 101.3 },
      ],
    }),
    listAssetRows: vi.fn().mockResolvedValue([
      { id: 1, siteId: 1, name: "Asset 1", type: "pump", status: "ok" },
      { id: 2, siteId: 1, name: "Asset 2", type: "valve", status: "warning" },
    ]),
    listAlerts: vi.fn().mockImplementation(({ state, limit }) => {
      let filtered = [...mockAlerts];
      if (state) {
        filtered = filtered.filter((a) => a.state === state);
      }
      if (limit) {
        filtered = filtered.slice(0, limit);
      }
      return Promise.resolve(filtered);
    }),
    listSites: vi.fn().mockResolvedValue([
      { id: 1, name: "Site 1", lat: 40.7128, lng: -74.006, timezone: "America/New_York" },
      { id: 2, name: "Site 2", lat: 34.0522, lng: -118.2437, timezone: "America/Los_Angeles" },
    ]),
  };
});

vi.mock("../services/weather", () => ({
  getAmbientForSites: vi.fn().mockResolvedValue([
    { siteId: 1, temperature: 25, humidity: 60 },
    { siteId: 2, temperature: 28, humidity: 55 },
  ]),
}));

// Create test app with mocked dependencies
function createTestApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));
  app.use(authenticate);
  app.use("/api", apiRouter);

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      const body: ApiError = { error: error.message, ...(error.detail && { detail: error.detail }) };
      res.status(error.status).json(body);
      return;
    }
    if (error instanceof ZodError) {
      const messages = error.issues.map((i) => i.message).join(", ");
      const body: ApiError = { error: messages };
      res.status(400).json(body);
      return;
    }
    console.error("[test] unhandled error:", error);
    const body: ApiError = { error: "Internal server error" };
    res.status(500).json(body);
  });

  return app;
}

const app = createTestApp();

describe("Overview Endpoints", () => {
  describe("GET /api/overview", () => {
    it("returns overview data", async () => {
      const response = await request(app)
        .get("/api/overview")
        .expect(200);

      expect(response.body).toHaveProperty("kpis");
      expect(response.body).toHaveProperty("assets");
      expect(response.body).toHaveProperty("recentAlerts");
      expect(response.body).toHaveProperty("ambient");
    });

    it("returns overview with siteId filter", async () => {
      const response = await request(app)
        .get("/api/overview?siteId=1")
        .expect(200);

      expect(response.body).toHaveProperty("kpis");
      expect(response.body).toHaveProperty("assets");
    });

    it("returns valid KPIs structure", async () => {
      const response = await request(app)
        .get("/api/overview")
        .expect(200);

      const { kpis } = response.body;
      expect(kpis).toHaveProperty("assetsTotal");
      expect(kpis).toHaveProperty("assetsOk");
      expect(kpis).toHaveProperty("assetsWarning");
      expect(kpis).toHaveProperty("assetsCritical");
      expect(kpis).toHaveProperty("openAlerts");
      expect(kpis).toHaveProperty("ackAlerts");
      expect(kpis).toHaveProperty("resolvedAlerts");
      expect(kpis).toHaveProperty("healthScore");
      expect(kpis).toHaveProperty("readingsLast24h");
      expect(kpis).toHaveProperty("averages");
      expect(Array.isArray(kpis.averages)).toBe(true);
    });

    it("returns valid assets array", async () => {
      const response = await request(app)
        .get("/api/overview")
        .expect(200);

      const { assets } = response.body;
      expect(Array.isArray(assets)).toBe(true);
      
      if (assets.length > 0) {
        const asset = assets[0];
        expect(asset).toHaveProperty("id");
        expect(asset).toHaveProperty("siteId");
        expect(asset).toHaveProperty("name");
        expect(asset).toHaveProperty("type");
        expect(asset).toHaveProperty("status");
      }
    });

    it("returns valid recentAlerts array", async () => {
      const response = await request(app)
        .get("/api/overview")
        .expect(200);

      const { recentAlerts } = response.body;
      expect(Array.isArray(recentAlerts)).toBe(true);
      
      if (recentAlerts.length > 0) {
        const alert = recentAlerts[0];
        expect(alert).toHaveProperty("id");
        expect(alert).toHaveProperty("assetId");
        expect(alert).toHaveProperty("severity");
        expect(alert).toHaveProperty("message");
        expect(alert).toHaveProperty("state");
      }
    });
  });

  describe("GET /api/sites", () => {
    it("returns sites list", async () => {
      const response = await request(app)
        .get("/api/sites")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const site = response.body[0];
        expect(site).toHaveProperty("id");
        expect(site).toHaveProperty("name");
        expect(site).toHaveProperty("lat");
        expect(site).toHaveProperty("lng");
        expect(site).toHaveProperty("timezone");
      }
    });
  });

  describe("GET /api/alerts", () => {
    it("returns alerts list", async () => {
      const response = await request(app)
        .get("/api/alerts")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const alert = response.body[0];
        expect(alert).toHaveProperty("id");
        expect(alert).toHaveProperty("assetId");
        expect(alert).toHaveProperty("severity");
        expect(alert).toHaveProperty("message");
        expect(alert).toHaveProperty("state");
        expect(alert).toHaveProperty("assetName");
        expect(alert).toHaveProperty("siteName");
      }
    });

    it("returns alerts with state filter", async () => {
      const response = await request(app)
        .get("/api/alerts?state=open")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      response.body.forEach((alert: any) => {
        expect(alert.state).toBe("open");
      });
    });

    it("returns alerts with limit", async () => {
      const response = await request(app)
        .get("/api/alerts?limit=5")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe("GET /api/assets", () => {
    it("returns assets list", async () => {
      const response = await request(app)
        .get("/api/assets")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const asset = response.body[0];
        expect(asset).toHaveProperty("id");
        expect(asset).toHaveProperty("siteId");
        expect(asset).toHaveProperty("name");
        expect(asset).toHaveProperty("type");
        expect(asset).toHaveProperty("status");
      }
    });
  });

  describe("404 handling", () => {
    it("returns 404 for unknown API routes", async () => {
      const response = await request(app)
        .get("/api/nonexistent")
        .expect(404);

      expect(response.status).toBe(404);
    });
  });
});
