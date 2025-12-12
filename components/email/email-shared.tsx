import { Heading, Hr, Link, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

type EmailHeadingProps = {
  children: ReactNode;
};

export function EmailHeading({ children }: EmailHeadingProps) {
  return <Heading style={h1}>{children}</Heading>;
}

type EmailSubheadingProps = {
  children: ReactNode;
};

export function EmailSubheading({ children }: EmailSubheadingProps) {
  return (
    <Heading as="h2" style={h2}>
      {children}
    </Heading>
  );
}

type EmailTextProps = {
  children: ReactNode;
};

export function EmailText({ children }: EmailTextProps) {
  return <Text style={text}>{children}</Text>;
}

type EmailMutedTextProps = {
  children: ReactNode;
};

export function EmailMutedText({ children }: EmailMutedTextProps) {
  return <Text style={mutedText}>{children}</Text>;
}

type EmailHrProps = Record<string, never>;

export function EmailHr(_props: EmailHrProps) {
  return <Hr style={hr} />;
}

type EmailFooterProps = {
  children: ReactNode;
};

export function EmailFooter({ children }: EmailFooterProps) {
  return <Text style={footer}>{children}</Text>;
}

type EmailLinkProps = {
  href: string;
  children: ReactNode;
};

export function EmailLink({ href, children }: EmailLinkProps) {
  return (
    <Link href={href} style={link}>
      {children}
    </Link>
  );
}

type EmailFieldLabelProps = {
  children: ReactNode;
};

export function EmailFieldLabel({ children }: EmailFieldLabelProps) {
  return <Text style={fieldLabel}>{children}</Text>;
}

type EmailCodeTextProps = {
  children: ReactNode;
};

export function EmailCodeText({ children }: EmailCodeTextProps) {
  return <Text style={codeText}>{children}</Text>;
}

type EmailNoteTextProps = {
  children: ReactNode;
};

export function EmailNoteText({ children }: EmailNoteTextProps) {
  return <Text style={noteText}>{children}</Text>;
}

type EmailSectionProps = {
  children: ReactNode;
  variant?: "default" | "option" | "code" | "secondaryButton";
};

export function EmailSection({
  children,
  variant = "default",
}: EmailSectionProps) {
  const sectionStyles = {
    default: defaultSection,
    option: optionSection,
    code: codeSection,
    secondaryButton: secondaryButtonSection,
  };

  return <Section style={sectionStyles[variant]}>{children}</Section>;
}

// Styles
const h1 = {
  color: "#1f2937",
  fontSize: "22px",
  fontWeight: "600",
  lineHeight: "1.4",
  margin: "0 0 24px",
  padding: "0 40px",
};

const h2 = {
  color: "#1f2937",
  fontSize: "16px",
  fontWeight: "600",
  lineHeight: "1.4",
  margin: "0 0 12px",
  padding: "0 40px",
};

const text = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "0 0 16px",
  padding: "0 40px",
};

const mutedText = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "16px 0 0",
  padding: "0 40px",
  textAlign: "center" as const,
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "32px 40px",
};

const footer = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0",
  padding: "0 40px",
};

const link = {
  color: "#2563eb",
  textDecoration: "underline",
};

const fieldLabel = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "500",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "12px 0 4px",
  padding: "0",
};

const codeText = {
  backgroundColor: "#f3f4f6",
  borderRadius: "6px",
  color: "#1f2937",
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 8px",
  padding: "10px 12px",
  wordBreak: "break-all" as const,
};

const noteText = {
  color: "#6b7280",
  fontSize: "13px",
  fontStyle: "italic" as const,
  lineHeight: "1.5",
  margin: "12px 0 0",
  padding: "0 40px",
};

const defaultSection = {
  margin: "0",
  padding: "0",
};

const optionSection = {
  margin: "0",
  padding: "0",
};

const codeSection = {
  padding: "0 40px",
};

const secondaryButtonSection = {
  padding: "0 40px",
  marginTop: "12px",
  textAlign: "center" as const,
};
