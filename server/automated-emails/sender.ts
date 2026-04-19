import type { ReactElement } from "react";
import { Resend } from "resend";

export interface AutomatedEmailMessage {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  react?: ReactElement;
}

export interface AutomatedEmailSendResult {
  provider: "resend";
  messageId: string | null;
}

export interface AutomatedEmailSender {
  sendEmail(message: AutomatedEmailMessage): Promise<AutomatedEmailSendResult>;
}

function createResendAutomatedEmailSender(
  apiKey: string,
): AutomatedEmailSender {
  const resendClient = new Resend(apiKey);

  return {
    async sendEmail(message) {
      const { data, error } = await resendClient.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        react: message.react,
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        provider: "resend",
        messageId: data?.id ?? null,
      };
    },
  };
}

/**
 * Build the default automated-email sender for the configured provider.
 * The interface is provider-shaped so an SMTP adapter can replace this
 * factory without touching callers.
 */
export function createAutomatedEmailSender(): AutomatedEmailSender {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (!resendApiKey) {
    throw new Error("Missing RESEND_API_KEY for automated email sending");
  }

  return createResendAutomatedEmailSender(resendApiKey);
}
