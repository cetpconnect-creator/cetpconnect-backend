const mongoose = require("mongoose");

const Registration = require("../models/Registration");
const Payment = require("../models/Payment");
const Team = require("../models/Team");
const User = require("../models/User");

/* =========================================================
   HELPERS
========================================================= */

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

/*
 * Returns:
 *   null       -> SUPER_ADMIN can access everything
 *   []         -> user has no assigned events
 *   [ids...]   -> assigned event IDs
 */
async function getAccessibleEventIds(req) {
  if (!req.user) {
    return [];
  }

  if (req.user.role === "SUPER_ADMIN") {
    return null;
  }

  const user = await User.findById(
    req.user.userId
  ).select("assignedEvents role isActive");

  if (!user) {
    const error = new Error(
      "User account not found"
    );
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error(
      "User account is inactive"
    );
    error.statusCode = 403;
    throw error;
  }

  return (user.assignedEvents || []).map(
    (eventId) => eventId.toString()
  );
}

/*
 * Check whether the current user can access
 * a particular event.
 */
async function checkEventAccess(
  req,
  eventId
) {
  if (!eventId) {
    const error = new Error(
      "Event information is missing"
    );

    error.statusCode = 400;

    throw error;
  }

  const accessibleEventIds =
    await getAccessibleEventIds(req);

  /*
   * SUPER_ADMIN
   */
  if (accessibleEventIds === null) {
    return true;
  }

  const allowed =
    accessibleEventIds.includes(
      eventId.toString()
    );

  if (!allowed) {
    const error = new Error(
      "You do not have access to this event"
    );

    error.statusCode = 403;

    throw error;
  }

  return true;
}

/* =========================================================
   INDIVIDUAL PAYMENT SUBMISSION
========================================================= */

const submitPayment = async (req, res) => {
  try {
    const { registrationId } =
      req.params;

    if (!registrationId?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Registration ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Payment screenshot is required",
      });
    }

    const registration =
      await Registration.findOne({
        registrationId:
          registrationId.trim(),
      }).populate("eventId");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message:
          "Registration not found",
      });
    }

    if (
      registration.registrationType !==
      "INDIVIDUAL"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This registration is not an individual registration",
      });
    }

    if (
      registration.paymentStatus ===
      "PAYMENT_VERIFIED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment has already been verified",
      });
    }

    if (
      registration.paymentStatus ===
      "PAYMENT_SUBMITTED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment is already submitted and awaiting verification",
      });
    }

    if (!registration.eventId) {
      return res.status(400).json({
        success: false,
        message:
          "Event information is missing",
      });
    }

    const payment =
      await Payment.create({
        registrationId:
          registration._id,

        eventId:
          registration.eventId._id,

        amount:
          registration.eventId.fee,

        screenshotUrl:
          req.file.path,

        status:
          "PAYMENT_SUBMITTED",
      });

    registration.paymentStatus =
      "PAYMENT_SUBMITTED";

    await registration.save();

    return res.status(201).json({
      success: true,

      message:
        "Payment submitted successfully",

      payment: {
        paymentId:
          payment._id,

        registrationId:
          registration.registrationId,

        amount:
          payment.amount,

        status:
          payment.status,

        screenshotUrl:
          payment.screenshotUrl,
      },
    });
  } catch (error) {
    console.error(
      "Submit payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit payment",
    });
  }
};

/* =========================================================
   TEAM PAYMENT SUBMISSION
========================================================= */

const submitTeamPayment = async (
  req,
  res
) => {
  try {
    const { teamId } =
      req.params;

    if (!teamId?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Team ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Payment screenshot is required",
      });
    }

    const team =
      await Team.findOne({
        teamId:
          teamId.trim().toUpperCase(),
      });

    if (!team) {
      return res.status(404).json({
        success: false,
        message:
          "Team not found",
      });
    }

    const registration =
      await Registration.findOne({
        teamId: team._id,
        registrationType: "TEAM",
      }).populate("eventId");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message:
          "Team registration not found",
      });
    }

    if (
      team.status ===
      "PAYMENT_VERIFIED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Team payment has already been verified",
      });
    }

    if (
      team.status ===
      "PAYMENT_SUBMITTED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Team payment is already submitted and awaiting verification",
      });
    }

    if (!registration.eventId) {
      return res.status(400).json({
        success: false,
        message:
          "Event information is missing",
      });
    }

    const payment =
      await Payment.create({
        registrationId:
          registration._id,

        teamId:
          team._id,

        eventId:
          registration.eventId._id,

        amount:
          registration.eventId.fee,

        screenshotUrl:
          req.file.path,

        status:
          "PAYMENT_SUBMITTED",
      });

    registration.paymentStatus =
      "PAYMENT_SUBMITTED";

    await registration.save();

    team.status =
      "PAYMENT_SUBMITTED";

    await team.save();

    return res.status(201).json({
      success: true,

      message:
        "Team payment submitted successfully",

      payment: {
        paymentId:
          payment._id,

        teamId:
          team.teamId,

        registrationId:
          registration.registrationId,

        amount:
          payment.amount,

        status:
          payment.status,

        screenshotUrl:
          payment.screenshotUrl,
      },
    });
  } catch (error) {
    console.error(
      "Team payment submission error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit team payment",
    });
  }
};

/* =========================================================
   GET PAYMENT BY REGISTRATION
========================================================= */

const getPaymentByRegistration =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (!id?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Registration ID is required",
        });
      }

      let registration =
        await Registration.findOne({
          registrationId:
            id.trim(),
        });

      /*
       * Also support MongoDB Registration._id
       */
      if (
        !registration &&
        isValidObjectId(id)
      ) {
        registration =
          await Registration.findById(
            id
          );
      }

      if (!registration) {
        return res.status(404).json({
          success: false,
          message:
            "Registration not found",
          registrationId: id,
        });
      }

      /*
       * ROLE-BASED EVENT ACCESS
       */
      await checkEventAccess(
        req,
        registration.eventId
      );

      const payment =
        await Payment.findOne({
          registrationId:
            registration._id,
        })
          .sort({
            createdAt: -1,
          })
          .populate(
            "verifiedBy",
            "name username"
          )
          .populate(
            "rejectedBy",
            "name username"
          )
          .lean();

      if (!payment) {
        return res.status(404).json({
          success: false,

          message:
            "No payment found for this registration",

          registration: {
            _id:
              registration._id,

            registrationId:
              registration.registrationId,

            paymentStatus:
              registration.paymentStatus,
          },
        });
      }

      return res.status(200).json({
        success: true,

        payment: {
          paymentId:
            payment._id,

          registrationId:
            registration.registrationId,

          registrationObjectId:
            registration._id,

          teamId:
            payment.teamId || null,

          eventId:
            payment.eventId,

          amount:
            payment.amount,

          screenshotUrl:
            payment.screenshotUrl,

          status:
            payment.status,

          verifiedBy:
            payment.verifiedBy ||
            null,

          verifiedAt:
            payment.verifiedAt ||
            null,

          rejectedBy:
            payment.rejectedBy ||
            null,

          rejectedAt:
            payment.rejectedAt ||
            null,

          rejectionReason:
            payment.rejectionReason ||
            "",

          createdAt:
            payment.createdAt,

          updatedAt:
            payment.updatedAt,
        },
      });
    } catch (error) {
      console.error(
        "Get payment by registration error:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        success: false,
        message:
          error.statusCode
            ? error.message
            : "Failed to load payment",
      });
    }
  };

/* =========================================================
   VERIFY PAYMENT
========================================================= */

const verifyPayment = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment ID",
      });
    }

    const payment =
      await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment not found",
      });
    }

    /*
     * ROLE-BASED EVENT ACCESS
     */
    await checkEventAccess(
      req,
      payment.eventId
    );

    if (
      payment.status !==
      "PAYMENT_SUBMITTED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment is not awaiting verification",
      });
    }

    payment.status =
      "PAYMENT_VERIFIED";

    payment.verifiedBy =
      req.user.userId;

    payment.verifiedAt =
      new Date();

    await payment.save();

    if (payment.registrationId) {
      const registration =
        await Registration.findById(
          payment.registrationId
        );

      if (registration) {
        registration.paymentStatus =
          "PAYMENT_VERIFIED";

        await registration.save();

        /*
         * Synchronize team payment status.
         */
        if (
          registration.registrationType ===
            "TEAM" &&
          registration.teamId
        ) {
          await Team.findByIdAndUpdate(
            registration.teamId,
            {
              status:
                "PAYMENT_VERIFIED",
            }
          );
        }
      }
    }

    return res.status(200).json({
      success: true,

      message:
        "Payment verified successfully",

      payment,
    });
  } catch (error) {
    console.error(
      "Verify payment error:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Failed to verify payment",
    });
  }
};

/* =========================================================
   REJECT PAYMENT
========================================================= */

const rejectPayment = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    const rejectionReason =
      typeof req.body?.rejectionReason ===
      "string"
        ? req.body.rejectionReason.trim()
        : "";

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment ID",
      });
    }

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message:
          "Rejection reason is required",
      });
    }

    const payment =
      await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment not found",
      });
    }

    /*
     * ROLE-BASED EVENT ACCESS
     */
    await checkEventAccess(
      req,
      payment.eventId
    );

    if (
      payment.status !==
      "PAYMENT_SUBMITTED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment is not awaiting verification",
      });
    }

    payment.status =
      "PAYMENT_REJECTED";

    payment.rejectedBy =
      req.user.userId;

    payment.rejectedAt =
      new Date();

    payment.rejectionReason =
      rejectionReason;

    await payment.save();

    if (payment.registrationId) {
      const registration =
        await Registration.findById(
          payment.registrationId
        );

      if (registration) {
        registration.paymentStatus =
          "PAYMENT_REJECTED";

        await registration.save();

        /*
         * Synchronize team status.
         */
        if (
          registration.registrationType ===
            "TEAM" &&
          registration.teamId
        ) {
          await Team.findByIdAndUpdate(
            registration.teamId,
            {
              status:
                "PAYMENT_REJECTED",
            }
          );
        }
      }
    }

    return res.status(200).json({
      success: true,

      message:
        "Payment rejected successfully",

      payment,
    });
  } catch (error) {
    console.error(
      "Reject payment error:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Failed to reject payment",
    });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  submitPayment,
  submitTeamPayment,
  getPaymentByRegistration,
  verifyPayment,
  rejectPayment,
};