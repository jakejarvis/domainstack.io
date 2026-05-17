import { type Href, router } from "expo-router";

import { GroupedRow } from "@/components/form/group";
import { Text } from "@/components/text";
import { confirm } from "@/lib/native-confirm";

const DELETE_ACCOUNT_ROUTE = "/delete-account" as Href;

export function DeleteAccountRow() {
  async function handlePress() {
    const accepted = await confirm({
      confirmLabel: "Delete",
      destructive: true,
      message:
        "This action cannot be undone. We'll send a confirmation link to your email; clicking it will permanently delete your account, tracked domains, notification preferences, and any active subscription.",
      title: "Delete your account?",
    });
    if (!accepted) return;
    router.push(DELETE_ACCOUNT_ROUTE);
  }

  return (
    <GroupedRow onPress={handlePress}>
      <Text className="font-semibold text-destructive">Delete account</Text>
    </GroupedRow>
  );
}
