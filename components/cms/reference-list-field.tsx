"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";

export interface ReferenceOption {
  id: string;
  label: string;
  /** Shown after the label, e.g. "Draft", so an editor knows it is not live. */
  note?: string;
}

/**
 * An ordered list of picked records: related posts, a homepage collection.
 *
 * Order is the point — "read next" and a hand-built collection both display
 * in the order chosen — so this is a list with up/down buttons rather than a
 * multi-select, for the same reason the block editor has no drag handles:
 * buttons work with a keyboard and on touch.
 *
 * Like `ImageField`, it owns its state and takes `defaultValue`. With a `name`
 * it posts one hidden input per id (read with `formData.getAll`); inside the
 * block editor it reports through `onValueChange` instead.
 */
export function ReferenceListField({
  name,
  label,
  hint,
  options,
  defaultValue = [],
  max,
  emptyLabel = "Nothing picked yet.",
  onValueChange,
}: {
  name?: string;
  label: string;
  hint?: string;
  options: ReferenceOption[];
  defaultValue?: string[];
  max?: number;
  emptyLabel?: string;
  onValueChange?: (ids: string[]) => void;
}) {
  const selectId = useId();
  const [ids, setIds] = useState<string[]>(defaultValue);

  const byId = new Map(options.map((option) => [option.id, option]));
  const remaining = options.filter((option) => !ids.includes(option.id));
  const full = max !== undefined && ids.length >= max;

  function update(next: string[]) {
    setIds(next);
    onValueChange?.(next);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>{label}</Label>

      {ids.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ol className="divide-y divide-border rounded-md border border-border">
          {ids.map((id, index) => {
            const option = byId.get(id);
            const text = option?.label ?? "Missing record";
            return (
              <li key={id} className="flex items-center gap-1 px-2 py-1.5 text-sm">
                {name ? <input type="hidden" name={name} value={id} /> : null}
                <span className="min-w-0 flex-1 truncate">
                  {text}
                  {option?.note ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      · {option.note}
                    </span>
                  ) : null}
                  {!option ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      · deleted, will be dropped on save
                    </span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${text} up`}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => move(index, 1)}
                  disabled={index === ids.length - 1}
                  aria-label={`Move ${text} down`}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => update(ids.filter((other) => other !== id))}
                  aria-label={`Remove ${text}`}
                >
                  <X className="size-4" />
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      <Select
        id={selectId}
        value=""
        disabled={full || remaining.length === 0}
        onChange={(event) => {
          if (event.target.value) update([...ids, event.target.value]);
        }}
      >
        <option value="">
          {full
            ? `Limit of ${max} reached`
            : remaining.length === 0
              ? "Nothing else to add"
              : "Add…"}
        </option>
        {remaining.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
            {option.note ? ` (${option.note})` : ""}
          </option>
        ))}
      </Select>

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
