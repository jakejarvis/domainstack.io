import * as Burnt from "burnt";

type ToastInput = string | { title: string; message?: string };

function normalize(input: ToastInput): { title: string; message?: string } {
  return typeof input === "string" ? { title: input } : input;
}

export const toast = {
  success(input: ToastInput) {
    const { title, message } = normalize(input);
    return Burnt.toast({
      title,
      message,
      preset: "done",
      haptic: "success",
      duration: 2,
      from: "top",
    });
  },

  error(input: ToastInput) {
    const { title, message } = normalize(input);
    return Burnt.toast({
      title,
      message,
      preset: "error",
      haptic: "error",
      duration: 3,
      from: "top",
    });
  },

  info(input: ToastInput) {
    const { title, message } = normalize(input);
    return Burnt.toast({
      title,
      message,
      preset: "none",
      haptic: "none",
      duration: 2,
      from: "top",
    });
  },

  warning(input: ToastInput) {
    const { title, message } = normalize(input);
    return Burnt.toast({
      title,
      message,
      preset: "none",
      haptic: "warning",
      duration: 3,
      from: "top",
    });
  },

  loading(input: ToastInput, { duration = 30 }: { duration?: number } = {}) {
    const { title, message } = normalize(input);
    return Burnt.alert({
      preset: "spinner",
      title,
      message,
      duration,
    });
  },

  dismiss() {
    return Burnt.dismissAllAlerts();
  },
};
