import { cn } from "@/lib/utils";
import { Droppable, Draggable } from "@hello-pangea/dnd";

export function KanbanColumn({ columnId, label, count, items, renderItem, className }) {
  return (
    <div className={cn("flex flex-col min-w-[280px] flex-1", className)}>
      {/* Column header */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
          {label}
        </h3>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--syn-badge-neutral-bg)] text-[var(--syn-badge-neutral-text)] text-xs font-semibold">
          {count ?? 0}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex flex-col gap-3 flex-1 min-h-[60px] rounded-lg p-1 transition-colors",
              snapshot.isDraggingOver && "bg-[var(--syn-badge-neutral-bg)]"
            )}
          >
            {items.map((item, index) => (
              <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={cn(snapshot.isDragging && "opacity-90")}
                  >
                    {renderItem(item)}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export function KanbanBoard({ children, className }) {
  return (
    <div
      className={cn(
        "flex gap-6 overflow-x-auto pb-4",
        className
      )}
    >
      {children}
    </div>
  );
}
