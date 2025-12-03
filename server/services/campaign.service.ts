import fs from "fs";
import csv from "csv-parser";
import { supabaseService } from "./supabase.service";
import { postGridService } from "./postgrid.service";

interface CampaignContact {
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  email?: string;
  address?: string;
  addressLine1?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  zip?: string;
  postalCode?: string;
  postal_code?: string;
}

interface CampaignResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    contact: string;
    success: boolean;
    claimCode?: string;
    postcardId?: string;
    error?: string;
  }>;
}

interface CampaignOptions {
  filePath: string;
  programId: string;
  frontTemplateId: string;
  backTemplateId?: string;
  size?: "6x4" | "9x6" | "11x6";
  baseClaimUrl?: string;
}

class CampaignService {
  async processBatchUpload(options: CampaignOptions): Promise<CampaignResult> {
    const {
      filePath,
      programId,
      frontTemplateId,
      backTemplateId,
      size = "6x4",
      baseClaimUrl = process.env.APP_URL
        ? `${process.env.APP_URL}/claim`
        : "https://phygital-loyalty-ecosystem.replit.app/claim",
    } = options;

    return new Promise((resolve, reject) => {
      const rows: CampaignContact[] = [];
      const results: CampaignResult["results"] = [];
      let successCount = 0;
      let failedCount = 0;

      console.log(`📂 Reading CSV file: ${filePath}`);

      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data: CampaignContact) => rows.push(data))
        .on("error", (error) => {
          console.error("❌ CSV parsing error:", error);
          reject(error);
        })
        .on("end", async () => {
          console.log(`📊 Processing ${rows.length} contacts...`);

          for (const row of rows) {
            const firstName = row.first_name || row.firstName || "";
            const lastName = row.last_name || row.lastName || "";
            const email = row.email || "";
            const addressLine1 =
              row.address || row.addressLine1 || row.address_line_1 || "";
            const city = row.city || "";
            const state = row.state || "";
            const postalCode = row.zip || row.postalCode || row.postal_code || "";
            const contactName = `${firstName} ${lastName}`.trim() || "Unknown";

            if (!addressLine1 || !city || !state || !postalCode) {
              console.log(`⚠️ Skipping ${contactName}: Missing address info`);
              results.push({
                contact: contactName,
                success: false,
                error: "Missing required address fields",
              });
              failedCount++;
              continue;
            }

            try {
              console.log(`🎟️ Generating claim code for ${contactName}...`);

              const claimResult = await supabaseService.generateClaimCode({
                passkitProgramId: programId,
                contact: {
                  firstName,
                  lastName,
                  email,
                  addressLine1,
                  city,
                  state,
                  postalCode,
                  country: "US",
                },
              });

              if (!claimResult.success || !claimResult.claimCode) {
                throw new Error(claimResult.error || "Failed to generate claim code");
              }

              const claimCode = claimResult.claimCode;
              const claimUrl = `${baseClaimUrl}/${claimCode}`;

              console.log(`📮 Sending postcard to ${contactName}...`);

              const postcardResult = await postGridService.sendPostcard({
                frontTemplateId,
                backTemplateId: backTemplateId || frontTemplateId,
                size,
                recipientAddress: {
                  firstName,
                  lastName,
                  addressLine1,
                  city,
                  state,
                  postalCode,
                  country: "US",
                },
                claimCode,
                claimUrl,
                mergeVariables: {
                  firstName,
                  lastName,
                  fullName: contactName,
                  qrCodeUrl: claimUrl,
                  claimCode,
                },
              });

              if (postcardResult.success) {
                console.log(`✅ Success: ${contactName}`);
                results.push({
                  contact: contactName,
                  success: true,
                  claimCode,
                  postcardId: postcardResult.postcardId,
                });
                successCount++;
              } else {
                throw new Error(postcardResult.error || "PostGrid failed");
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
              console.error(`❌ Failed: ${contactName} - ${errorMessage}`);
              results.push({
                contact: contactName,
                success: false,
                error: errorMessage,
              });
              failedCount++;
            }
          }

          try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Cleaned up temp file: ${filePath}`);
          } catch (e) {
            console.log(`⚠️ Could not delete temp file: ${filePath}`);
          }

          console.log(
            `📊 Campaign complete: ${successCount}/${rows.length} successful`
          );

          resolve({
            total: rows.length,
            success: successCount,
            failed: failedCount,
            results,
          });
        });
    });
  }
}

export const campaignService = new CampaignService();
