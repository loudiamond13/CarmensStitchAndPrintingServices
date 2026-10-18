// SPEC-GAP: ActorName (UI-SPEC "ActorName"; SEC-08, D-11, OQ-8; plan 05-25). Renders the person who did something to a
// record: the name as text, then, for a colleague whose account was deleted, a muted suffix so the record still names them.
// No actor (a record made before actors were recorded) reads "System", plain. Later phases reuse it for "Recorded by"
// (CEXP-04, ORD-09) and the audit log. The name is a text node, never HTML (CWE-79).
import { RECORD_META_COPY } from './copy';
import { actorFormerClasses } from './data.recipe';

/** An actor as the API sends it (ActorRef), or null when there is none. */
export interface ActorLike {
  name: string;
  /** True when the actor's account was deleted; the name is kept (D-11). */
  formerStaff: boolean;
}

export interface ActorNameProps {
  actor: ActorLike | null;
}

export function ActorName({ actor }: ActorNameProps) {
  if (actor === null) {
    return RECORD_META_COPY.system;
  }
  return (
    <>
      {actor.name}
      {actor.formerStaff && <span className={actorFormerClasses}>{RECORD_META_COPY.formerStaff}</span>}
    </>
  );
}
