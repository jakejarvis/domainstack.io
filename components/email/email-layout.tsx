import { Body, Container, Head, Html, Preview } from "@react-email/components";
import type { ReactNode } from "react";

type EmailLayoutProps = {
  previewText: string;
  children: ReactNode;
};

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <div style={logoContainer}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              fill="none"
              style={logo}
            >
              <path
                fill="#4a90d9"
                d="M273.04,470.6c-8.73-.09-17.66-.45-26.49-1.07-137.38-9.68-213.38-67.84-216.54-70.31-6.17-4.83-9.71-12.11-9.71-19.98v-216.47c0-11.15,7.14-20.94,17.76-24.37,1.45-.46,2.75-.69,3.96-.69,5.98,0,15.23,6.19,26.93,14.03l3.15,2.11c6.76,6,22.06,17.39,49.74,27.72,36.7,13.69,81.85,20.64,134.18,20.64,68.38,0,110.84-8.69,137.66-28.17,7.8-5.67,12.42-14.82,12.35-24.45-.07-9.64-4.8-18.72-12.67-24.28-31.04-21.97-77.25-33.1-137.35-33.1-6.82,0-13.23-2.68-18.05-7.54-4.8-4.86-7.41-11.3-7.34-18.13.14-13.85,11.92-25.12,26.26-25.12,45.84.08,85.92,6.37,119.13,18.7,26.07,9.68,47.97,23.09,65.08,39.86,30.63,30.01,33.86,39.68,34.76,57.79.35,7.06-.96,12.36-5.19,21.02-1.44,2.47-16.85,20.38-49.08,37.89-44.43,24.13-100.14,36.37-165.58,36.37s-140.06-20.37-148.63-22.7l-36.28-9.66v145.69l15.27,8.09c26.71,14.15,83.51,38.73,163.75,44.38,9.01.63,18.16.95,27.18.95,104.15,0,171.62-41.45,175.35-43.79h0c4.05-2.55,8.75-3.89,13.57-3.89,8.78,0,16.81,4.36,21.48,11.67,7.49,11.72,4.16,27.36-7.43,34.86-3.27,2.13-81.42,51.97-202.83,51.97h-4.41Z"
              />
            </svg>
          </div>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  padding: "40px 0",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px 0 40px",
  borderRadius: "12px",
  maxWidth: "560px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const logoContainer = {
  textAlign: "center" as const,
  padding: "0 40px",
  marginBottom: "24px",
};

const logo = {
  height: "48px",
  width: "auto",
  display: "inline-block",
};
