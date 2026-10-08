// RED stub (plan 02-19 Task 3): replaced in GREEN.
export interface TabItem<I extends string = string> {
  id: I;
  label: string;
  count?: number | undefined;
}

export interface TabsProps<I extends string = string> {
  items: readonly TabItem<I>[];
  value?: I | undefined;
  onChange?: ((id: I) => void) | undefined;
  idBase: string;
}

export interface TabPanelProps {
  readonly id: string;
  readonly role: 'tabpanel';
  readonly 'aria-labelledby': string;
}

export function getTabPanelProps(idBase: string, id: string): TabPanelProps {
  return { id: `${idBase}${id}`, role: 'tabpanel', 'aria-labelledby': '' };
}

export function Tabs<I extends string = string>({ items }: TabsProps<I>) {
  return (
    <div>
      {items.map((item) => (
        <button key={item.id} type="button">
          {item.label}
        </button>
      ))}
    </div>
  );
}
