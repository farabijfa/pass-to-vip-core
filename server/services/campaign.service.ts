import fs from "fs";
import csv from "csv-parser";
import { Readable } from "stream";
import { supabaseService } from "./supabase.service";
import { postGridService } from "./postgrid.service";

interface CampaignContact {
  [key: string]: string | undefined;
}

interface NormalizedContact {
  firstName: string;
  lastName: string;
  email: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
}

interface CampaignResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    contact: string;
    success: boolean;
    claimCode?: string;
    mailId?: string;
    error?: string;
  }>;
}

interface CampaignOptions {
  filePath: string;
  programId: string;
  templateId: string;
  frontTemplateId?: string;
  backTemplateId?: string;
  resourceType: "postcard" | "letter";
  size?: "6x4" | "9x6" | "11x6";
  baseClaimUrl?: string;
  description?: string;
}

const COLUMN_MAPPINGS: Record<string, string[]> = {
  firstName: ["first_name", "firstname", "first name", "fname", "given_name", "givenname"],
  lastName: ["last_name", "lastname", "last name", "lname", "surname", "family_name", "familyname"],
  email: ["email", "e-mail", "email_address", "emailaddress"],
  addressLine1: ["address", "addressline1", "address_line_1", "address_line1", "street", "street_address", "addr", "address1"],
  city: ["city", "town", "locality"],
  state: ["state", "province", "region", "st"],
  postalCode: ["zip", "zipcode", "zip_code", "postal_code", "postalcode", "postal"],
};

class CampaignService {
  private normalizeColumnName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  }

  private findColumnValue(row: CampaignContact, targetField: string): string {
    const variations = COLUMN_MAPPINGS[targetField] || [targetField];
    
    for (const key of Object.keys(row)) {
      const normalizedKey = this.normalizeColumnName(key);
      if (normalizedKey === this.normalizeColumnName(targetField)) {
        return (row[key] || "").trim();
      }
      for (const variation of variations) {
        if (normalizedKey === this.normalizeColumnName(variation)) {
          return (row[key] || "").trim();
        }
      }
    }
    return "";
  }

  private normalizeContact(row: CampaignContact): NormalizedContact {
    return {
      firstName: this.findColumnValue(row, "firstName"),
      lastName: this.findColumnValue(row, "lastName"),
      email: this.findColumnValue(row, "email"),
      addressLine1: this.findColumnValue(row, "addressLine1"),
      city: this.findColumnValue(row, "city"),
      state: this.findColumnValue(row, "state"),
      postalCode: this.findColumnValue(row, "postalCode"),
    };
  }

  private preprocessCsvContent(content: string): string {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length === 0) {
      return content;
    }

    const firstLine = lines[0].trim();
    const isMalformed = firstLine.startsWith('"') && 
                        firstLine.endsWith('"') && 
                        !firstLine.includes('","');

    if (!isMalformed) {
      console.log("📋 CSV format looks standard, processing normally");
      return content;
    }

    console.log("🔧 Detected malformed CSV (quoted rows), fixing format...");
    
    const fixedLines = lines.map(line => {
      let trimmed = line.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        trimmed = trimmed.slice(1, -1);
      }
      return trimmed;
    });

    return fixedLines.join("\n");
  }

  private validateCsvHeaders(headers: string[]): { valid: boolean; missing: string[] } {
    const requiredFields = ["addressLine1", "city", "state", "postalCode"];
    const missing: string[] = [];

    for (const field of requiredFields) {
      const variations = COLUMN_MAPPINGS[field] || [field];
      const found = headers.some(header => {
        const normalizedHeader = this.normalizeColumnName(header);
        return variations.some(v => this.normalizeColumnName(v) === normalizedHeader) ||
               normalizedHeader === this.normalizeColumnName(field);
      });
      if (!found) {
        missing.push(field);
      }
    }

    return { valid: missing.length === 0, missing };
  }

  async processBatchUpload(options: CampaignOptions): Promise<CampaignResult> {
    const {
      filePath,
      programId,
      templateId,
      frontTemplateId,
      backTemplateId,
      resourceType = "postcard",
      size = "6x4",
      baseClaimUrl = process.env.APP_URL
        ? `${process.env.APP_URL}/claim`
        : "https://phygital-loyalty-ecosystem.replit.app/claim",
      description,
    } = options;

    return new Promise((resolve, reject) => {
      const rows: CampaignContact[] = [];
      const results: CampaignResult["results"] = [];
      let successCount = 0;
      let failedCount = 0;
      let headers: string[] = [];

      const resourceLabel = resourceType === "letter" ? "letter" : "postcard";
      console.log(`📂 Reading CSV file: ${filePath}`);
      console.log(`📮 Resource type: ${resourceLabel}`);

      try {
        const rawContent = fs.readFileSync(filePath, "utf-8");
        const fixedContent = this.preprocessCsvContent(rawContent);
        
        const stream = Readable.from([fixedContent]);
        
        stream
          .pipe(csv())
          .on("headers", (h: string[]) => {
            headers = h;
            console.log(`📋 Detected columns: ${headers.join(", ")}`);
            
            const validation = this.validateCsvHeaders(headers);
            if (!validation.valid) {
              console.warn(`⚠️ Warning: Missing recommended columns: ${validation.missing.join(", ")}`);
            }
          })
          .on("data", (data: CampaignContact) => rows.push(data))
          .on("error", (error) => {
            console.error("❌ CSV parsing error:", error);
            reject(new Error(`CSV parsing failed: ${error.message}`));
          })
          .on("end", async () => {
            if (rows.length === 0) {
              console.error("❌ No data rows found in CSV");
              resolve({
                total: 0,
                success: 0,
                failed: 0,
                results: [{
                  contact: "N/A",
                  success: false,
                  error: "No data rows found in CSV file. Check that your file has data and proper headers.",
                }],
              });
              return;
            }

            console.log(`📊 Processing ${rows.length} contacts as ${resourceLabel}s...`);

            for (const row of rows) {
              const contact = this.normalizeContact(row);
              const contactName = `${contact.firstName} ${contact.lastName}`.trim() || "Unknown";

              if (!contact.addressLine1 || !contact.city || !contact.state || !contact.postalCode) {
                const missingFields: string[] = [];
                if (!contact.addressLine1) missingFields.push("address");
                if (!contact.city) missingFields.push("city");
                if (!contact.state) missingFields.push("state");
                if (!contact.postalCode) missingFields.push("zip/postal code");
                
                console.log(`⚠️ Skipping ${contactName}: Missing ${missingFields.join(", ")}`);
                results.push({
                  contact: contactName,
                  success: false,
                  error: `Missing required fields: ${missingFields.join(", ")}`,
                });
                failedCount++;
                continue;
              }

              try {
                console.log(`🎟️ Generating claim code for ${contactName}...`);

                const claimResult = await supabaseService.generateClaimCode({
                  passkitProgramId: programId,
                  contact: {
                    firstName: contact.firstName,
                    lastName: contact.lastName,
                    email: contact.email,
                    addressLine1: contact.addressLine1,
                    city: contact.city,
                    state: contact.state,
                    postalCode: contact.postalCode,
                    country: "US",
                  },
                });

                if (!claimResult.success || !claimResult.claimCode) {
                  throw new Error(claimResult.error || "Failed to generate claim code");
                }

                const claimCode = claimResult.claimCode;
                const claimUrl = `${baseClaimUrl}/${claimCode}`;
                
                // Generate QR code image URL (PostGrid needs an image, not a text link)
                const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&qzone=1&data=${encodeURIComponent(claimUrl)}`;

                console.log(`📮 Sending ${resourceLabel} to ${contactName}...`);

                let mailResult: { success: boolean; mailId?: string; error?: string };

                if (resourceType === "letter") {
                  const letterResult = await postGridService.sendLetter({
                    templateId: templateId || frontTemplateId || "",
                    recipientAddress: {
                      firstName: contact.firstName,
                      lastName: contact.lastName,
                      addressLine1: contact.addressLine1,
                      city: contact.city,
                      state: contact.state,
                      postalCode: contact.postalCode,
                      country: "US",
                    },
                    claimCode,
                    claimUrl,
                    mergeVariables: {
                      firstName: contact.firstName,
                      lastName: contact.lastName,
                      fullName: contactName,
                      qrCodeUrl: qrCodeImageUrl,
                      claimCode,
                    },
                    addressPlacement: "top_first_page",
                    doubleSided: true,
                    color: true,
                    description,
                  });
                  mailResult = {
                    success: letterResult.success,
                    mailId: letterResult.letterId || undefined,
                    error: letterResult.error,
                  };
                } else {
                  const postcardResult = await postGridService.sendPostcard({
                    frontTemplateId: frontTemplateId || templateId,
                    backTemplateId: backTemplateId || frontTemplateId || templateId,
                    size,
                    recipientAddress: {
                      firstName: contact.firstName,
                      lastName: contact.lastName,
                      addressLine1: contact.addressLine1,
                      city: contact.city,
                      state: contact.state,
                      postalCode: contact.postalCode,
                      country: "US",
                    },
                    claimCode,
                    claimUrl,
                    mergeVariables: {
                      firstName: contact.firstName,
                      lastName: contact.lastName,
                      fullName: contactName,
                      qrCodeUrl: qrCodeImageUrl,
                      claimCode,
                    },
                  });
                  mailResult = {
                    success: postcardResult.success,
                    mailId: postcardResult.postcardId,
                    error: postcardResult.error,
                  };
                }

                if (mailResult.success) {
                  console.log(`✅ Success: ${contactName}`);
                  results.push({
                    contact: contactName,
                    success: true,
                    claimCode,
                    mailId: mailResult.mailId,
                  });
                  successCount++;
                } else {
                  throw new Error(mailResult.error || "PostGrid failed");
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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("❌ Failed to read CSV file:", errorMessage);
        reject(new Error(`Failed to read CSV file: ${errorMessage}`));
      }
    });
  }
}

export const campaignService = new CampaignService();
