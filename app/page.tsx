import { redirect } from "next/navigation";

export default function Home() {
  redirect("/chat");
  
  // This return statement won't be reached due to the redirect,
  // but is needed to satisfy TypeScript
  return <></>;
}
