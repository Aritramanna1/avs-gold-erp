import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sign in with Google button — light theme per Google Identity branding guidelines.
 * https://developers.google.com/identity/branding-guidelines
 *
 * - Multicolor Google "G" on white tile (never monochrome / tinted fill)
 * - Light fill #FFFFFF, stroke #747775, text #1F1F1F
 * - Approved CTA: "Continue with Google" | "Sign in with Google" | "Sign up with Google"
 */
export function GoogleSignInButton({
  onClick,
  disabled,
  busy,
  label = "Continue with Google",
  className,
  "data-testid": testId = "auth-google",
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  label?: "Continue with Google" | "Sign in with Google" | "Sign up with Google";
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || busy}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "h-10 w-full gap-3 border-[#747775] bg-[#FFFFFF] text-[14px] font-medium leading-5 text-[#1F1F1F]",
        "hover:bg-[#F8F9FA] hover:text-[#1F1F1F]",
        "disabled:opacity-60",
        // Approximate Google Sans Medium when the font is unavailable.
        "font-[Roboto,Arial,Helvetica,sans-serif]",
        className,
      )}
    >
      <OfficialGoogleG className="h-5 w-5 shrink-0" />
      <span>{busy ? "Connecting…" : label}</span>
    </Button>
  );
}

/** Official multicolor Google G — do not recolor or place on non-white tile. */
function OfficialGoogleG({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-sm bg-white",
        className,
      )}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    </span>
  );
}
