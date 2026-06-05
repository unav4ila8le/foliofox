"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircleIcon } from "lucide-react";

import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/custom/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { deleteAccount } from "@/server/auth/delete-account";

interface DeleteAccountDialogProps {
  email: string;
  disabled?: boolean;
}

export function DeleteAccountDialog({
  email,
  disabled = false,
}: DeleteAccountDialogProps) {
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const router = useRouter();

  const isLoading = isDeleting || isNavigating;
  const canDeleteAccount =
    confirmationEmail.trim().toLowerCase() === email.trim().toLowerCase();

  function handleOpenChange(open: boolean) {
    if (!open) {
      setConfirmationEmail("");
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);

    try {
      const result = await deleteAccount(confirmationEmail);

      if (!result.success) {
        toast.error("Account deletion failed", {
          description: result.message,
        });
        return;
      }

      toast.success("Account deleted");
      startNavigation(() => {
        router.replace("/auth/login");
        router.refresh();
      });
    } catch (error) {
      toast.error("Account deletion failed", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="xs"
          className="mt-3"
          variant="secondary"
          disabled={disabled}
        >
          Delete account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            Permanently deleting your account will remove all your portfolio
            data, settings, and public portfolio access. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="text-destructive flex items-center gap-2 rounded-lg bg-red-50 p-2">
            <AlertCircleIcon className="size-4" />
            <p className="text-sm font-medium">
              This action is not reversible. Please be certain.
            </p>
          </div>

          <FieldGroup className="mt-4 gap-4">
            <p className="text-sm">
              Enter your email address below to confirm that you want to delete
              your account.
            </p>
            <Field>
              <FieldLabel htmlFor="delete-account-email">
                Email address
              </FieldLabel>
              <Input
                id="delete-account-email"
                type="email"
                value={confirmationEmail}
                onChange={(event) => setConfirmationEmail(event.target.value)}
                autoComplete="email"
                disabled={isLoading}
                placeholder={email}
              />
            </Field>
          </FieldGroup>
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={!canDeleteAccount || isLoading}
            onClick={handleDeleteAccount}
          >
            {isLoading ? (
              <>
                <Spinner />
                Deleting...
              </>
            ) : (
              "Delete account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
