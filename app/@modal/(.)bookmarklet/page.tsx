import { BookmarksSimpleIcon } from "@phosphor-icons/react/ssr";
import { BookmarkletContent } from "@/components/bookmarklet/bookmarklet-content";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";

export default function InterceptedBookmarkletPage() {
  return (
    <Modal>
      <ModalContent className="!max-w-lg">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <BookmarksSimpleIcon className="size-5" />
            Bookmarklet
          </ModalTitle>
          <ModalDescription>
            Use these shortcuts to investigate domains from anywhere.
          </ModalDescription>
        </ModalHeader>
        <div className="min-w-0 p-4 [contain:inline-size]">
          <BookmarkletContent />
        </div>
      </ModalContent>
    </Modal>
  );
}
