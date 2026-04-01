import { useMemo, useCallback } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

export default function WidgetGrid({
  widgets,
  layout,
  onLayoutChange,
  editMode,
  onToggleEdit,
  onReset,
  cols = { lg: 12, md: 12, sm: 6, xs: 1 },
  rowHeight = 50,
}) {
  const { width, containerRef } = useContainerWidth();

  const layouts = useMemo(() => {
    return { lg: layout, md: layout, sm: layout, xs: layout };
  }, [layout]);

  const handleLayoutChange = useCallback(
    (currentLayout) => {
      if (editMode && onLayoutChange) {
        onLayoutChange(currentLayout);
      }
    },
    [editMode, onLayoutChange]
  );

  return (
    <div className={`widget-grid${editMode ? ' edit-mode' : ''}`} ref={containerRef}>
      {onToggleEdit && (
        <div className="widget-grid-toolbar">
          <button className="btn btn-ghost btn-sm" onClick={onToggleEdit}>
            {editMode ? 'Done' : 'Customize'}
          </button>
          {editMode && onReset && (
            <button className="btn btn-ghost btn-sm" onClick={onReset}>
              Reset Layout
            </button>
          )}
        </div>
      )}
      {width > 0 && (
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 0 }}
          cols={cols}
          rowHeight={rowHeight}
          margin={[8, 8]}
          width={width}
          dragConfig={{ enabled: editMode }}
          resizeConfig={{ enabled: editMode }}
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map((widget) => (
            <div key={widget.id} className="widget-wrapper">
              {widget.header && (
                <div className="widget-header">
                  <h3>{widget.header}</h3>
                </div>
              )}
              <div className="widget-body">{widget.content}</div>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
