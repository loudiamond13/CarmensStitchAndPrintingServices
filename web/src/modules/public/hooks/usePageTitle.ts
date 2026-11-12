// Sets the document title on a public page (PUB-04). The text is the one the server sends in the page head, from
// PUBLIC_COPY.titles, so a first load and a client navigation show the same title.
import { useEffect } from 'react';

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
