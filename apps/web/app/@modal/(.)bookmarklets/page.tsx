import { BookmarkletContent } from "@/components/bookmarklet/bookmarklet-content";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function InterceptedBookmarkletsPage() {
  return (
    <Modal>
      <ModalContent className="!max-w-lg">
        <ModalHeader>
          <ModalTitle>Bookmarklets</ModalTitle>
          <ModalDescription>
            Use these shortcuts to investigate domains from anywhere.
          </ModalDescription>
        </ModalHeader>
        <ScrollArea className="min-h-0 flex-1 bg-popover/10">
          <div className="min-w-0 p-4 [contain:inline-size]">
            <BookmarkletContent />
          </div>
        </ScrollArea>
      </ModalContent>
    </Modal>
  );
}
