/**
 * Dev harness for the plain HTML version.
 *
 *   /dev/plain            the page as visitors get it
 *     ?send=fail          make the mock contact form delivery fail
 *     ?review=1           outline copy marked `needsReview`
 *     ?h=2                render the name as <h2> (integration option)
 *
 * This page is a server component on purpose: it proves PlainPortfolio
 * renders on the server. The contact form uses a mock transport — nothing
 * is ever sent from here.
 */
import { PlainPortfolio } from "@/components/course/PlainPortfolio";
import { MockTransport } from "../overlays/MockTransport";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PlainHarness({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <MockTransport fail={params.send === "fail"} review={params.review === "1"}>
      <PlainPortfolio
        nameHeadingLevel={params.h === "2" ? 2 : 1}
        actions={
          <a className="btn-retro btn-retro--gold" href="/dev/overlays">
            Play the 3D version
          </a>
        }
      />
    </MockTransport>
  );
}
