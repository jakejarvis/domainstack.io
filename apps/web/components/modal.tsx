"use client";

import type { ComponentPropsWithoutRef } from "react";

import { useRouter } from "@/hooks/use-router";
import {
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalPortal,
  Modal as ModalPrimitive,
  ModalTitle,
} from "@domainstack/ui/modal";

type ModalProps = ComponentPropsWithoutRef<typeof ModalPrimitive>;

/**
 * Modal that auto-closes via router.back().
 * Used for intercepted routes in Next.js App Router.
 */
function Modal({ onOpenChange, ...props }: ModalProps) {
  const router = useRouter();

  return (
    <ModalPrimitive
      open
      onOpenChange={(open, eventDetails) => {
        if (!open) {
          router.back();
        }
        onOpenChange?.(open, eventDetails);
      }}
      {...props}
    />
  );
}

export {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalPortal,
  ModalTitle,
};
