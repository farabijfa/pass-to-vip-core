/* services/logicService.js */
const supabase = require('../config/supabase');
const passkitService = require('./passkitService');

/**
 * Handles the Point of Sale (POS) Action
 * @param {string} externalId - The QR code content or PIN
 * @param {string} actionType - The action (MEMBER_EARN, COUPON_REDEEM, etc.)
 * @param {number} amount - Points to add/remove (optional)
 */
exports.handlePosAction = async (externalId, actionType, amount) => {
  let rpcName;
  let rpcParams = { 
    p_external_id: externalId, 
    p_action: actionType 
  };

  console.log(`\n🤖 Processing Action: ${actionType} for ID: ${externalId}`);

  // 1. Intelligent Routing: Decide which RPC to call based on the Action
  // [cite: 193-198]
  if (['MEMBER_EARN', 'MEMBER_REDEEM', 'MEMBER_ADJUST'].includes(actionType)) {
    rpcName = 'process_membership_transaction';
    // Ensure amount is an integer, default to 0 if missing
    rpcParams.p_amount = parseInt(amount) || 0; 
  } 
  else if (['COUPON_REDEEM', 'TICKET_CHECKIN', 'INSTALL', 'UNINSTALL'].includes(actionType)) {
    rpcName = 'process_one_time_use';
  } 
  else {
    throw new Error(`Unknown Action Type: ${actionType}`);
  }

  // 2. Atomic Execution: Call Supabase RPC
  // [cite: 203]
  const { data: rpcResult, error } = await supabase.rpc(rpcName, rpcParams);

  if (error) {
    console.error('❌ Supabase RPC Error:', error.message);
    throw new Error(error.message); // Pass database error to frontend
  }

  console.log('✅ Database Transaction Success:', rpcResult.notification_message);

  // 3. Synchronization: Update PassKit (Fire and Forget or Await)
  // [cite: 209]
  try {
    await passkitService.syncPass(rpcResult);
  } catch (syncError) {
    // We log sync errors but DO NOT fail the transaction because the database ledger is already updated.
    console.error('⚠️ PassKit Sync Warning:', syncError.message);
  }

  return {
    success: true,
    message: rpcResult.notification_message,
    data: rpcResult
  };
};