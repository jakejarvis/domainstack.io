import { Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

type EmailBoxProps = {
  variant: "info" | "warning" | "success" | "tip" | "danger";
  children: ReactNode;
};

export function EmailBox({ variant, children }: EmailBoxProps) {
  const boxStyles = {
    info: infoBoxStyle,
    warning: warningBoxStyle,
    success: successBoxStyle,
    tip: tipBoxStyle,
    danger: dangerBoxStyle,
  };

  return (
    <Section style={boxWrapper}>
      <Section style={boxStyles[variant]}>{children}</Section>
    </Section>
  );
}

type EmailBoxTextProps = {
  variant: "info" | "warning" | "success" | "tip" | "danger";
  children: ReactNode;
  strong?: boolean;
};

export function EmailBoxText({
  variant,
  children,
  strong = false,
}: EmailBoxTextProps) {
  const textStyles = {
    info: infoTextStyle,
    warning: warningTextStyle,
    success: successTextStyle,
    tip: tipTextStyle,
    danger: dangerTextStyle,
  };

  return (
    <Text style={textStyles[variant]}>
      {strong ? <strong>{children}</strong> : children}
    </Text>
  );
}

// Wrapper style
const boxWrapper = {
  padding: "8px 40px 20px",
};

// Box styles
const infoBoxStyle = {
  backgroundColor: "#f0f9ff",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #0ea5e9",
};

const warningBoxStyle = {
  backgroundColor: "#fffbeb",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #f59e0b",
};

const successBoxStyle = {
  backgroundColor: "#ecfdf5",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #10b981",
};

const tipBoxStyle = {
  backgroundColor: "#f0f9ff",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #0ea5e9",
};

const dangerBoxStyle = {
  backgroundColor: "#fef2f2",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #dc2626",
};

// Text styles
const infoTextStyle = {
  color: "#0369a1",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
  padding: "0",
};

const warningTextStyle = {
  color: "#92400e",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
  padding: "0",
};

const successTextStyle = {
  color: "#065f46",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
  padding: "0",
};

const tipTextStyle = {
  color: "#0c4a6e",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
  padding: "0",
};

const dangerTextStyle = {
  color: "#991b1b",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
  padding: "0",
};
