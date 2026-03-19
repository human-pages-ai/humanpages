export interface ChipListProps {
  items: string[];
  color?: 'blue' | 'amber' | 'green';
  showCategory?: boolean;
}

export function ChipList({ items, color = 'blue', showCategory = false }: ChipListProps) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-800',
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => {
        // Extract category prefix if present (format: "Category - Item" or just "Item")
        let displayText = item;
        let category = '';
        if (showCategory && item.includes(' - ')) {
          const parts = item.split(' - ', 1);
          category = parts[0];
          displayText = item.slice(category.length + 3); // +3 for " - "
        }
        return (
          <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
            {category && <span className="font-semibold">{category}:</span>} {displayText}
          </span>
        );
      })}
    </div>
  );
}
