const Registration = require("../models/Registration");
const Payment = require("../models/Payment");
const Team = require("../models/Team");

const submitPayment = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await Registration.findOne({
      registrationId,
    }).populate("eventId");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    if (registration.paymentStatus === "PAYMENT_VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been verified",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Payment screenshot is required",
      });
    }

    const payment = await Payment.create({
      registrationId: registration._id,
      eventId: registration.eventId._id,
      amount: registration.eventId.fee,
      screenshotUrl: req.file.path,
      status: "PAYMENT_SUBMITTED",
    });

    registration.paymentStatus = "PAYMENT_SUBMITTED";
    await registration.save();

    return res.status(201).json({
      success: true,
      message: "Payment submitted successfully",
      payment: {
        id: payment._id,
        registrationId,
        amount: payment.amount,
        status: payment.status,
        screenshotUrl: payment.screenshotUrl,
      },
    });
  } catch (error) {
    console.error("Submit payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const submitTeamPayment = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Payment screenshot is required",
      });
    }

    // Find team
    const team = await Team.findOne({
      teamId: teamId.trim().toUpperCase(),
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Find registration belonging to this team
    const registration = await Registration.findOne({
      teamId: team._id,
      registrationType: "TEAM",
    }).populate("eventId");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Team registration not found",
      });
    }

    // Already verified
    if (team.status === "PAYMENT_VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Team payment is already verified",
      });
    }

    // Already submitted
    if (team.status === "PAYMENT_SUBMITTED") {
      return res.status(400).json({
        success: false,
        message: "Team payment is already submitted",
      });
    }

    // Create ONE payment for entire team
    const payment = await Payment.create({
      registrationId: registration._id,
      teamId: team._id,
      eventId: registration.eventId._id,
      amount: registration.eventId.fee,
      screenshotUrl: req.file.path,
      status: "PAYMENT_SUBMITTED",
    });

    // Update registration
    registration.paymentStatus = "PAYMENT_SUBMITTED";
    await registration.save();

    // Update team
    team.status = "PAYMENT_SUBMITTED";
    await team.save();

    return res.status(201).json({
      success: true,
      message: "Team payment submitted successfully",

      payment: {
        paymentId: payment._id,

        teamId: team.teamId,

        registrationId: registration.registrationId,

        amount: payment.amount,

        status: payment.status,

        screenshotUrl: payment.screenshotUrl,
      },
    });
  } catch (error) {
    console.error(
      "Team payment submission error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to submit team payment",
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "PAYMENT_SUBMITTED") {
      return res.status(400).json({
        success: false,
        message: "Payment is not awaiting verification",
      });
    }

    payment.status = "PAYMENT_VERIFIED";
    payment.verifiedBy = req.user.userId;
    payment.verifiedAt = new Date();

    await payment.save();

    const registration = await Registration.findById(
      payment.registrationId
    );

    if (registration) {
      registration.paymentStatus = "PAYMENT_VERIFIED";
      await registration.save();

      // Team payment
      if (
        registration.registrationType === "TEAM" &&
        registration.teamId
      ) {
        await Team.findByIdAndUpdate(
          registration.teamId,
          {
            status: "PAYMENT_VERIFIED",
          }
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment,
    });
  } catch (error) {
    console.error("Verify payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


const rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "PAYMENT_SUBMITTED") {
      return res.status(400).json({
        success: false,
        message: "Payment is not awaiting verification",
      });
    }

    payment.status = "PAYMENT_REJECTED";
    payment.rejectedBy = req.user.userId;
    payment.rejectedAt = new Date();
    payment.rejectionReason = rejectionReason || "";

    await payment.save();

    const registration = await Registration.findById(
      payment.registrationId
    );

    if (registration) {
      registration.paymentStatus = "PAYMENT_REJECTED";
      await registration.save();
    }

    return res.status(200).json({
      success: true,
      message: "Payment rejected successfully",
      payment,
    });
  } catch (error) {
    console.error("Reject payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  submitPayment,
  verifyPayment,
  rejectPayment,
  submitTeamPayment,
};