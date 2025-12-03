/* routes/api.js */
const express = require('express');
const router = express.Router();
const logicService = require('../services/logicService');

// POST /api/pos/action
// Receives data from Softr Button
router.post('/pos/action', async (req, res, next) => {
  try {
    const { external_id, action, amount } = req.body;

    // Basic Input Validation
    if (!external_id || !action) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: external_id and action are required.' 
      });
    }

    // Call the Business Logic
    const result = await logicService.handlePosAction(external_id, action, amount);

    // Return Success to Softr
    res.json(result);

  } catch (error) {
    // Pass errors to the global error handler in app.js
    next(error); 
  }
});

module.exports = router;