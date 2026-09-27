const express = require("express");

const {
  scanQRCode,
} = require("../controllers/checkin.controller");

const authenticate = require("../middleware/auth");
const authorizeRoles = require("../middleware/roles");

const router = express.Router();

router.post(
  "/scan",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  scanQRCode
);

module.exports = router;