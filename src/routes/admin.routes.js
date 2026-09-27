const express = require("express");

const authenticate = require("../middleware/auth");
const authorizeRoles = require("../middleware/roles");
const checkEventAccess = require("../middleware/eventAccess");
const upload = require("../middleware/upload");

const router = express.Router();

const {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
} = require("../controllers/event.controller");

const {
  verifyPayment,
  rejectPayment,
  getPaymentByRegistration,
} = require("../controllers/payment.controller");

const {
  getRegistrations,
  getRegistrationById,
  exportRegistrations,
} = require("../controllers/registration.controller");

const {
  getDashboard,
} = require("../controllers/admin.controller");

// Create event
router.post(
  "/events",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  upload.single("poster"),
  createEvent
);

router.get(
  "/events",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "FACULTY"),
  getAllEvents
);

router.patch(
  "/events/:id",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "FACULTY"),
  upload.single("poster"),
  updateEvent
);

// Delete event
router.delete(
  "/events/:id",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  deleteEvent
);


router.patch(
  "/registrations/:id/payment",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "FACULTY"),
  verifyPayment
);

router.patch(
  "/registrations/:id/payment/reject",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "FACULTY"),
  rejectPayment
);

router.get(
  "/registrations/:id/payment",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "FACULTY"),
  getPaymentByRegistration
);

router.get(
  "/registrations",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "FACULTY"),
  getRegistrations
);

router.get(
  "/registrations/export",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "FACULTY"),
  exportRegistrations
);



router.get(
  "/registrations/:id",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "FACULTY"),
  getRegistrationById
);

router.get(
  "/dashboard",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "FACULTY"),
  getDashboard
);



// SUPER_ADMIN test
router.get(
  "/test",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  (req, res) => {
    return res.json({
      success: true,
      message: "SUPER_ADMIN access granted",
      user: req.user,
    });
  }
);

// Event-level access test
router.get(
  "/events/:eventId/test",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  checkEventAccess,
  (req, res) => {
    if (!req.event) {
      return res.status(500).json({
        success: false,
        message: "Event was not attached by authorization middleware",
      });
    }

    return res.json({
      success: true,
      message: "Event access granted",

      event: {
        id: req.event._id,
        title: req.event.title,
        category: req.event.category,
      },

      user: {
        userId: req.user.userId,
        role: req.user.role,
      },
    });
  }
);

module.exports = router;