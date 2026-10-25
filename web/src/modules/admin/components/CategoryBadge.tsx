// SPEC-GAP: CategoryBadge (UI-SPEC "CategoryBadge"; D-08, D-13; plan 06-04). A company expense category as a Badge in the
// tone the server stores for it, so every list, picker preview and toast-free surface shows a category the same way. A tone
// the badge does not know (a value the types cannot promise) reads as neutral. A retired category looks the same here:
// "retired" shows only in the filter, the picker and the Settings list (D-11). The name is a text node (CWE-79).
import { Badge, isCategoryTone } from '@/components/status';
import { categoryBadgeClasses } from './expenses.recipe';

export interface CategoryBadgeProps {
  /** The category as the API sends it (ExpenseCategoryRef); only the name and tone are read, never `retired` (D-11). */
  category: { name: string; tone: string; retired?: boolean | undefined };
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <Badge tone={isCategoryTone(category.tone) ? category.tone : 'neutral'} className={categoryBadgeClasses}>
      {category.name}
    </Badge>
  );
}
