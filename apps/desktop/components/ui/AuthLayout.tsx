import { type ReactNode } from "react";

interface AuthLayoutProps {
  /** Content rendered in the right-hand form panel */
  children: ReactNode;
  /**
   * Path to the decorative image shown on the left panel.
   * Falls back to a CSS gradient if the image fails to load.
   * Place the file in `public/` and pass e.g. "/login-bg.jpg".
   */
  /** @default "/login-bg.png" */
  imageSrc?: string;
  imageAlt?: string;
}

/**
 * Two-column auth layout used by Login, Signup, and similar pages.
 * Left panel: decorative image (hidden on small screens).
 * Right panel: white form area with centred content.
 */
export function AuthLayout({ children, imageSrc, imageAlt = "" }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-background)", fontFamily: "var(--font-auth)" }}>
      {/* ── Left decorative panel ── */}
      <div
        className="hidden lg:block lg:w-[55%] xl:w-1/2 relative overflow-hidden flex-shrink-0"
        aria-hidden="true"
      >
        {/* Gradient fallback — matches the soft purple/blue wave palette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, #f9f0ff 0%, #dde4ff 30%, #b8c8f8 55%, #c9b8f0 75%, #f0e8ff 100%)",
          }}
        />
        {imageSrc && (
          <img
            src={imageSrc}
            alt={imageAlt}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              // Hide broken-image icon; gradient shows through
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col min-h-screen" style={{ background: "var(--color-surface)" }}>
        {children}
      </div>
    </div>
  );
}
