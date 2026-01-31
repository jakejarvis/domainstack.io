import { Button, Section } from "@react-email/components";

type EmailButtonProps = {
  href: string;
  variant?: "primary" | "secondary" | "danger" | "success";
  children: React.ReactNode;
};

export function EmailButton({
  href,
  variant = "primary",
  children,
}: EmailButtonProps) {
  const buttonStyles = {
    primary: primaryButtonStyle,
    secondary: secondaryButtonStyle,
    danger: dangerButtonStyle,
    success: successButtonStyle,
  };

  return (
    <Section style={buttonContainer}>
      <Button style={buttonStyles[variant]} href={href}>
        {children}
      </Button>
    </Section>
  );
}

// Container style
const buttonContainer = {
  padding: "0 40px",
  marginTop: "28px",
  textAlign: "center" as const,
};

// Button variant styles
const primaryButtonStyle = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const secondaryButtonStyle = {
  backgroundColor: "transparent",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  color: "#374151",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "13px 32px",
};

const dangerButtonStyle = {
  backgroundColor: "#dc2626",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const successButtonStyle = {
  backgroundColor: "#10b981",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};
