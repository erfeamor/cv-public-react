import { CvPayloadError, getCv } from '../src/composition/container';
import PersonHeader from '../src/presentation/components/PersonHeader';

/**
 * ISR: statically generate this page and revalidate it in the background every
 * 60s. The literal here must match REVALIDATE_SECONDS in the composition root
 * (Next statically analyzes this segment config, so it has to be a literal).
 * The page is NOT rendered per request — it is served static and refreshed.
 */
export const revalidate = 60;

/**
 * Home page — a Server Component. It calls the composition root (which reads env
 * and wires the BFF adapter) and the use case, then renders the person head.
 * The fetch runs at build/revalidation time on the server; nothing here ships
 * to the client, and cv-domain-service is never contacted directly.
 */
export default async function HomePage() {
  let cv;
  try {
    cv = await getCv();
  } catch (error) {
    // A contract-violating payload is rethrown, not shown as "unavailable":
    // under ISR a throw during background revalidation makes Next keep serving
    // the last good page (and log the error), while a first build against a
    // bad payload fails. That is the "fail loudly" a live page can do (T-409).
    // Anything else -- CvFetchError on a non-2xx, or an unreachable BFF --
    // keeps the alert, so a BFF that is down at build time still prerenders.
    if (error instanceof CvPayloadError) throw error;
    return (
      <p role="alert" className="load-error">
        This CV is temporarily unavailable. Please try again later.
      </p>
    );
  }

  return <PersonHeader person={cv} />;
}
