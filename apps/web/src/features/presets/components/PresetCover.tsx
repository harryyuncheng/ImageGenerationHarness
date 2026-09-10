import { ImageOff, TextQuote } from 'lucide-react';
import { useState } from 'react';

export function PresetCover({ src, alt }: { src: string | undefined; alt: string }) {
  const [failedSource, setFailedSource] = useState<string>();

  if (src && src !== failedSource) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => {
          setFailedSource(src);
        }}
      />
    );
  }

  return (
    <span className="preset-cover-placeholder">
      {src ? <ImageOff size={26} /> : <TextQuote size={32} strokeWidth={1} />}
      <span>{src ? 'Preview unavailable' : 'No cover image'}</span>
    </span>
  );
}
