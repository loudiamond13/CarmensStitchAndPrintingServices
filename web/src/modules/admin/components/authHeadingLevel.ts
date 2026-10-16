// The heading level of an auth card's title. Every sign-in screen is a page of its own, so the title is the page's h1; the
// Component Showcase and the parity previews draw several cards on one page and give the cards an h2 instead (plan 04-32).
import { createContext } from 'react';

export const AuthHeadingLevelContext = createContext<'h1' | 'h2'>('h1');
