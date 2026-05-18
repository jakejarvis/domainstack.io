// Provider-agnostic, shared across every billing provider. Provider-specific
// code lives behind subpath exports (`@domainstack/billing/polar`,
// `@domainstack/billing/revenuecat`) so importing one provider never pulls in
// another provider's SDK.
export * from "./emails";
