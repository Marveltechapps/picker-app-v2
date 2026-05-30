import { Redirect } from "expo-router";

export default function Index() {
  // Start new users directly on permissions instead of the splash UI.
  return <Redirect href="/permissions" />;
}

