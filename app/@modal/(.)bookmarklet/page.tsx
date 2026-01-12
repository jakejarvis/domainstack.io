import { BookmarksSimpleIcon } from "@phosphor-icons/react/ssr";
import { BookmarkletContent } from "@/components/bookmarklet/bookmarklet-content";
import { Modal, ModalContent } from "@/components/ui/modal";

export default function InterceptedBookmarkletPage() {
  return (
    <Modal>
      <ModalContent className="!max-w-lg p-5">
        <div className="mb-2 flex items-center gap-2 font-medium text-lg">
          <BookmarksSimpleIcon className="h-4.5 w-4.5" />
          Bookmarklet
        </div>
        <BookmarkletContent />
      </ModalContent>
    </Modal>
  );
}
