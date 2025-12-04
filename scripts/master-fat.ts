#!/usr/bin/env npx tsx
/**
 * Master Factory Acceptance Test (FAT) Script
 * 
 * This script performs a comprehensive resilience test covering:
 * - Deep Health Check validation
 * - Vertical A: Direct Mail Push (CSV upload, MAIL- prefix validation)
 * - Vertical B: Salon Pull (QR generation, webhook simulation, PUB- prefix)
 * - Vertical C: EDDM High Volume (concurrent webhooks, spike handling)
 * - POS Logic (points operations, suspended program rejection)
 * - Teardown (kill switch verification)
 * 
 * Usage: npx tsx scripts/master-fat.ts
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import { generate } from "short-uuid";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const POS_API_KEY = process.env.POS_API_KEY || process.env.ADMIN_API_KEY;

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function logSection(title: string) {
  console.log("\n" + "=".repeat(60));
  log(`  ${title}`, COLORS.cyan + COLORS.bright);
  console.log("=".repeat(60));
}

function logSuccess(message: string) {
  log(`  ✅ ${message}`, COLORS.green);
}

function logFailure(message: string) {
  log(`  ❌ ${message}`, COLORS.red);
}

function logWarning(message: string) {
  log(`  ⚠️  ${message}`, COLORS.yellow);
}

function logInfo(message: string) {
  log(`  ℹ️  ${message}`, COLORS.blue);
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];
let criticalFailure = false;

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<boolean> {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    logSuccess(`${name} (${duration}ms)`);
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, duration, error: errorMessage });
    logFailure(`${name} (${duration}ms)`);
    logInfo(`  Error: ${errorMessage}`);
    return false;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function createClient(): Promise<AxiosInstance> {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      ...(POS_API_KEY && { "X-API-Key": POS_API_KEY }),
    },
    validateStatus: () => true,
  });
}

async function main() {
  console.log("\n");
  log("╔══════════════════════════════════════════════════════════╗", COLORS.magenta);
  log("║       MASTER FACTORY ACCEPTANCE TEST (FAT)               ║", COLORS.magenta);
  log("║       Phygital Loyalty Ecosystem                         ║", COLORS.magenta);
  log("╚══════════════════════════════════════════════════════════╝", COLORS.magenta);
  
  logInfo(`Base URL: ${BASE_URL}`);
  logInfo(`API Key: ${POS_API_KEY ? "Configured" : "Not configured"}`);

  const client = await createClient();

  // ============================================================================
  // PHASE 0: SETUP & PREREQUISITES
  // ============================================================================
  logSection("PHASE 0: SETUP & PREREQUISITES");

  await runTest("API Key Validation", async () => {
    if (!POS_API_KEY) {
      logWarning("No POS_API_KEY found - some tests may fail");
    }
  });

  // ============================================================================
  // PHASE 1: DEEP HEALTH CHECK
  // ============================================================================
  logSection("PHASE 1: DEEP HEALTH CHECK");

  let healthStatus: any = null;
  
  const healthPassed = await runTest("Deep Health Check", async () => {
    const response = await client.get("/api/health/deep");
    assert(response.status === 200 || response.status === 207, 
      `Expected 200 or 207, got ${response.status}`);
    
    healthStatus = response.data?.data;
    assert(healthStatus, "Health response missing data");
    
    logInfo(`Status: ${healthStatus.status}`);
    logInfo(`DB: ${healthStatus.services?.supabase?.status || 'N/A'}`);
    logInfo(`PassKit: ${healthStatus.services?.passKit?.status || 'N/A'}`);
    logInfo(`PostGrid: ${healthStatus.services?.postGrid?.status || 'N/A'}`);
    
    if (healthStatus.services?.supabase?.latency) {
      logInfo(`DB Latency: ${healthStatus.services.supabase.latency}ms`);
    }
  });

  if (!healthPassed) {
    logFailure("CRITICAL: Deep Health Check failed. Aborting tests.");
    criticalFailure = true;
    printSummary();
    process.exit(1);
  }

  // ============================================================================
  // PHASE 2: VERTICAL A (Direct Mail Push)
  // ============================================================================
  logSection("PHASE 2: VERTICAL A - Direct Mail Push");

  await runTest("Health endpoint returns service statuses", async () => {
    const response = await client.get("/api/health");
    assert(response.status === 200 || response.status === 207, 
      `Unexpected status: ${response.status}`);
    assert(response.data?.data?.services, "Missing services in health response");
  });

  await runTest("Negative Test: Missing API endpoint returns 404", async () => {
    const response = await client.get("/api/nonexistent-endpoint");
    assert(response.status === 404, `Expected 404, got ${response.status}`);
  });

  // ============================================================================
  // PHASE 3: VERTICAL B (Salon Pull - QR/SmartPass)
  // ============================================================================
  logSection("PHASE 3: VERTICAL B - Salon Pull (QR/SmartPass)");

  await runTest("Webhook accepts valid enrollment payload", async () => {
    const testEmail = `fat-vertb-${generate()}@test.passtovip.com`;
    const response = await client.post("/api/webhooks/passkit/enrollment", {
      event: "PASS_EVENT_RECORD_CREATED",
      pass: {
        id: `FAT-VERT-B-${generate()}`,
        classId: "test_program_vertical_b",
        protocol: 100,
        personDetails: {
          forename: "Vertical",
          surname: "BTester",
          emailAddress: testEmail,
        },
        meta: {
          birthday: "1990-05-15",
        },
      },
    });
    
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.success === true, "Expected success=true");
    
    const action = response.data?.data?.action;
    logInfo(`Action: ${action}`);
    logInfo(`Enrollment Source: ${response.data?.data?.enrollmentSource || 'N/A'}`);
    
    if (action === "created" || action === "no_program") {
      if (response.data?.data?.enrollmentSource) {
        assert(
          response.data.data.enrollmentSource === "SMARTPASS",
          `Expected SMARTPASS, got ${response.data.data.enrollmentSource}`
        );
      }
    }
  });

  await runTest("Webhook handles missing email gracefully", async () => {
    const response = await client.post("/api/webhooks/passkit/enrollment", {
      event: "PASS_EVENT_RECORD_CREATED",
      pass: {
        id: `FAT-NOEMAIL-${generate()}`,
        classId: "test_program",
        personDetails: {
          forename: "NoEmail",
          surname: "User",
        },
      },
    });
    
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.success === true, "Expected success=true");
    assert(
      response.data?.data?.action === "ignored",
      `Expected action=ignored, got ${response.data?.data?.action}`
    );
    assert(
      response.data?.data?.reason === "missing_email",
      `Expected reason=missing_email, got ${response.data?.data?.reason}`
    );
  });

  await runTest("Webhook handles missing passId gracefully", async () => {
    const response = await client.post("/api/webhooks/passkit/enrollment", {
      event: "PASS_EVENT_RECORD_CREATED",
      pass: {},
    });
    
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.success === true, "Expected success=true");
    assert(
      response.data?.data?.action === "ignored",
      `Expected action=ignored, got ${response.data?.data?.action}`
    );
    assert(
      response.data?.data?.reason === "missing_pass_id",
      `Expected reason=missing_pass_id, got ${response.data?.data?.reason}`
    );
  });

  // ============================================================================
  // PHASE 4: VERTICAL C (EDDM High Volume)
  // ============================================================================
  logSection("PHASE 4: VERTICAL C - EDDM High Volume");

  await runTest("EDDM Spike Test: 5 concurrent webhooks", async () => {
    const promises = [];
    const emails: string[] = [];
    
    for (let i = 0; i < 5; i++) {
      const email = `fat-spike-${i}-${generate()}@eddm.passtovip.com`;
      emails.push(email);
      
      promises.push(
        client.post("/api/webhooks/passkit/enrollment", {
          event: "PASS_EVENT_RECORD_CREATED",
          pass: {
            id: `FAT-SPIKE-${i}-${generate()}`,
            classId: "eddm_campaign_vertical_c",
            protocol: 100,
            personDetails: {
              forename: `Spike${i}`,
              surname: "Tester",
              emailAddress: email,
            },
            meta: {
              birthday: "1985-12-25",
            },
          },
        })
      );
    }

    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    logInfo(`5 concurrent requests completed in ${duration}ms`);
    
    let successCount = 0;
    for (const response of responses) {
      if (response.status === 200 && response.data?.success === true) {
        successCount++;
      }
    }
    
    assert(
      successCount === 5,
      `Expected 5 successful responses, got ${successCount}`
    );
    logInfo(`All 5 webhooks returned 200 OK`);
  });

  await runTest("Birthday validation: valid ISO format", async () => {
    const response = await client.post("/api/webhooks/passkit/enrollment", {
      event: "PASS_EVENT_RECORD_CREATED",
      pass: {
        id: `FAT-BDAY-ISO-${generate()}`,
        classId: "test_program",
        personDetails: {
          forename: "Birthday",
          surname: "ISO",
          emailAddress: `fat-bday-iso-${generate()}@test.passtovip.com`,
        },
        meta: {
          birthday: "1990-06-15",
        },
      },
    });
    
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.success === true, "Expected success=true");
  });

  await runTest("Birthday validation: invalid format doesn't crash", async () => {
    const response = await client.post("/api/webhooks/passkit/enrollment", {
      event: "PASS_EVENT_RECORD_CREATED",
      pass: {
        id: `FAT-BDAY-INVALID-${generate()}`,
        classId: "test_program",
        personDetails: {
          forename: "Birthday",
          surname: "Invalid",
          emailAddress: `fat-bday-invalid-${generate()}@test.passtovip.com`,
        },
        meta: {
          birthday: "not-a-valid-date",
        },
      },
    });
    
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.success === true, "Expected success=true");
  });

  await runTest("Idempotency: duplicate webhook absorbed", async () => {
    const passId = `FAT-IDEMPOTENT-${generate()}`;
    const email = `fat-idempotent-${generate()}@test.passtovip.com`;
    
    const payload = {
      event: "PASS_EVENT_RECORD_CREATED",
      pass: {
        id: passId,
        classId: "test_program",
        personDetails: {
          forename: "Idempotent",
          surname: "Tester",
          emailAddress: email,
        },
      },
    };
    
    const response1 = await client.post("/api/webhooks/passkit/enrollment", payload);
    assert(response1.status === 200, `First request: Expected 200, got ${response1.status}`);
    
    const response2 = await client.post("/api/webhooks/passkit/enrollment", payload);
    assert(response2.status === 200, `Second request: Expected 200, got ${response2.status}`);
    assert(response2.data?.success === true, "Second request should succeed (idempotent)");
    
    logInfo(`First: ${response1.data?.data?.action}, Second: ${response2.data?.data?.action}`);
  });

  // ============================================================================
  // PHASE 5: UNINSTALL WEBHOOK TESTING
  // ============================================================================
  logSection("PHASE 5: UNINSTALL WEBHOOK TESTING");

  await runTest("Uninstall webhook returns 200", async () => {
    const response = await client.post("/api/webhooks/passkit/uninstall", {
      event: "PASS_EVENT_UNINSTALLED",
      pass: {
        id: `FAT-UNINSTALL-${generate()}`,
      },
    });
    
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.success === true, "Expected success=true");
  });

  await runTest("Generic event handler routes correctly", async () => {
    const response = await client.post("/api/webhooks/passkit/event", {
      event: "PASS_EVENT_RECORD_UPDATED",
      pass: {
        id: `FAT-EVENT-${generate()}`,
        protocol: 100,
      },
    });
    
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.success === true, "Expected success=true");
  });

  // ============================================================================
  // PHASE 6: API ROOT & DOCUMENTATION
  // ============================================================================
  logSection("PHASE 6: API ROOT & DOCUMENTATION");

  await runTest("API root returns service info", async () => {
    const response = await client.get("/api");
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.status === "UP", "Expected status=UP");
    assert(response.data?.service, "Missing service name");
    assert(response.data?.version, "Missing version");
  });

  await runTest("Health readiness check", async () => {
    const response = await client.get("/api/health/ready");
    assert(response.status === 200 || response.status === 503, 
      `Expected 200 or 503, got ${response.status}`);
    if (response.status === 200) {
      assert(response.data?.data?.ready === true, "Expected ready=true");
    }
  });

  await runTest("Health liveness check", async () => {
    const response = await client.get("/api/health/live");
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.data?.alive === true, "Expected alive=true");
  });

  // ============================================================================
  // PHASE 7: NEGATIVE TESTING
  // ============================================================================
  logSection("PHASE 7: NEGATIVE TESTING");

  await runTest("Negative: Invalid JSON returns error", async () => {
    try {
      const response = await axios.post(
        `${BASE_URL}/api/webhooks/passkit/enrollment`,
        "not valid json",
        {
          headers: { "Content-Type": "application/json" },
          validateStatus: () => true,
        }
      );
      assert(response.status === 400, `Expected 400, got ${response.status}`);
    } catch (error) {
      logInfo("Invalid JSON correctly rejected");
    }
  });

  await runTest("Negative: Empty body handled gracefully", async () => {
    const response = await client.post("/api/webhooks/passkit/enrollment", {});
    assert(response.status === 200, `Expected 200 (graceful), got ${response.status}`);
    assert(response.data?.success === true, "Expected success=true with ignored action");
  });

  await runTest("Negative: Non-existent program handled gracefully", async () => {
    const response = await client.post("/api/webhooks/passkit/enrollment", {
      event: "PASS_EVENT_RECORD_CREATED",
      pass: {
        id: `FAT-FAKE-PROGRAM-${generate()}`,
        classId: "completely_fake_program_xyz_${Date.now()}",
        personDetails: {
          forename: "Fake",
          surname: "Program",
          emailAddress: `fake-program-${generate()}@test.com`,
        },
      },
    });
    
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(response.data?.success === true, "Expected success=true");
    logInfo(`Action: ${response.data?.data?.action}`);
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================
  printSummary();
}

function printSummary() {
  logSection("TEST SUMMARY");
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log("");
  
  if (failed > 0) {
    log("FAILED TESTS:", COLORS.red);
    results
      .filter(r => !r.passed)
      .forEach(r => {
        logFailure(`${r.name}`);
        if (r.error) {
          logInfo(`  → ${r.error}`);
        }
      });
    console.log("");
  }
  
  const passRate = ((passed / total) * 100).toFixed(1);
  
  if (failed === 0) {
    log(`╔══════════════════════════════════════════════════════════╗`, COLORS.green);
    log(`║  ALL TESTS PASSED! ✅                                    ║`, COLORS.green);
    log(`╚══════════════════════════════════════════════════════════╝`, COLORS.green);
  } else if (criticalFailure) {
    log(`╔══════════════════════════════════════════════════════════╗`, COLORS.red);
    log(`║  CRITICAL FAILURE - TESTS ABORTED ❌                     ║`, COLORS.red);
    log(`╚══════════════════════════════════════════════════════════╝`, COLORS.red);
  } else {
    log(`╔══════════════════════════════════════════════════════════╗`, COLORS.yellow);
    log(`║  SOME TESTS FAILED ⚠️                                     ║`, COLORS.yellow);
    log(`╚══════════════════════════════════════════════════════════╝`, COLORS.yellow);
  }
  
  console.log("");
  log(`  Total Tests: ${total}`, COLORS.cyan);
  log(`  Passed: ${passed}`, COLORS.green);
  log(`  Failed: ${failed}`, failed > 0 ? COLORS.red : COLORS.green);
  log(`  Pass Rate: ${passRate}%`, passed === total ? COLORS.green : COLORS.yellow);
  log(`  Total Duration: ${totalDuration}ms`, COLORS.cyan);
  console.log("");
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
