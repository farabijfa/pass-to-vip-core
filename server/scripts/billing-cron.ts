/**
 * Billing Watchdog Script - Gap G: Revenue Leakage Prevention
 * 
 * This script runs as a scheduled task to:
 * 1. Count active members per program using efficient RPC
 * 2. Check if any programs exceed their member limits
 * 3. Log overage alerts for billing/finance team
 * 4. Save usage snapshots for audit trail
 * 
 * Usage:
 *   npx tsx server/scripts/billing-cron.ts
 * 
 * Automation options:
 *   - Replit Deployments: Use node-cron in server/index.ts
 *   - External: Use cron-job.org to hit /api/admin/trigger-audit (ADMIN_API_KEY protected)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Environment validation
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials");
  console.error("   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Types for the RPC response
interface ProgramUsage {
  program_id: string;
  program_name: string;
  billing_tier: string;
  active_count: number;
  churned_count: number;
  total_count: number;
  member_limit: number;
  is_over_limit: boolean;
  overage_amount: number;
}

interface AuditResult {
  timestamp: string;
  programs_audited: number;
  programs_over_limit: number;
  total_overage_members: number;
  snapshots_saved: number;
  errors: string[];
}

/**
 * Main billing audit function
 */
async function runBillingAudit(): Promise<AuditResult> {
  const startTime = Date.now();
  const result: AuditResult = {
    timestamp: new Date().toISOString(),
    programs_audited: 0,
    programs_over_limit: 0,
    total_overage_members: 0,
    snapshots_saved: 0,
    errors: [],
  };

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  🔍 BILLING WATCHDOG - Nightly Usage Audit");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Started: ${result.timestamp}`);
  console.log("───────────────────────────────────────────────────────────────");

  // 1. Call the efficient RPC to get usage data
  const { data: usageData, error: rpcError } = await supabase
    .rpc('get_daily_program_usage') as { data: ProgramUsage[] | null; error: any };

  if (rpcError) {
    console.error("❌ RPC Failed:", rpcError.message);
    result.errors.push(`RPC Error: ${rpcError.message}`);
    return result;
  }

  if (!usageData || usageData.length === 0) {
    console.log("ℹ️  No active programs found.");
    return result;
  }

  result.programs_audited = usageData.length;
  console.log(`\n📊 Auditing ${usageData.length} programs...\n`);

  // 2. Process each program
  for (const prog of usageData) {
    const usagePercent = prog.member_limit > 0 
      ? Math.round((prog.active_count / prog.member_limit) * 100) 
      : 0;
    
    const statusBar = generateUsageBar(usagePercent);
    const tierBadge = `[${prog.billing_tier}]`;

    if (prog.is_over_limit) {
      // OVERAGE ALERT
      result.programs_over_limit++;
      result.total_overage_members += prog.overage_amount;

      console.error(`\n🚨 OVERAGE ALERT`);
      console.error(`   Program:  ${prog.program_name} ${tierBadge}`);
      console.error(`   Usage:    ${prog.active_count} / ${prog.member_limit} members (${usagePercent}%)`);
      console.error(`   Overage:  +${prog.overage_amount} members over limit`);
      console.error(`   ${statusBar}`);
      
      // TODO: In production, send email/Slack notification
      // await sendOverageAlert(prog);

    } else if (usagePercent >= 80) {
      // WARNING - approaching limit
      console.warn(`\n⚠️  APPROACHING LIMIT`);
      console.warn(`   Program:  ${prog.program_name} ${tierBadge}`);
      console.warn(`   Usage:    ${prog.active_count} / ${prog.member_limit} members (${usagePercent}%)`);
      console.warn(`   ${statusBar}`);

    } else {
      // Normal - within limits
      console.log(`✅ ${prog.program_name} ${tierBadge}`);
      console.log(`   ${prog.active_count}/${prog.member_limit} members (${usagePercent}%) ${statusBar}`);
    }

    // 3. Save snapshot to database
    const { error: snapError } = await supabase
      .from('billing_snapshots')
      .insert({
        program_id: prog.program_id,
        active_member_count: prog.active_count,
        churned_member_count: prog.churned_count,
        member_limit_at_snapshot: prog.member_limit,
        is_over_limit: prog.is_over_limit,
        overage_count: prog.overage_amount,
      });

    if (snapError) {
      console.error(`   ❌ Failed to save snapshot: ${snapError.message}`);
      result.errors.push(`Snapshot error for ${prog.program_name}: ${snapError.message}`);
    } else {
      result.snapshots_saved++;
    }
  }

  // 4. Summary report
  const duration = Date.now() - startTime;
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  📋 AUDIT SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Programs Audited:    ${result.programs_audited}`);
  console.log(`  Programs Over Limit: ${result.programs_over_limit}`);
  console.log(`  Total Overage:       ${result.total_overage_members} members`);
  console.log(`  Snapshots Saved:     ${result.snapshots_saved}`);
  console.log(`  Errors:              ${result.errors.length}`);
  console.log(`  Duration:            ${duration}ms`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (result.programs_over_limit > 0) {
    console.log("\n⚠️  ACTION REQUIRED: Review overage alerts above for billing");
  } else {
    console.log("\n✅ All programs within limits. No billing action required.");
  }

  return result;
}

/**
 * Generate a visual usage bar
 */
function generateUsageBar(percent: number): string {
  const barLength = 20;
  const filled = Math.min(Math.round((percent / 100) * barLength), barLength);
  const empty = barLength - filled;
  
  let color = '🟩'; // Green
  if (percent >= 100) color = '🟥'; // Red
  else if (percent >= 80) color = '🟨'; // Yellow
  
  return `[${color.repeat(filled)}${'⬜'.repeat(empty)}]`;
}

/**
 * Placeholder for future email/Slack alerts
 */
// async function sendOverageAlert(program: ProgramUsage): Promise<void> {
//   // TODO: Implement email notification to finance@passtovip.com
//   // TODO: Implement Slack webhook notification
// }

// Execute the audit
runBillingAudit()
  .then((result) => {
    if (result.errors.length > 0) {
      console.error("\n❌ Audit completed with errors");
      process.exit(1);
    }
    console.log("\n💾 Billing audit completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
