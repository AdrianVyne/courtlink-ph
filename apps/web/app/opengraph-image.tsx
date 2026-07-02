import { ImageResponse } from "next/og";

export const alt = "CourtLink PH — pickleball courts and coaches across the Philippines";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        backgroundColor: "#0d2b1c",
        position: "relative",
      }}
    >
      {/* Court-line motif, cropped off the right edge */}
      <svg
        aria-hidden="true"
        fill="none"
        height="560"
        style={{ position: "absolute", right: -140, top: 35, opacity: 0.35 }}
        viewBox="0 0 440 200"
        width="1232"
      >
        <rect height="184" stroke="#d8f36b" strokeWidth="1.5" width="424" x="8" y="8" />
        <line stroke="#d8f36b" strokeWidth="1.5" x1="220" x2="220" y1="8" y2="192" />
        <line stroke="#d8f36b" strokeWidth="1.5" x1="156" x2="156" y1="8" y2="192" />
        <line stroke="#d8f36b" strokeWidth="1.5" x1="284" x2="284" y1="8" y2="192" />
        <line stroke="#d8f36b" strokeWidth="1.5" x1="8" x2="156" y1="100" y2="100" />
        <line stroke="#d8f36b" strokeWidth="1.5" x1="284" x2="432" y1="100" y2="100" />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 88,
            height: 88,
            borderRadius: 20,
            backgroundColor: "#d8f36b",
            color: "#0d2b1c",
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          CL
        </div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: "#ffffff" }}>
          CourtLink PH
        </div>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 36,
          fontSize: 36,
          color: "#f3f1ea",
          maxWidth: 760,
          lineHeight: 1.35,
        }}
      >
        Book pickleball courts and coaches across the Philippines — pay venues directly, no markup.
      </div>
      <div style={{ display: "flex", marginTop: 40, gap: 14 }}>
        {["GCash", "Maya", "QR Ph", "Bank transfer"].map((method) => (
          <div
            key={method}
            style={{
              display: "flex",
              padding: "10px 24px",
              borderRadius: 999,
              border: "2px solid rgba(216, 243, 107, 0.5)",
              color: "#e5f795",
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            {method}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  );
}
