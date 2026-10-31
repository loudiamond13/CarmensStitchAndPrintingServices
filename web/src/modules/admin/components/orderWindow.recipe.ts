// The looks shared by the order windows (UI-SPEC O2, `.csp-form-grid`; plan 08-14) as complete Tailwind tokens (D-33). Every string
// here is a class list (the class gate compiles each one).
import { tw } from '@/ui/tw';

/** The window body: a column of blocks 20px apart. */
export const orderWindowBodyClasses = tw('flex flex-col gap-5');

/** `.csp-form-grid`: two columns, one at 639px and below. */
export const orderWindowGridClasses = tw('grid grid-cols-2 gap-x-4 gap-y-5 pg-phone:grid-cols-1');

/** A field that takes the whole row of the grid. */
export const orderWindowFullRowClasses = tw('col-span-2 pg-phone:col-span-1');
