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

export interface AutomatedEmailBatchSendResult {
  provider: "resend";
  messageIds: Array<string | null>;
}

export interface AutomatedEmailSender {
  sendEmail(message: AutomatedEmailMessage): Promise<AutomatedEmailSendResult>;
  sendEmailBatch?(
    messages: AutomatedEmailMessage[],
  ): Promise<AutomatedEmailBatchSendResult>;
}

interface ResendErrorLike {
  message: string;
  name?: string;
  statusCode?: number | null;
}

function createResendProviderError(error: ResendErrorLike) {
  const providerError = new Error(error.message) as Error & {
    statusCode?: number | null;
  };
  providerError.name = error.name ?? "ResendProviderError";
  providerError.statusCode = error.statusCode ?? null;

  return providerError;
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
        throw createResendProviderError(error);
      }

      return {
        provider: "resend",
        messageId: data?.id ?? null,
      };
    },
    async sendEmailBatch(messages) {
      if (messages.length === 0) {
        return {
          provider: "resend",
          messageIds: [],
        };
      }

      const { data, error } = await resendClient.batch.send(
        messages.map((message) => ({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          react: message.react,
        })),
      );

      if (error) {
        throw createResendProviderError(error);
      }

      const messageIds = data?.data.map((message) => message.id) ?? [];
      if (messageIds.length !== messages.length) {
        throw new Error("Resend batch response did not match request size");
      }

      return {
        provider: "resend",
        messageIds,
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
