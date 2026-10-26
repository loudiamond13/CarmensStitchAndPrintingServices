// Paid by, Recorded by and Deleted by cells of the expense tables (App. E.11; plans 06-04, 06-16): Avatar 24 (decorative, the name
// is the text) and the name, 8px apart; no avatar for System (a null actor).
import { ActorName } from '@/components/data';
import { Avatar } from '@/components/status';
import {
  expensesActorClasses,
  expensesAvatarClasses,
  expensesWrapClasses,
} from '@/modules/admin/components/expenses.recipe';
import type { ActorRef } from '@/modules/admin/services/expensesService';

export function ExpenseActorCell({ actor }: { actor: ActorRef | null }) {
  return (
    <span className={expensesActorClasses}>
      {actor !== null && (
        <span aria-hidden="true" className={expensesAvatarClasses}>
          <Avatar name={actor.name} size={24} />
        </span>
      )}
      <span className={expensesWrapClasses}>
        <ActorName actor={actor} />
      </span>
    </span>
  );
}
