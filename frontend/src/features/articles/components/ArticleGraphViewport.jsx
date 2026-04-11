import CytoscapeComponent from "react-cytoscapejs";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

function ArticleGraphViewport({
  elements,
  handleCyInit,
  layout,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  stylesheet,
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] shadow-[var(--syn-shadow-card)]">
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 bg-[var(--syn-bg-primary)]/80 backdrop-blur-sm"
          onClick={onZoomIn}
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 bg-[var(--syn-bg-primary)]/80 backdrop-blur-sm"
          onClick={onZoomOut}
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 bg-[var(--syn-bg-primary)]/80 backdrop-blur-sm"
          onClick={onZoomReset}
          title="Ajustar à tela"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="h-[600px] w-full">
        <CytoscapeComponent
          elements={elements}
          cy={handleCyInit}
          layout={layout}
          stylesheet={stylesheet}
          style={{ width: "100%", height: "100%" }}
          wheelSensitivity={0.2}
        />
      </div>
    </div>
  );
}

export default ArticleGraphViewport;
