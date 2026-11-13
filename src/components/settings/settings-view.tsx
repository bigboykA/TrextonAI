"use client";

import {
  Database,
  LockKeyhole,
  Save,
  Unplug,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function SettingsView() {
  const { activeVideoId, setActiveVideoId } = useWorkspace();
  const [draftVideoId, setDraftVideoId] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState<string | null>(null);
  const videoId = draftVideoId ?? activeVideoId;

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedVideoId = videoId.trim();

    if (!UUID_PATTERN.test(normalizedVideoId)) {
      setMessage("Enter a valid video UUID.");
      return;
    }

    setActiveVideoId(normalizedVideoId);
    setDraftVideoId(null);
    setMessage("Video source saved.");
  }

  function handleDisconnect() {
    setActiveVideoId("");
    setDraftVideoId("");
    setMessage("Video source disconnected.");
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Settings"
        title="A few things, exactly your way."
        description="Set the atmosphere and choose which local recording Trexton should hold in view."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <BrandMark className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight">
                Appearance
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Quietly remembered on this device.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <ThemeSelector />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Database aria-hidden="true" className="size-4.5" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight">
                Source recording
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The recording held across Home, Clips, and Activity.
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="mt-6">
            <label
              htmlFor="settings-video-id"
              className="text-sm font-medium"
            >
              Video UUID
            </label>
            <input
              id="settings-video-id"
              value={videoId}
              onChange={(event) => {
                setDraftVideoId(event.target.value);
                setMessage(null);
              }}
              placeholder="00000000-0000-0000-0000-000000000000"
              spellCheck={false}
              className="mt-2 h-11 w-full rounded-2xl border border-input bg-background px-4 font-mono text-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/55 focus:border-primary/60 focus:ring-3 focus:ring-primary/12"
            />

            {message ? (
              <p
                role="status"
                className="mt-2 text-xs text-muted-foreground"
              >
                {message}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="submit">
                <Save data-icon="inline-start" aria-hidden="true" />
                Save source
              </Button>
              {activeVideoId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDisconnect}
                >
                  <Unplug
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                  Disconnect
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      </div>

      <section className="flex gap-4 rounded-3xl border border-border/70 bg-muted/45 p-5 sm:p-6">
        <LockKeyhole
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div>
          <h2 className="text-sm font-semibold">
            Local development notice
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Media access is still local and unauthenticated. Keep this
            preview private until account ownership and route protection
            are in place.
          </p>
        </div>
      </section>
    </div>
  );
}
