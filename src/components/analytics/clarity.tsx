/** Microsoft Clarity project. The id is public: it ships in the page HTML. */
const CLARITY_PROJECT_ID = "zbhj2a1c69";

/**
 * Clarity's tag, wrapped so it never starts on the internal /dev pages: those show
 * lead names, emails and phones as plain text, which Clarity would record.
 */
const snippet = `if(!/^\\/(en\\/|es\\/)?dev(\\/|$)/.test(location.pathname)){(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");}`;

/**
 * Session analytics for the whole site. Rendered inside <head> by the root layout.
 * Only real production traffic is tracked: nothing on localhost or preview deploys.
 */
export function Clarity() {
  if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview") return null;
  return <script id="ms-clarity" dangerouslySetInnerHTML={{ __html: snippet }} />;
}
