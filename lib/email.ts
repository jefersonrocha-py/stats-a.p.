import "server-only";

import nodemailer from "nodemailer";

type EmailPayload = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

const globalForEmail = global as unknown as {
  emailTransporter?: ReturnType<typeof nodemailer.createTransport>;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEmailTransporter() {
  if (!globalForEmail.emailTransporter) {
    const host = getRequiredEnv("EMAIL_TRANSPORT_DEFAULT_HOST");
    const port = Number(process.env.EMAIL_TRANSPORT_DEFAULT_PORT ?? 587);
    const username = getRequiredEnv("EMAIL_TRANSPORT_DEFAULT_USERNAME");
    const password = getRequiredEnv("EMAIL_TRANSPORT_DEFAULT_PASSWORD");
    const requireTls = process.env.EMAIL_TRANSPORT_DEFAULT_TLS === "true";

    globalForEmail.emailTransporter = nodemailer.createTransport({
      auth: {
        pass: password,
        user: username,
      },
      host,
      port: Number.isFinite(port) ? port : 587,
      requireTLS: requireTls,
      secure: port === 465,
    });
  }

  return globalForEmail.emailTransporter;
}

function getFromAddress() {
  return (
    process.env.EMAIL_DEFAULT_FROM?.trim() ||
    process.env.PASSBOLT_KEY_EMAIL?.trim() ||
    process.env.EMAIL_TRANSPORT_DEFAULT_USERNAME?.trim()
  );
}

export async function sendMail(payload: EmailPayload) {
  const from = getFromAddress();
  if (!from) {
    throw new Error("Missing sender address configuration.");
  }

  await getEmailTransporter().sendMail({
    from,
    html: payload.html,
    subject: payload.subject,
    text: payload.text,
    to: payload.to,
  });
}
