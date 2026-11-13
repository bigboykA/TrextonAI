type ClipPlayerProps = {
  src: string;
  title: string;
};

export function ClipPlayer({ src, title }: ClipPlayerProps) {
  return (
    <section
      aria-label="Clip player"
      className="overflow-hidden rounded-xl border border-border bg-black"
    >
      <video
        className="aspect-video size-full bg-black object-contain"
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
      />
    </section>
  );
}
