/**
 * Dynamic OG Image Generation using next/og (Vercel OG).
 *
 * Generates dynamic Open Graph images for:
 * - Courses: /api/og?type=course&title=...&instructor=...
 * - Profiles: /api/og?type=profile&name=...&role=...
 * - Projects: /api/og?type=project&title=...&budget=...
 * - Pages: /api/og?type=page&title=...&description=...
 *
 * Falls back to a branded default image if parameters are missing.
 */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BRAND_NAME = "Podacium";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type") || "page";
  const title = searchParams.get("title") || "Podacium";
  const description =
    searchParams.get("description") ||
    "Education, Freelancing & Business Intelligence";
  const instructor = searchParams.get("instructor") || "";
  const name = searchParams.get("name") || "";
  const role = searchParams.get("role") || "";
  const budget = searchParams.get("budget") || "";

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        backgroundImage:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        fontFamily: "sans-serif",
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
        }}
      />

      {/* Logo area */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "16px",
            fontSize: "24px",
            color: "white",
            fontWeight: "bold",
          }}
        >
          P
        </div>
        <span style={{ color: "#94a3b8", fontSize: "24px", fontWeight: 500 }}>
          {BRAND_NAME}
        </span>
      </div>

      {/* Content type badge */}
      {type !== "page" && (
        <div
          style={{
            display: "flex",
            padding: "6px 16px",
            borderRadius: "20px",
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              color: "#60a5fa",
              fontSize: "14px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {type === "course"
              ? "📚 Course"
              : type === "profile"
                ? "👤 Profile"
                : type === "project"
                  ? "💼 Project"
                  : "📄 Page"}
          </span>
        </div>
      )}

      {/* Title */}
      <div
        style={{
          display: "flex",
          fontSize: title.length > 40 ? "42px" : "56px",
          fontWeight: "bold",
          color: "white",
          textAlign: "center",
          maxWidth: "900px",
          lineHeight: 1.2,
          marginBottom: "16px",
        }}
      >
        {title}
      </div>

      {/* Subtitle / Description */}
      <div
        style={{
          display: "flex",
          fontSize: "22px",
          color: "#94a3b8",
          textAlign: "center",
          maxWidth: "700px",
          lineHeight: 1.4,
        }}
      >
        {type === "course" && instructor
          ? `By ${instructor}`
          : type === "profile" && role
            ? role
            : type === "project" && budget
              ? `Budget: ${budget}`
              : description}
      </div>

      {/* Bottom branding */}
      <div
        style={{
          position: "absolute",
          bottom: "40px",
          display: "flex",
          alignItems: "center",
          color: "#64748b",
          fontSize: "16px",
        }}
      >
        podacium.com
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
