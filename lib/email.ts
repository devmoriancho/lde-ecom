import "server-only";

import { Resend } from "resend";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "E-commerce Store <onboarding@resend.dev>",
    to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error("Email sending failed:", error);
    return {
      success: false,
      message: "Unable to send email.",
    };
  }

  return {
    success: true,
    message: "Email sent successfully.",
    emailId: data?.id,
  };
}
