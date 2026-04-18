import type { AutomatedEmailDigest } from "@/server/automated-emails/digest";

export interface AutomatedEmailTemplateLinks {
  dashboardUrl: string;
  settingsUrl: string;
  unsubscribeUrl: string;
}

export interface AutomatedEmailTemplateProps {
  username?: string | null;
  digest: AutomatedEmailDigest;
  links: AutomatedEmailTemplateLinks;
  reasonText: string;
}
