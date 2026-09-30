const express = require("express");

const {
  submitPayment,
  submitTeamPayment,
} = require("../controllers/payment.controller");

const upload = require("../middleware/upload");

const router = express.Router();

/* =========================================================
   INDIVIDUAL PAYMENT
========================================================= */

router.post(
  "/:registrationId",
  upload.single("paymentScreenshot"),
  submitPayment
);

/* =========================================================
   TEAM PAYMENT
========================================================= */

router.post(
  "/team/:teamId",
  upload.single("paymentScreenshot"),
  submitTeamPayment
);

module.exports = router;