import axios from 'axios';

const API_URL = 'http://localhost:5000/api/admin/provision';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'pk_phygital_admin_2024';

async function createClient() {
  try {
    const payload = {
      businessName: "Beta Tester Pizza",
      email: "manager@betapizza.com",
      password: "securePassword123!",
      passkitProgramId: "4RhsVhHek0dliVogVznjSQ",
      protocol: "MEMBERSHIP"
    };

    console.log("🏗️  Creating Tenant...");
    console.log("   Business:", payload.businessName);
    console.log("   Email:", payload.email);
    console.log("   Protocol:", payload.protocol);
    console.log("");

    const config = {
      headers: { 
        'x-api-key': ADMIN_API_KEY,
        'Content-Type': 'application/json'
      } 
    };

    const response = await axios.post(API_URL, payload, config);
    
    console.log("✅ Tenant Created Successfully!");
    console.log("");
    console.log("📋 Response Data:");
    console.log("   User ID:", response.data.data.userId);
    console.log("   Program ID:", response.data.data.programId);
    console.log("   Email:", response.data.data.email);
    console.log("   Business:", response.data.data.businessName);
    console.log("");
    console.log("⏱️  Processing Time:", response.data.metadata.processingTime, "ms");
    console.log("");
    console.log("🔍 Next Steps - Verify in Supabase:");
    console.log("   1. Check Auth > Users for:", payload.email);
    console.log("   2. Check Table 'programs' for:", payload.businessName);
    console.log("   3. Check Table 'admin_profiles' for user-program link");

  } catch (error) {
    console.error("❌ Failed:", error.response?.data || error.message);
    
    if (error.response?.data?.error?.code === 'DUPLICATE_EMAIL') {
      console.log("");
      console.log("💡 This email already exists. Try a different email address.");
    }
  }
}

createClient();
