"use client";

import { useId, useState, type SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/custom/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPositionTag,
  updatePositionTag,
} from "@/server/position-tags/actions";
import { POSITION_TAG_COLORS } from "@/types/enums";
import type { PositionTag } from "@/server/position-tags/types";
import { usePositionTags } from "./provider";
import { TagBadge } from "./tag-badge";

export function TagEditorDialog({
  tag,
  defaultName = "",
  onClose,
  onSaved,
}: {
  tag?: PositionTag;
  defaultName?: string;
  onClose: () => void;
  onSaved?: (tag: PositionTag) => void | Promise<void>;
}) {
  const state = usePositionTags()!;
  const id = useId();
  const [name, setName] = useState(tag?.name ?? defaultName);
  const [color, setColor] = useState(tag?.color ?? "blue");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<PositionTag | null>(null);
  const [unknown, setUnknown] = useState(false);
  const isDirty = !tag || name.trim() !== tag.name || color !== tag.color;
  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
    setPending(true);
    setError(null);
    try {
      let savedTag = saved;
      // Lost responses must be reconciled before another mutation is attempted.
      if (unknown) {
        const { tags } = await state.refresh();
        setUnknown(false);
        // A lost create may have committed; adopt it instead of inserting a duplicate.
        const trimmedName = name.trim().toLowerCase();
        if (!tag && !savedTag)
          savedTag =
            tags.find((value) => value.name.toLowerCase() === trimmedName) ??
            null;
      }
      if (!savedTag) {
        const selectedColor =
          POSITION_TAG_COLORS.find((value) => value === color) ?? "blue";
        let result;
        try {
          result = tag
            ? await updatePositionTag({
                id: tag.id,
                name,
                color: selectedColor,
              })
            : await createPositionTag({ name, color: selectedColor });
        } catch {
          setUnknown(true);
          throw new Error(
            "The save outcome is unknown. Refresh tags before retrying.",
          );
        }
        if (!result.success) {
          setUnknown(result.outcomeUnknown);
          setError(result.message);
          return;
        }
        savedTag = result.tag;
        setSaved(savedTag);
      }
      await state.refresh();
      await onSaved?.(savedTag);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save this tag.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{tag ? "Edit tag" : "Create tag"}</DialogTitle>
          <DialogDescription>
            {tag
              ? "Changes apply everywhere this tag is used."
              : "Create a reusable label for your assets."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
                <Input
                  id={`${id}-name`}
                  value={name}
                  maxLength={64}
                  required
                  disabled={pending || Boolean(saved)}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Dad, Retirement, Technology"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-color`}>Color</FieldLabel>
                <Select
                  value={color}
                  onValueChange={setColor}
                  disabled={pending || Boolean(saved)}
                >
                  <SelectTrigger id={`${id}-color`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {POSITION_TAG_COLORS.map((value) => (
                        <SelectItem key={value} value={value}>
                          <TagBadge
                            tag={{
                              name:
                                value.charAt(0).toUpperCase() + value.slice(1),
                              color: value,
                            }}
                          />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {error && (
                <FieldError role="alert">
                  {saved ? "Tag saved. " : ""}
                  {error}
                </FieldError>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !name.trim() || !isDirty}
            >
              {pending && <Spinner />}
              {saved && error
                ? "Refresh tags"
                : unknown
                  ? "Refresh and retry"
                  : tag
                    ? "Save tag"
                    : "Create tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
