import { Redirect } from "expo-router";

/** Legacy route: onboarding uses `/select-shift`. Deep links here redirect. */
export default function ShiftSelectionRedirect() {
  return <Redirect href="/select-shift" />;
}
