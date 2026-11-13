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
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const videoId = draftVideoId ?? activeVideoId;

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedVideoId = videoId.trim();

    if (!UUID_PATTERN.test(normalizedVideoId)) {
      setMessage({
        type: "error",
        text: "Enter a valid video UUID.",
      });
      return;
    }

    setActiveVideoId(normalizedVideoId);
    setDraftVideoId(null);
    setMessage({
      type: "success",
      text: "Video source saved.",
    });
  }

  function handleDisconnect() {
    setActiveVideoId("");
    setDraftVideoId("");
    setMessage({
      type: "success",
      text: "Video source disconnected.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Preferences"
        description="Appearance and local workspace configuration."
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <section className="grid gap-5 p-5 md:grid-cols-[minmax(13rem,0.45fr)_minmax(0,1fr)] md:items-center">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
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
          <div>
            <ThemeSelector />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/35 px-5 py-3">
          <p className="text-xs font-medium text-muted-foreground">
            Local development
          </p>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Database aria-hidden="true" className="size-4.5" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight">
                Active video source
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Temporary UUID selection until media import is available.
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
              aria-invalid={
                message?.type === "error" ? true : undefined
              }
              aria-describedby={
                message
                  ? "settings-video-id-help settings-video-id-message"
                  : "settings-video-id-help"
              }
              className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-xs outline-none transition-[border-color,box-shadow] duration-[var(--motion-feedback)] placeholder:text-muted-foreground/55 focus:border-primary/60 focus:ring-3 focus:ring-primary/12"
            />
            <p
              id="settings-video-id-help"
              className="mt-2 text-xs leading-5 text-muted-foreground"
            >
              Use a video UUID already stored in the local database.
            </p>

            {message ? (
              <p
                id="settings-video-id-message"
                role={message.type === "error" ? "alert" : "status"}
                className={
                  message.type === "error"
                    ? "mt-2 text-xs text-destructive"
                    : "mt-2 text-xs text-muted-foreground"
                }
              >
                {message.text}
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
          <div className="mt-5 flex gap-3 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <p>
              Media routes are local and unauthenticated. Keep this
              workspace private until account ownership is connected.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
