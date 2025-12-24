import { MousePointerClick } from "lucide-react";
import { BookmarkletContent } from "@/components/layout/bookmarklet-content";
import { Modal } from "@/components/layout/modal";

export default function InterceptedBookmarkletPage() {
  return (
    <Modal
      title="Bookmarklet"
      description="Discover shortcuts to investigate domains from anywhere."
    >
      <div className="space-y-4 px-6">
        <div className="flex items-center gap-2 font-medium text-lg">
          <MousePointerClick className="h-4.5 w-4.5" />
          Bookmarklet
        </div>
        <BookmarkletContent />
      </div>
    </Modal>
  );
}
