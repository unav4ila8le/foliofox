"use client";

import { useId, useState } from "react";
import { Plus, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/custom/search-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ManageTagsDialog } from "./manage-tags-dialog";
import { TagBadge } from "./tag-badge";
import { TagEditorDialog } from "./tag-editor-dialog";
import { usePositionTags } from "./provider";
import type { PositionTag } from "@/server/position-tags/types";

interface TagPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void | Promise<void>;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  pending?: boolean;
  // Offer `Create "name"` when the search matches no existing tag.
  allowCreate?: boolean;
  compact?: boolean;
  // Fade the trigger until its table row is hovered or focused.
  quietWhenEmpty?: boolean;
  // Show the label and a count instead of the selected badges.
  hideSelection?: boolean;
}

export function TagPicker({
  selectedIds,
  onChange,
  label = "Add tags",
  icon,
  className,
  disabled,
  pending,
  allowCreate = true,
  compact,
  quietWhenEmpty,
  hideSelection,
}: TagPickerProps) {
  const state = usePositionTags();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const tags = state?.data?.tags ?? [];
  const selected = tags.filter((tag) => selectedIds.includes(tag.id));
  const query = search.trim();
  const filtered = tags.filter((tag) =>
    tag.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const canCreate =
    allowCreate &&
    query.length > 0 &&
    !tags.some(
      (tag) => tag.name.toLocaleLowerCase() === query.toLocaleLowerCase(),
    );
  const isDisabled =
    disabled ||
    pending ||
    !state?.data ||
    state.isRefreshing ||
    Boolean(state.error);
  async function created(tag: PositionTag) {
    setSearch("");
    await onChange([...selectedIds, tag.id]);
  }
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="min-w-0"
      aria-busy={pending}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={compact ? "ghost" : "outline"}
            size="sm"
            disabled={isDisabled}
            aria-label={label}
            className={cn(
              "max-w-full justify-start",
              quietWhenEmpty &&
                !selected.length &&
                "text-muted-foreground opacity-50 focus-visible:opacity-100 [tr:focus-within_&]:opacity-100 [tr:hover_&]:opacity-100",
              className,
            )}
          >
            {pending && <Spinner />}
            {selected.length > 0 && !hideSelection ? (
              <>
                {selected.slice(0, 2).map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
                {selected.length > 2 && <span>+{selected.length - 2}</span>}
              </>
            ) : (
              <>
                {!pending && (icon ?? <Tags data-icon="inline-start" />)}
                {label}
                {hideSelection && selected.length > 0 && (
                  <Badge variant="secondary">{selected.length}</Badge>
                )}
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 max-w-[calc(100vw-2rem)] p-3"
          onClick={(event) => event.stopPropagation()}
        >
          <SearchInput
            aria-label="Search tags"
            placeholder={
              allowCreate ? "Search or create tags…" : "Search tags…"
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <fieldset
            disabled={isDisabled}
            className="flex max-h-60 min-w-0 flex-col gap-1 overflow-y-auto"
          >
            <legend className="sr-only">Tags</legend>
            {filtered.map((tag) => (
              <Label
                key={tag.id}
                htmlFor={`${id}-${tag.id}`}
                className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md p-2"
              >
                <Checkbox
                  id={`${id}-${tag.id}`}
                  aria-label={tag.name}
                  checked={selectedIds.includes(tag.id)}
                  disabled={isDisabled}
                  onCheckedChange={(checked) =>
                    void onChange(
                      checked
                        ? [...selectedIds, tag.id]
                        : selectedIds.filter((value) => value !== tag.id),
                    )
                  }
                />
                <TagBadge tag={tag} className="max-w-full min-w-0 shrink" />
              </Label>
            ))}
            {!filtered.length && (
              <p className="text-muted-foreground py-3 text-sm">
                {tags.length
                  ? "No tags match your search."
                  : allowCreate
                    ? "No tags yet. Type a name to create one."
                    : "No tags yet."}
              </p>
            )}
          </fieldset>
          <div className="flex flex-col gap-2">
            {canCreate && (
              <Button
                type="button"
                variant="outline"
                disabled={isDisabled}
                onClick={() => {
                  setOpen(false);
                  setCreating(true);
                }}
              >
                <Plus data-icon="inline-start" />
                Create “{query}”
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDisabled}
              onClick={() => {
                setOpen(false);
                setManaging(true);
              }}
            >
              <Tags data-icon="inline-start" />
              Manage tags
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {creating && (
        <TagEditorDialog
          defaultName={query}
          onClose={() => setCreating(false)}
          onSaved={created}
        />
      )}
      {managing && <ManageTagsDialog onClose={() => setManaging(false)} />}
    </div>
  );
}
