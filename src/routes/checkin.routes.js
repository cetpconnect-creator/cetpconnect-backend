const express = require("express");

const {
  scanQRCode,
  checkInByRegistrationId,
} = require("../controllers/checkin.controller");

const authenticate = require("../middleware/auth");
const authorizeRoles = require("../middleware/roles");

const router = express.Router();

const checkinRoles = [
  "SUPER_ADMIN",
  "FACULTY",
  "EVENT_MANAGER",
  "STUDENT_COORDINATOR",
];

/**
 * QR camera / QR token check-in
 */
router.post(
  "/scan",
  authenticate,
  authorizeRoles(...checkinRoles),
  scanQRCode
);

/**
 * Manual registration ID check-in
 */
router.post(
  "/registration",
  authenticate,
  authorizeRoles(...checkinRoles),
  checkInByRegistrationId
);

module.exports = router;