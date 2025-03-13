// src/utils/email.ts
import dotenv from "dotenv";
import nodemailer, { Transporter } from "nodemailer";
import { SentMessageInfo } from "nodemailer/lib/smtp-transport";

dotenv.config();

interface EmailOptions {
  email: string;
  subject: string;
  message?: string;
  html?: string;
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
  // Validate environment variables
  if (
    !process.env.NODEMAILER_EMAIL_USER ||
    !process.env.NODEMAILER_EMAIL_PASS
  ) {
    throw new Error(
      "Email credentials not configured in environment variables"
    );
  }

  const transporter: Transporter<SentMessageInfo> = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.NODEMAILER_EMAIL_USER,
      pass: process.env.NODEMAILER_EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `${process.env.NODEMAILER_EMAIL_NAME || "WeBuy"} <${
      process.env.NODEMAILER_EMAIL_USER
    }>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Failed to send email");
  }
};

export default sendEmail;
